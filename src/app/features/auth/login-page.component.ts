import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiErrorService, esSesionVencida } from '../../core/api/api-error';
import type { AuthResponse, MfaConfig } from '../../core/auth/auth.models';
import { urlRetornoSegura } from '../../core/auth/url-retorno';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../layout/services/theme.service';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SilaValidators } from '../../shared/validators/sila-validators';
import { CambiarClaveFormComponent, CambioClave } from './cambiar-clave-form.component';
import { CodigosRespaldoComponent } from './codigos-respaldo.component';
import { MfaCodigoFormComponent } from './mfa-codigo-form.component';
import { MfaRespaldoFormComponent } from './mfa-respaldo-form.component';
import { MfaEnrolarComponent } from './mfa-enrolar.component';

export type PasoLogin = 'credenciales' | 'cambiar-clave' | 'mfa-enrolar' | 'mfa-codigo' | 'codigos-respaldo';

/** Notices another screen can ask the login to show (`?aviso=`): fixed keys, never free text from the URL. */
const AVISOS: Record<string, string> = {
  'clave-cambiada': 'Tu clave se cambió y se cerraron tus sesiones. Ingresa con la clave nueva.',
  'sesion-cerrada': 'Tu sesión se cerró (en otro dispositivo, por inactividad o por un administrador). Inicia sesión de nuevo.',
  inactividad: 'Tu sesión se cerró por inactividad.',
  'otra-pestana': 'Cerraste sesión en otra pestaña.',
  'sesiones-cerradas': 'Cerraste todas tus sesiones. Inicia sesión de nuevo.',
};

const TITULOS: Record<PasoLogin, string> = {
  credenciales: 'Iniciar sesión',
  'cambiar-clave': 'Cambia tu clave',
  'mfa-enrolar': 'Configura el segundo factor',
  'mfa-codigo': 'Verificación en dos pasos',
  'codigos-respaldo': 'Códigos de respaldo',
};

/**
 * Sign-in flow in steps: credentials -> (change password) -> (set up the
 * second factor | enter the code) -> in. The temporary tokens of the steps
 * live ONLY in this component (`tokenTemporal`), never in any storage, and
 * are dropped when the flow ends, is cancelled or expires.
 */
