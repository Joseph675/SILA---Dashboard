import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';
import type { Passkey } from '../../core/auth/auth.models';
import { sugerirNombreDispositivo } from '../../core/auth/webauthn';
import { AuthService } from '../../core/services/auth.service';
import { PasskeyError, PasskeyService } from '../../core/services/passkey.service';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoFechaHora } from '../../shared/utils/formato-co';
import { SilaValidators, limpiarTexto } from '../../shared/validators/sila-validators';
import { CampoCodigoMfaComponent } from './campo-codigo-mfa.component';
import { describirErrorSensible } from './errores-mfa';

/**
 * «Face ID / huella» of «Mi cuenta»: the devices registered as an ADDITIONAL second factor (the app code and the backup
 * codes keep working). It needs the second factor on; adding a device asks for an app / backup code. The face or
 * fingerprint never leaves the phone: the server only keeps a public key.
 */
@Component({
  selector: 'app-passkeys-seccion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 lg:col-span-2' },
  imports: [CampoCodigoMfaComponent, ConfirmDialogComponent, DialogComponent, FormFieldComponent, IconComponent, ReactiveFormsModule],
  template: `
    <section class="sila-card min-w-0 p-5" aria-labelledby="cuenta-passkeys">
      <h2 id="cuenta-passkeys" class="mb-1 text-base font-semibold">Face ID / huella</h2>
      <p class="mb-4 text-sm text-muted-foreground" data-testid="ayuda-passkeys">
        Tu cara o tu huella nunca salen del teléfono; SILA solo guarda una llave pública. El registro sirve solo en esta dirección web.
      </p>

      @if (!mfaActivo()) {
        <p class="rounded-md bg-muted px-3 py-2 text-sm" data-testid="requiere-mfa">
          Para usar Face ID / huella primero activa la aplicación de autenticación (el segundo factor), aquí arriba.
        </p>
      } @else {
        @if (lista.error()) {
          <div role="alert" class="mb-3 text-sm">
            No se pudo consultar tus dispositivos.
            <button type="button" class="underline" (click)="lista.reload()">Reintentar</button>
          </div>
        } @else if (lista.hasValue()) {
          @if (lista.value().length === 0) {
            <p class="mb-3 text-sm text-muted-foreground" data-testid="sin-passkeys">Todavía no registraste ningún dispositivo.</p>
          } @else {
            <ul class="mb-4 divide-y divide-border rounded-lg border border-border" aria-label="Dispositivos con Face ID / huella" data-testid="lista-passkeys">
              @for (p of lista.value(); track p.id_passkey) {
                <li class="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                  <div class="min-w-0">
                    <p class="flex items-center gap-2 text-sm font-medium">
                      <app-icon name="lucideScanFace" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span class="break-words">{{ p.nombre }}</span>
                    </p>
                    <p class="text-xs text-muted-foreground">
                      Registrado el {{ fecha(p.fecha_creacion) }} · Último uso: {{ p.fecha_ultimo_uso ? fecha(p.fecha_ultimo_uso) : 'nunca' }}
                    </p>
                  </div>
                  <button type="button" class="sila-btn sila-btn-outline sila-btn-sm text-destructive" data-testid="quitar-passkey" (click)="quitando.set(p)">
                    Quitar<span class="sr-only"> {{ p.nombre }}</span>
                  </button>
                </li>
              }
            </ul>
          }
        } @else {
          <p class="mb-3 text-sm text-muted-foreground" aria-busy="true">Cargando…</p>
        }

        @if (soportado()) {
          <button type="button" class="sila-btn sila-btn-outline" data-testid="agregar-passkey" (click)="abrir()">
            <app-icon name="lucidePlus" class="size-4" aria-hidden="true" />
            Agregar este dispositivo
          </button>
        } @else {
          <p class="text-xs text-muted-foreground" data-testid="no-soportado">Este navegador o dispositivo no permite registrar Face ID / huella.</p>
        }
      }
    </section>

    <app-dialog [open]="agregando()" title="Agregar este dispositivo" description="Usarás tu cara o tu huella en lugar del código de 6 dígitos." (closed)="cerrar()">
      <form [formGroup]="form" (ngSubmit)="agregar()" novalidate class="space-y-4" id="form-passkey">
        <app-form-field etiqueta="Nombre del dispositivo" ayuda="Para reconocerlo después, por ejemplo «iPhone — Safari»." [obligatorio]="true">
          <input class="sila-input" type="text" formControlName="nombre" maxlength="60" autocomplete="off" />
        </app-form-field>
        <app-campo-codigo-mfa [control]="form.controls.codigo" [error]="errorCodigo()" />
        @if (aviso(); as mensaje) {
          <p class="rounded-md bg-primary/10 px-3 py-2 text-sm" role="status" data-testid="aviso-passkey">{{ mensaje }}</p>
        }
        @if (error(); as mensaje) {
          <p class="rounded-md bg-destructive/15 px-3 py-2 text-sm" role="alert" data-testid="error-passkey">{{ mensaje }}</p>
        }
        <button type="submit" class="sr-only" tabindex="-1">Continuar</button>
      </form>
      <div dialogFooter class="flex flex-wrap justify-end gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="ocupado()" (click)="cerrar()">Cancelar</button>
        <button type="button" class="sila-btn sila-btn-primary" data-testid="continuar-passkey" [disabled]="ocupado()" [attr.aria-busy]="ocupado()" (click)="agregar()">
          {{ ocupado() ? 'Registrando…' : 'Continuar' }}
        </button>
      </div>
    </app-dialog>

    <app-confirm-dialog
      [open]="quitando() !== null"
      titulo="Quitar dispositivo"
      [mensaje]="'«' + (quitando()?.nombre ?? '') + '» dejará de servir para entrar con Face ID / huella. Podrás seguir entrando con el código de tu app o con un código de respaldo.'"
      textoConfirmar="Quitar"
      [peligro]="true"
      [ocupado]="procesando()"
      (confirmar)="quitar()"
      (cancelar)="quitando.set(null)"
    />
  `,
})
export class PasskeysSeccionComponent {
  private readonly auth = inject(AuthService);
  private readonly passkey = inject(PasskeyService);
  private readonly errores = inject(ApiErrorService);
  private readonly toast = inject(ToastService);

