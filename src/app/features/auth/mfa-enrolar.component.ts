import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import type { MfaConfig } from '../../core/auth/auth.models';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { MfaCodigoFormComponent } from './mfa-codigo-form.component';

/**
 * Second-factor setup: QR of `otpauth_uri`, the secret as text for people who
 * cannot scan, and the field for the first code. The parent loads the config
 * and makes the activation call.
 *
 * The QR is a PNG data URL made in the browser; the URI never goes to any
 * external service. The secret is only shown here, never logged or stored.
 */
@Component({
  selector: 'app-mfa-enrolar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, MfaCodigoFormComponent],
  template: `
    <ol class="mb-4 list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
      <li>Instala Google Authenticator, Microsoft Authenticator o Authy en tu celular.</li>
      <li>Escanea este código QR desde la aplicación.</li>
      <li>Escribe aquí el código de 6 dígitos que muestre.</li>
    </ol>

    @if (config(); as c) {
      <div class="mb-4 flex flex-col items-center gap-3">
        @if (qr(); as imagen) {
          <img [src]="imagen" width="224" height="224" alt="Código QR para configurar el segundo factor" class="rounded-md border border-border bg-white" />
        } @else if (qrFallo()) {
          <p class="rounded-md bg-warning/20 px-3 py-2 text-sm" role="alert">No se pudo generar el código QR. Escribe la clave a mano en tu aplicación.</p>
        } @else {
          <div class="grid size-56 place-items-center rounded-md border border-border text-sm text-muted-foreground" role="status">Generando código QR…</div>
        }

        <details class="w-full text-sm" [open]="qrFallo()">
          <summary class="cursor-pointer text-muted-foreground">¿No puedes escanear? Escribe la clave a mano</summary>
          <div class="mt-2 flex items-center gap-2">
            <code class="flex-1 break-all rounded-md bg-muted px-2 py-1.5 font-mono text-xs">{{ c.secreto }}</code>
            <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="copiar(c.secreto)">
              <app-icon name="lucideCopy" class="size-3.5" aria-hidden="true" />
              {{ copiado() ? 'Copiada' : 'Copiar' }}
            </button>
          </div>
          <span class="sr-only" aria-live="polite">{{ copiado() ? 'Clave copiada' : '' }}</span>
        </details>
      </div>
    } @else if (!error()) {
      <p class="mb-4 text-sm text-muted-foreground" role="status">Preparando el código QR…</p>
    }

    <app-mfa-codigo-form [textoBoton]="textoBoton()" [ocupado]="ocupado()" [error]="error()" [enfocar]="enfocar()" (codigo)="activar.emit($event)" />
  `,
})
export class MfaEnrolarComponent {
  private readonly clipboard = inject(Clipboard);

  readonly config = input<MfaConfig | null>(null);
  readonly textoBoton = input('Activar y entrar');
  readonly ocupado = input(false);
  readonly error = input<string | null>(null);
  readonly enfocar = input(false);

  readonly activar = output<string>();

  protected readonly qr = signal<string | null>(null);
  protected readonly qrFallo = signal(false);
  protected readonly copiado = signal(false);

  constructor() {
    effect(() => {
      const config = this.config();
      this.qr.set(null);
      this.qrFallo.set(false);
      if (!config) return;
      // The library is loaded only when this step is reached.
      import('qrcode')
        .then((modulo) => {
          // `qrcode` is CommonJS: the production bundle exposes its functions under `default`
          // (dev server and tests expose them by name), so both shapes are accepted.
          type GeneradorQr = Pick<typeof modulo, 'toDataURL'>;
          const { toDataURL }: GeneradorQr = (modulo as unknown as { default?: GeneradorQr }).default ?? modulo;
          return toDataURL(config.otpauth_uri, { width: 224, margin: 2, errorCorrectionLevel: 'M' });
        })
        .then((imagen) => {
          // The user may have moved on while the library loaded.
          if (this.config() === config) this.qr.set(imagen);
        })
        .catch(() => this.qrFallo.set(true));
    });
  }

  protected copiar(secreto: string): void {
    if (this.clipboard.copy(secreto)) {
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    }
  }
}
