import { Injectable, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CanalSesion } from './canal-sesion.service';
import { AVISO_MS, INACTIVIDAD_MS } from './inactividad.config';

/** What counts as "the person is here". */
const EVENTOS_ACTIVIDAD = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const;

/** The other tabs are told about activity at most this often. */
const ENVIO_ACTIVIDAD_MS = 5000;

/** The countdown is redrawn every second. */
const PASO_MS = 1000;

/**
 * Closes the session after `INACTIVIDAD_MS` without activity, warning `AVISO_MS` before.
 *
 * - It works with TIMESTAMPS (`Date.now()`), not with one long `setTimeout`: a browser that puts
 *   the tab to sleep stops timers, and on waking up the next check sees how much time really passed.
 * - Activity in any tab counts for all of them: the last activity is shared through the channel
 *   (a number, nothing persisted).
 * - It runs only while there is a session and stops when it ends.
 */
@Injectable({ providedIn: 'root' })
export class InactividadService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly canal = inject(CanalSesion);

  /** The warning dialog is open. */
  readonly avisoVisible = signal(false);
  /** Milliseconds left until the session is closed (only meaningful while the warning is open). */
  readonly restanteMs = signal(AVISO_MS);

  private ultimaActividad = Date.now();
  private ultimoEnvio = 0;
  private intervalo: ReturnType<typeof setInterval> | null = null;
  private soltar: (() => void)[] = [];

  constructor() {
    // Starts with the session and stops (timer and listeners) when it ends.
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.iniciar();
      } else {
        this.parar();
      }
    });
  }

  /** "Seguir conectado": counts as activity and closes the warning. */
  seguirConectado(): void {
    this.avisoVisible.set(false);
    this.marcar(Date.now(), true);
  }

  /** "Cerrar sesión" from the warning dialog. */
  cerrarAhora(): void {
    this.cerrar(undefined);
  }

  private iniciar(): void {
    if (this.intervalo !== null) return;
    this.ultimaActividad = Date.now();
    this.avisoVisible.set(false);

    const alActividad = () => {
      // With the warning open only its button counts, so a mouse that moves by itself does not hide it.
      if (!this.avisoVisible()) this.marcar(Date.now(), false);
    };
    for (const evento of EVENTOS_ACTIVIDAD) {
      document.addEventListener(evento, alActividad, { passive: true, capture: true });
      this.soltar.push(() => document.removeEventListener(evento, alActividad, { capture: true }));
    }
    const alVolver = () => {
      if (document.visibilityState === 'visible') this.comprobar();
    };
    document.addEventListener('visibilitychange', alVolver);
    this.soltar.push(() => document.removeEventListener('visibilitychange', alVolver));
    this.soltar.push(
      this.canal.escuchar((mensaje) => {
        // Activity in another tab: nobody is idle.
        if (mensaje.tipo === 'actividad') {
          this.ultimaActividad = Math.max(this.ultimaActividad, mensaje.t);
          this.comprobar();
        }
      }),
    );

    this.intervalo = setInterval(() => this.comprobar(), PASO_MS);
  }

  private parar(): void {
    if (this.intervalo !== null) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }
    this.soltar.forEach((soltar) => soltar());
    this.soltar = [];
    this.avisoVisible.set(false);
  }

  private marcar(ahora: number, forzarEnvio: boolean): void {
    this.ultimaActividad = ahora;
    if (forzarEnvio || ahora - this.ultimoEnvio >= ENVIO_ACTIVIDAD_MS) {
      this.ultimoEnvio = ahora;
      this.canal.enviar({ tipo: 'actividad', t: ahora });
    }
  }

  private comprobar(): void {
    if (this.intervalo === null) return;
    const inactivo = Date.now() - this.ultimaActividad;
    if (inactivo >= INACTIVIDAD_MS) {
      this.cerrar('inactividad');
    } else if (inactivo >= INACTIVIDAD_MS - AVISO_MS) {
      this.restanteMs.set(INACTIVIDAD_MS - inactivo);
      this.avisoVisible.set(true);
    } else if (this.avisoVisible()) {
      // Another tab showed activity while this one was warning.
      this.avisoVisible.set(false);
    }
  }

  private cerrar(motivo: 'inactividad' | undefined): void {
    this.parar();
    this.auth.cerrarSesion(motivo).subscribe(() => {
      void this.router.navigate(['/login'], motivo ? { queryParams: { aviso: 'inactividad' } } : {});
    });
  }
}
