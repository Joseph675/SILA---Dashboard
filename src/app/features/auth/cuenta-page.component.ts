import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiErrorService } from '../../core/api/api-error';
import type { MfaConfig, SesionAbierta } from '../../core/auth/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { SesionesListaComponent } from '../../shared/ui/sesiones-lista/sesiones-lista.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { SilaValidators, limpiarTexto } from '../../shared/validators/sila-validators';
import { CampoCodigoMfaComponent } from './campo-codigo-mfa.component';
import { ErrorAccionSensible, describirErrorSensible } from './errores-mfa';
import { CambiarClaveFormComponent, CambioClave } from './cambiar-clave-form.component';
import { CodigosRespaldoComponent } from './codigos-respaldo.component';
import { MfaEnrolarComponent } from './mfa-enrolar.component';
import { PasskeysSeccionComponent } from './passkeys-seccion.component';
import { RegenerarCodigosDialogComponent } from './regenerar-codigos-dialog.component';

/** Total of backup codes the server hands out each time. */
const TOTAL_CODIGOS = 10;

type AccionSesiones = 'otras' | 'todas';

/** "Mi cuenta": my data, password, second factor with its backup codes, and my open sessions. Any signed-in user. */
@Component({
  selector: 'app-cuenta-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CampoCodigoMfaComponent,
    FormFieldComponent,
    ReactiveFormsModule,
    CambiarClaveFormComponent,
    CodigosRespaldoComponent,
    ConfirmDialogComponent,
    DialogComponent,
    IconComponent,
    MfaEnrolarComponent,
    PageHeaderComponent,
    PasskeysSeccionComponent,
    RegenerarCodigosDialogComponent,
    SesionesListaComponent,
    StatusChipComponent,
  ],
  templateUrl: './cuenta-page.component.html',
})
export class CuentaPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sesion = computed(() => this.auth.sesion());
  protected readonly totalCodigos = TOTAL_CODIGOS;

  // ---------- My data (edit) ----------

  protected readonly editando = signal(false);
  protected readonly guardandoDatos = signal(false);
  protected readonly errorDatos = signal<string | null>(null);
  protected readonly errorCodigoDatos = signal<string | null>(null);
  protected readonly formDatos = inject(NonNullableFormBuilder).group({
    nombre: ['', [SilaValidators.requerido, SilaValidators.longitud(3, 120)]],
    email: ['', [SilaValidators.requerido, Validators.email, Validators.maxLength(150)]],
    codigo: [''],
  });

  protected editar(): void {
    const s = this.sesion();
    if (!s) return;
    this.formDatos.reset({ nombre: s.nombre, email: s.email, codigo: '' });
    this.errorDatos.set(null);
    this.errorCodigoDatos.set(null);
    this.editando.set(true);
  }

  protected cancelarEdicion(): void {
    this.editando.set(false);
    this.formDatos.reset();
  }

  protected guardarDatos(): void {
    if (this.guardandoDatos()) return;
    this.formDatos.markAllAsTouched();
    if (this.formDatos.invalid) return;
    const { nombre, email, codigo } = this.formDatos.getRawValue();
    this.guardandoDatos.set(true);
    this.errorDatos.set(null);
    this.errorCodigoDatos.set(null);
    this.auth
      .actualizarPerfil({ nombre: limpiarTexto(nombre), email: email.trim(), codigo: codigo.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // `AuthService` already replaced the session in memory with the answer.
          this.guardandoDatos.set(false);
          this.editando.set(false);
          this.formDatos.reset();
          this.toast.exito('Tus datos se actualizaron.');
        },
        error: (fallo: unknown) => {
          this.guardandoDatos.set(false);
          const e: ErrorAccionSensible = describirErrorSensible(this.errores, fallo);
          if (e.campo === 'codigo') this.errorCodigoDatos.set(e.mensaje);
          else if (e.campo === 'email') this.formDatos.controls.email.setErrors({ servidor: e.mensaje });
          else this.errorDatos.set(e.mensaje);
          if (e.limpiarCodigo) this.formDatos.controls.codigo.reset('');
        },
      });
  }

  // ---------- Password ----------

  protected readonly cambiandoClave = signal(false);
  protected readonly errorClave = signal<string | null>(null);
  protected readonly errorCodigoClave = signal<string | null>(null);
  private readonly formClave = viewChild(CambiarClaveFormComponent);

  protected cambiarClave(cambio: CambioClave): void {
    if (this.cambiandoClave()) return;
    this.cambiandoClave.set(true);
    this.errorClave.set(null);
    this.errorCodigoClave.set(null);
    this.auth
      .cambiarClave(cambio.actual, cambio.nueva, undefined, cambio.codigo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // The API closed every session of this user (this one too): sign in again.
          this.cambiandoClave.set(false);
          void this.router.navigate(['/login'], { queryParams: { aviso: 'clave-cambiada' } });
        },
        error: (fallo: unknown) => {
          this.cambiandoClave.set(false);
          const e = describirErrorSensible(this.errores, fallo);
          if (e.campo === 'codigo') this.errorCodigoClave.set(e.mensaje);
          else this.errorClave.set(e.mensaje);
          if (e.limpiarCodigo) this.formClave()?.limpiarCodigo();
        },
      });
  }

  // ---------- Second factor (optional for OPERATIVO) ----------

  protected readonly mfaConfig = signal<MfaConfig | null>(null);
  protected readonly preparandoMfa = signal(false);
  protected readonly activandoMfa = signal(false);
  protected readonly errorMfa = signal<string | null>(null);

  protected prepararMfa(): void {
    this.preparandoMfa.set(true);
    this.errorMfa.set(null);
    this.auth
      .configurarMfa()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config) => this.mfaConfig.set(config),
        error: (fallo: unknown) => {
          this.preparandoMfa.set(false);
          this.errorMfa.set(this.errores.describe(fallo).mensaje);
        },
      });
  }

  protected activarMfa(codigo: string): void {
    if (this.activandoMfa()) return;
    this.activandoMfa.set(true);
    this.errorMfa.set(null);
    this.auth
      .activarMfa(codigo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => {
          this.activandoMfa.set(false);
          this.mfaConfig.set(null);
          this.preparandoMfa.set(false);
          this.toast.exito('Segundo factor activado. Desde ahora te pedirán el código al ingresar.');
          // The server hands out the 10 backup codes now and never again: the person must save them.
          if (respuesta.codigos_respaldo?.length) this.codigosParaGuardar.set(respuesta.codigos_respaldo);
        },
        error: (fallo: unknown) => {
          this.activandoMfa.set(false);
          this.errorMfa.set(this.errores.describe(fallo).mensaje);
        },
      });
  }

  // ---------- Backup codes ----------

  /** How many are left. Only asked when the second factor is on. */
  protected readonly respaldo = rxResource({
    params: () => (this.sesion()?.mfa_activo ? true : undefined),
    stream: () => this.auth.respaldoEstado(),
  });
  protected readonly restantes = computed(() => (this.respaldo.hasValue() ? this.respaldo.value().restantes : null));

  protected readonly pidiendoClave = signal(false);
  protected readonly regenerando = signal(false);
  protected readonly errorRegenerar = signal<string | null>(null);
  protected readonly errorCodigoRegenerar = signal<string | null>(null);
  private readonly dialogoRegenerar = viewChild(RegenerarCodigosDialogComponent);
  /** The codes on screen right now. Dropped when the person confirms having saved them. */
  protected readonly codigosParaGuardar = signal<readonly string[] | null>(null);

  protected regenerar(datos: { clave: string; codigo: string }): void {
    if (this.regenerando()) return;
    this.regenerando.set(true);
    this.errorRegenerar.set(null);
    this.errorCodigoRegenerar.set(null);
    this.auth
      .regenerarCodigosRespaldo(datos.clave, datos.codigo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => {
          this.regenerando.set(false);
          this.pidiendoClave.set(false);
          this.dialogoRegenerar()?.limpiar();
          this.codigosParaGuardar.set(respuesta.codigos_respaldo);
        },
        error: (fallo: unknown) => {
          this.regenerando.set(false);
          const e = describirErrorSensible(this.errores, fallo);
          if (e.campo === 'codigo') this.errorCodigoRegenerar.set(e.mensaje);
          else this.errorRegenerar.set(e.mensaje);
          if (e.limpiarCodigo) this.dialogoRegenerar()?.limpiarCodigo();
        },
      });
  }

  protected codigosGuardados(): void {
    this.codigosParaGuardar.set(null);
    if (this.sesion()?.mfa_activo) this.respaldo.reload();
  }

  // ---------- My sessions ----------

  protected readonly sesiones = rxResource({ stream: () => this.auth.misSesiones() });
  protected readonly listaSesiones = computed(() => (this.sesiones.hasValue() ? this.sesiones.value() : undefined));
  protected readonly errorSesiones = computed(() => (this.sesiones.error() ? this.errores.describe(this.sesiones.error()).mensaje : null));
  protected readonly accionSesiones = signal<AccionSesiones | null>(null);
  protected readonly procesandoSesiones = signal(false);

  protected readonly dialogoSesiones = computed(() =>
    this.accionSesiones() === 'todas'
      ? {
          titulo: 'Cerrar todas mis sesiones',
          mensaje: 'Se cerrarán TODAS tus sesiones, incluida esta. Tendrás que iniciar sesión de nuevo en todos tus dispositivos.',
          texto: 'Sí, cerrar todas',
        }
      : {
          titulo: 'Cerrar las demás sesiones',
          mensaje: 'Se cerrarán todas tus sesiones menos esta. En esos dispositivos tendrás que iniciar sesión de nuevo.',
          texto: 'Cerrar las demás',
        },
  );

  protected cerrarFila(sesion: SesionAbierta): void {
    if (this.procesandoSesiones()) return;
    if (sesion.actual) {
      // Closing "this session" is signing out.
      this.salir();
      return;
    }
    this.procesandoSesiones.set(true);
    this.auth
      .cerrarMiSesion(sesion.familia)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.procesandoSesiones.set(false);
          this.toast.exito('Sesión cerrada.');
          this.sesiones.reload();
        },
        error: (fallo: unknown) => {
          this.procesandoSesiones.set(false);
          this.avisarError(fallo);
          this.sesiones.reload();
        },
      });
  }

  protected confirmarSesiones(): void {
    const accion = this.accionSesiones();
    if (!accion || this.procesandoSesiones()) return;
    this.procesandoSesiones.set(true);
    const peticion = accion === 'todas' ? this.auth.cerrarTodasSesiones() : this.auth.cerrarOtrasSesiones();
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ cerradas }) => {
        this.procesandoSesiones.set(false);
        this.accionSesiones.set(null);
        if (accion === 'todas') {
          // The current session was closed too: nothing left to do here but sign in again.
          this.auth.terminarSesion();
          void this.router.navigate(['/login'], { queryParams: { aviso: 'sesiones-cerradas' } });
          return;
        }
        this.toast.exito(cerradas === 1 ? 'Se cerró 1 sesión.' : `Se cerraron ${cerradas} sesiones.`);
        this.sesiones.reload();
      },
      error: (fallo: unknown) => {
        this.procesandoSesiones.set(false);
        this.accionSesiones.set(null);
        this.avisarError(fallo);
      },
    });
  }

  private salir(): void {
    this.auth.cerrarSesion().subscribe(() => void this.router.navigate(['/login']));
  }

  private avisarError(fallo: unknown): void {
    const { mensaje, supportRef } = this.errores.describe(fallo);
    this.toast.error(mensaje, supportRef);
  }
}