  /** The section only works with the second factor on. */
  readonly mfaActivo = input.required<boolean>();

  protected readonly fecha = formatoFechaHora;
  protected readonly soportado = signal(false);

  protected readonly lista = rxResource({
    params: () => (this.mfaActivo() ? true : undefined),
    stream: () => this.auth.listarPasskeys(),
  });

  protected readonly agregando = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorCodigo = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: ['', [SilaValidators.requerido, SilaValidators.longitud(1, 60)]],
    codigo: [''],
  });

  protected readonly quitando = signal<Passkey | null>(null);
  protected readonly procesando = signal(false);
  protected readonly cantidad = computed(() => (this.lista.hasValue() ? this.lista.value().length : 0));

  constructor() {
    void this.passkey.soportado().then((si) => this.soportado.set(si));
  }

  protected abrir(): void {
    this.form.reset({ nombre: sugerirNombreDispositivo(navigator.userAgent), codigo: '' });
    this.error.set(null);
    this.errorCodigo.set(null);
    this.aviso.set(null);
    this.agregando.set(true);
  }

  protected cerrar(): void {
    if (this.ocupado()) return;
    this.agregando.set(false);
    this.form.reset();
  }

  /** App code -> challenge -> system dialog (Face ID / fingerprint) -> the new public key goes to the server. */
  protected async agregar(): Promise<void> {
    if (this.ocupado()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { nombre, codigo } = this.form.getRawValue();
    this.ocupado.set(true);
    this.error.set(null);
    this.errorCodigo.set(null);
    this.aviso.set(null);
    try {
      const opciones = await firstValueFrom(this.auth.opcionesRegistroPasskey(codigo.trim()));
      const credencial = await this.passkey.crear(opciones);
      if (!credencial) {
        // The person closed the system dialog: soft notice, nothing red; the form stays as it was.
        this.aviso.set('Cancelaste el registro. Puedes intentarlo de nuevo cuando quieras.');
        return;
      }
      await firstValueFrom(this.auth.registrarPasskey(limpiarTexto(nombre), credencial));
      this.agregando.set(false);
      this.form.reset();
      this.lista.reload();
      this.toast.exito('Dispositivo agregado. Ya puedes entrar con Face ID / huella.');
    } catch (fallo) {
      if (fallo instanceof PasskeyError) {
        this.error.set(fallo.message);
      } else {
        // 400 / 401 / 409 come with the server's own text (venció, ya registrado, tope de 10, código incorrecto…).
        // `describirErrorSensible` reads 20006 as «e-mail in use» (the profile form); here a 409 can carry that same generic
        // code, so its text is the server's, as it is.
        const causa = causaDe(fallo);
        const e = isApiError(causa) && causa.code === 20006 ? { campo: null, mensaje: causa.message, limpiarCodigo: false } : describirErrorSensible(this.errores, fallo);
        if (e.campo === 'codigo') this.errorCodigo.set(e.mensaje);
        else this.error.set(e.mensaje);
        if (e.limpiarCodigo) this.form.controls.codigo.reset('');
      }
    } finally {
      this.ocupado.set(false);
    }
  }

  protected quitar(): void {
    const p = this.quitando();
    if (!p || this.procesando()) return;
    this.procesando.set(true);
    this.auth.quitarPasskey(p.id_passkey).subscribe({
      next: () => {
        this.procesando.set(false);
        this.quitando.set(null);
        this.lista.reload();
        this.toast.exito('Dispositivo quitado.');
      },
      error: (fallo: unknown) => {
        this.procesando.set(false);
        this.quitando.set(null);
        const { mensaje, supportRef } = this.errores.describe(fallo);
        this.toast.error(mensaje, supportRef);
        this.lista.reload();
      },
    });
  }
}
