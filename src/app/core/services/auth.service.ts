import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, firstValueFrom, map, of, shareReplay, tap } from 'rxjs';
import { ApiOpciones, ApiService } from '../api/api.service';
import type { ActualizarPerfilRequest, AuthResponse, CambiarClaveRequest, CodigosRespaldo, RegenerarRequest, MfaConfig, RespaldoEstado, Rol, Sesion, SesionAbierta, SesionesCerradas } from '../auth/auth.models';
import { CanalSesion } from '../session/canal-sesion.service';

export type { Rol, Sesion } from '../auth/auth.models';

/** `/auth/*` carries the HttpOnly refresh cookie. */
const CREDENCIALES: ApiOpciones = { withCredentials: true };

/** Name of the Web Lock that serializes refreshes between tabs. */
const CANDADO_RENOVACION = 'sila-refresh';

/** The temporary token of a login step goes in `Authorization` for that one call. */
function conTemporal(tokenTemporal?: string): ApiOpciones {
  return tokenTemporal ? { ...CREDENCIALES, headers: { Authorization: `Bearer ${tokenTemporal}` } } : CREDENCIALES;
}

/**
 * Session of the signed-in user.
 *
 * - The access token (JWT, 15 min) lives only in memory, in a signal:
 *   never in localStorage, sessionStorage, cookies of our own, the URL or logs.
 * - The refresh token is an HttpOnly cookie that this code can neither read
 *   nor write; the browser sends it to `/auth/*`.
 * - Temporary login tokens are NOT kept here: the login component holds them
 *   in its own state and drops them when the flow ends.
 * - Backup codes are never kept here either: they travel in the answer and the
 *   component that shows them drops them.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly canal = inject(CanalSesion);

  private readonly tokenSignal = signal<string | null>(null);
  /** Who is signed in. Only this service should write it (tests may set it). */
  readonly sesion = signal<Sesion | null>(null);
  /** Backup codes left after signing in with one; `null` = unknown / not applicable. Only a count, in memory. */
  readonly codigosRestantes = signal<number | null>(null);

  readonly isAuthenticated = computed(() => this.sesion() !== null);
  readonly rol = computed(() => this.sesion()?.rol ?? null);

  /** The refresh in flight, shared by everyone who asks while it runs. */
  private renovacion$: Observable<AuthResponse> | null = null;

  get token(): string | null {
    return this.tokenSignal();
  }

  /**
   * ADMIN can do everything OPERATIVO can. Hiding UI with this is NOT
   * security: the API and the database reject the call anyway (error 20008).
   */
  hasRole(rol: Rol): boolean {
    const actual = this.rol();
    return actual === 'ADMIN' || actual === rol;
  }

  // ---------- Login steps ----------

  iniciarSesion(usuario: string, clave: string): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('auth/login', { usuario, clave }, CREDENCIALES).pipe(tap((r) => this.aplicar(r)));
  }

  /** With a temporary token: next login step. Without it (access token): `CLAVE_CAMBIADA`, and every session of the user is closed. */
  cambiarClave(claveActual: string, claveNueva: string, tokenTemporal?: string, codigo?: string): Observable<AuthResponse> {
    const cuerpo: CambiarClaveRequest = { clave_actual: claveActual, clave_nueva: claveNueva, ...(!tokenTemporal && codigo ? { codigo } : {}) };
    return this.api
      .post<AuthResponse>('auth/cambiar-clave', cuerpo, conTemporal(tokenTemporal))
      .pipe(tap((r) => this.aplicar(r)));
  }

  configurarMfa(tokenTemporal?: string): Observable<MfaConfig> {
    return this.api.post<MfaConfig>('auth/mfa/configurar', null, conTemporal(tokenTemporal));
  }

  /** The answer carries `codigos_respaldo`: the caller must make the person save them before going on. */
  activarMfa(codigo: string, tokenTemporal?: string): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('auth/mfa/activar', { codigo }, conTemporal(tokenTemporal)).pipe(tap((r) => this.aplicar(r)));
  }

  verificarMfa(codigo: string, tokenTemporal: string): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('auth/mfa/verificar', { codigo }, conTemporal(tokenTemporal)).pipe(tap((r) => this.aplicar(r)));
  }

  /** Lost phone: a one-use backup code instead of the app code. The answer says how many are left. */
  usarCodigoRespaldo(codigoRespaldo: string, tokenTemporal: string): Observable<AuthResponse> {
    return this.api
      .post<AuthResponse>('auth/mfa/respaldo', { codigo_respaldo: codigoRespaldo }, conTemporal(tokenTemporal))
      .pipe(tap((r) => this.aplicar(r)));
  }

  // ---------- Backup codes (signed in) ----------

  respaldoEstado(): Observable<RespaldoEstado> {
    return this.api.get<RespaldoEstado>('auth/mfa/respaldo');
  }

  /** Asks for the CURRENT password and a second-factor code; the previous codes stop working. */
  regenerarCodigosRespaldo(claveActual: string, codigo: string): Observable<CodigosRespaldo> {
    const cuerpo: RegenerarRequest = { clave_actual: claveActual, codigo };
    return this.api
      .post<CodigosRespaldo>('auth/mfa/respaldo/regenerar', cuerpo)
      .pipe(tap(() => this.codigosRestantes.set(null)));
  }

  /** Edits my name and e-mail (needs the second-factor code). The answer is the updated user: it replaces the session in memory. */
  actualizarPerfil(datos: ActualizarPerfilRequest): Observable<Sesion> {
    return this.api.put<Sesion>('auth/yo', datos).pipe(tap((usuario) => this.sesion.set(usuario)));
  }

  // ---------- My sessions (signed in) ----------

  misSesiones(): Observable<SesionAbierta[]> {
    return this.api.get<SesionAbierta[]>('auth/sesiones');
  }

  /** Closes one of MY sessions. If it is the current one, the caller must treat it as a sign-out. */
  cerrarMiSesion(familia: string): Observable<void> {
    return this.api.delete<void>(`auth/sesiones/${encodeURIComponent(familia)}`);
  }

  cerrarOtrasSesiones(): Observable<SesionesCerradas> {
    return this.api.post<SesionesCerradas>('auth/sesiones/cerrar-otras', null);
  }

  /** Closes all, the current one too: the local session must be cleared afterwards (see `limpiarSesion`). */
  cerrarTodasSesiones(): Observable<SesionesCerradas> {
    return this.api.post<SesionesCerradas>('auth/sesiones/cerrar-todas', null);
  }

  // ---------- Session life ----------

  /**
   * Gets a new access token with the refresh cookie. SINGLE-FLIGHT: the API
   * rotates the refresh token on every use, so two simultaneous refreshes
   * would revoke the whole session. Everyone who asks while one is running
   * waits for that same request; between tabs the call is serialized with a Web Lock.
   */
  renovar(): Observable<AuthResponse> {
    if (!this.renovacion$) {
      this.renovacion$ = this.renovarConCandado().pipe(
        tap((r) => this.aplicar(r)),
        finalize(() => (this.renovacion$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.renovacion$;
  }

  /**
   * SUPUESTO: two tabs share one refresh cookie that rotates on every use. A Web Lock makes
   * them take turns: the second tab's call goes out after the first one's answer has already
   * replaced the cookie, so it sends the NEW value instead of repeating the old one (which the
   * server would read as a stolen token and revoke the whole session). The access token is not
   * shared through the channel, so each tab still renews for itself when its turn comes.
   * Without `navigator.locks` it falls back to the plain call.
   */
  private renovarConCandado(): Observable<AuthResponse> {
    const candados = typeof navigator === 'undefined' ? undefined : navigator.locks;
    const llamar = () => this.api.post<AuthResponse>('auth/refresh', null, CREDENCIALES);
    if (!candados) return llamar();

    return new Observable<AuthResponse>((suscriptor) => {
      const cancelar = new AbortController();
      candados
        .request(CANDADO_RENOVACION, { signal: cancelar.signal }, async () => {
          try {
            suscriptor.next(await firstValueFrom(llamar()));
            suscriptor.complete();
          } catch (error) {
            suscriptor.error(error);
          }
        })
        .catch((error: unknown) => suscriptor.error(error));
      // If nobody waits for the answer any more, stop waiting for the lock (no effect once it is granted).
      return () => cancelar.abort();
    });
  }

  /** On app start: a valid refresh cookie means the user does not type the password again after F5. */
  restaurarSesion(): Promise<boolean> {
    return firstValueFrom(
      this.renovar().pipe(
        map((r) => r.estado === 'OK'),
        catchError(() => of(false)),
      ),
    );
  }

  /**
   * Always clears the in-memory session, even if the call fails, and tells the other tabs to do the same.
   * `motivo` only travels as a hint for the message the other tabs show.
   */
  cerrarSesion(motivo?: 'inactividad'): Observable<void> {
    let cerrada = false;
    // Cleared BEFORE the answer is handed over, so whoever navigates next already sees no session.
    const cerrarLocal = () => {
      if (cerrada) return;
      cerrada = true;
      this.limpiarSesion();
      this.canal.enviar(motivo ? { tipo: 'logout', motivo } : { tipo: 'logout' });
    };
    return this.api.post<void>('auth/logout', null, CREDENCIALES).pipe(
      catchError(() => of(undefined)),
      tap(cerrarLocal),
      map(() => undefined),
      finalize(cerrarLocal),
    );
  }

  /** The session is over for reasons outside this call (e.g. "close all"): clear it and tell the other tabs. */
  terminarSesion(): void {
    this.limpiarSesion();
    this.canal.enviar({ tipo: 'logout' });
  }

  limpiarSesion(): void {
    this.tokenSignal.set(null);
    this.sesion.set(null);
    this.codigosRestantes.set(null);
  }

  private aplicar(respuesta: AuthResponse): void {
    switch (respuesta.estado) {
      case 'OK':
        if (respuesta.access_token && respuesta.usuario) {
          this.tokenSignal.set(respuesta.access_token);
          this.sesion.set(respuesta.usuario);
        }
        // Only present after signing in with a backup code.
        if (typeof respuesta.codigos_restantes === 'number') {
          this.codigosRestantes.set(respuesta.codigos_restantes);
        }
        break;
      case 'CLAVE_CAMBIADA':
        // The API closed every session of this user, including this one.
        this.limpiarSesion();
        break;
      case 'MFA_ACTIVADO':
        this.sesion.update((s) => (s ? { ...s, mfa_activo: true } : s));
        break;
    }
  }
}