@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CambiarClaveFormComponent,
    CodigosRespaldoComponent,
    FormFieldComponent,
    IconComponent,
    MfaCodigoFormComponent,
    MfaEnrolarComponent,
    MfaRespaldoFormComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly errores = inject(ApiErrorService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly cambiarClave = viewChild(CambiarClaveFormComponent);

  protected readonly paso = signal<PasoLogin>('credenciales');
  protected readonly titulo = () => TITULOS[this.paso()];
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(AVISOS[this.route.snapshot.queryParamMap.get('aviso') ?? ''] ?? null);
  protected readonly mfaConfig = signal<MfaConfig | null>(null);
  protected readonly verClave = signal(false);
  /** Step 4 alternative: the person lost the phone and types a backup code. */
  protected readonly usarRespaldo = signal(false);
  /** The 10 codes of a just-activated second factor, kept only until the person confirms having saved them. */
  protected readonly codigosRespaldo = signal<readonly string[] | null>(null);
  /** For the file name and the heading of the codes screen. */
  protected readonly usuarioActual = computed(() => this.auth.sesion()?.usuario ?? '');

  /** Token of the current step (5 min, one purpose). Memory only. */
  private tokenTemporal: string | null = null;

  protected readonly form = inject(NonNullableFormBuilder).group({
    usuario: ['', [SilaValidators.requerido, SilaValidators.sinEspacios]],
    clave: ['', [SilaValidators.requerido]],
  });

  constructor() {
    // The page lives outside the shell, so it applies the theme itself.
    inject(ThemeService);
    // The notice is shown once: it is taken out of the URL so a reload does not repeat it.
    if (this.route.snapshot.queryParamMap.has('aviso')) {
      this.router
        .navigate(['/login'], { queryParams: { aviso: null }, queryParamsHandling: 'merge', replaceUrl: true })
        .catch(() => undefined);
    }
    // Every step puts the cursor in its first field.
    effect(() => {
      this.paso();
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('form input')?.focus());
    });
  }

  // ---------- Step 1 ----------

  protected enviarCredenciales(): void {
    if (this.ocupado()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { usuario, clave } = this.form.getRawValue();
    this.ocupar();
    this.auth.iniciarSesion(usuario.trim().toLowerCase(), clave).subscribe({
      next: (respuesta) => this.procesar(respuesta),
      error: (fallo: unknown) => this.fallar(fallo),
    });
  }

  // ---------- Step 2 ----------

  protected enviarCambioClave(cambio: CambioClave): void {
    if (this.ocupado() || !this.tokenTemporal) return;
    this.ocupar();
    this.auth.cambiarClave(cambio.actual, cambio.nueva, this.tokenTemporal).subscribe({
      next: (respuesta) => {
        this.cambiarClave()?.limpiar();
        this.procesar(respuesta);
      },
      error: (fallo: unknown) => this.fallar(fallo),
    });
  }

  // ---------- Steps 3 and 4 ----------

  protected enviarActivacion(codigo: string): void {
    if (this.ocupado() || !this.tokenTemporal) return;
    this.ocupar();
    this.auth.activarMfa(codigo, this.tokenTemporal).subscribe({
      next: (respuesta) => this.procesar(respuesta),
      error: (fallo: unknown) => this.fallar(fallo),
    });
  }

  protected enviarVerificacion(codigo: string): void {
    if (this.ocupado() || !this.tokenTemporal) return;
    this.ocupar();
    this.auth.verificarMfa(codigo, this.tokenTemporal).subscribe({
      next: (respuesta) => this.procesar(respuesta),
      error: (fallo: unknown) => this.fallar(fallo),
    });
  }

  protected enviarRespaldo(codigo: string): void {
    if (this.ocupado() || !this.tokenTemporal) return;
    this.ocupar();
    this.auth.usarCodigoRespaldo(codigo, this.tokenTemporal).subscribe({
      next: (respuesta) => this.procesar(respuesta),
      error: (fallo: unknown) => this.fallar(fallo),
    });
  }

  /** "Continuar" on the codes screen: they are dropped and the person goes in. */
  protected continuarTrasCodigos(): void {
    this.codigosRespaldo.set(null);
    this.entrar();
  }

  /** Back to step 1 and forget the temporary token. */
  protected volver(): void {
    this.reiniciar(null);
  }

  // ---------- Flow ----------

  private procesar(respuesta: AuthResponse): void {
    this.ocupado.set(false);
    switch (respuesta.estado) {
      case 'OK':
        this.tokenTemporal = null;
        // A second factor was just activated: do not go in until the person has saved the codes.
        if (respuesta.codigos_respaldo?.length) {
          this.codigosRespaldo.set(respuesta.codigos_respaldo);
          this.error.set(null);
          this.aviso.set(null);
          this.paso.set('codigos-respaldo');
          return;
        }
        this.entrar();
        return;
      case 'CAMBIAR_CLAVE':
        this.irA('cambiar-clave', respuesta.token_temporal);
        return;
      case 'MFA_ENROLAR':
        this.irA('mfa-enrolar', respuesta.token_temporal);
        this.cargarConfiguracionMfa();
        return;
      case 'MFA_REQUERIDO':
        this.irA('mfa-codigo', respuesta.token_temporal);
        return;
      default:
        this.error.set('No se pudo continuar con el inicio de sesión. Intenta de nuevo.');
    }
  }

  private entrar(): void {
    void this.router.navigateByUrl(urlRetornoSegura(this.route.snapshot.queryParamMap.get('return')));
  }

  private irA(paso: PasoLogin, tokenTemporal: string | undefined): void {
    this.tokenTemporal = tokenTemporal ?? null;
    this.error.set(null);
    this.aviso.set(null);
    this.form.controls.clave.reset('');
    this.usarRespaldo.set(false);
    this.paso.set(paso);
  }

  private cargarConfiguracionMfa(): void {
    this.mfaConfig.set(null);
    if (!this.tokenTemporal) return;
    this.auth.configurarMfa(this.tokenTemporal).subscribe({
      next: (config) => this.mfaConfig.set(config),
      error: (fallo: unknown) => this.fallar(fallo),
    });
  }

  private fallar(fallo: unknown): void {
    this.ocupado.set(false);
    // A step token that expired: the whole flow starts again (not for the first step, where 20013 is "wrong credentials").
    if (this.paso() !== 'credenciales' && esSesionVencida(fallo)) {
      this.reiniciar('Tu intento de inicio de sesión venció. Ingresa de nuevo.');
      return;
    }
    // The server's message as it is: the 20013 ones are generic on purpose and never say whether the user exists.
    this.error.set(this.errores.describe(fallo).mensaje);
  }

  private reiniciar(aviso: string | null): void {
    this.tokenTemporal = null;
    this.mfaConfig.set(null);
    this.ocupado.set(false);
    this.error.set(null);
    this.aviso.set(aviso);
    this.form.controls.clave.reset('');
    this.usarRespaldo.set(false);
    this.codigosRespaldo.set(null);
    this.paso.set('credenciales');
  }

  private ocupar(): void {
    this.ocupado.set(true);
    this.error.set(null);
  }
}
