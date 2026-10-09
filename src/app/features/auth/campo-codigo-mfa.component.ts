import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { mensajeDeError } from '../../shared/validators/sila-validators';

let siguiente = 0;

/** 6 digits from the app, or (backup mode) 6 to 30 characters. The server accepts a backup code in lower case and with or without hyphen. */
function validador(respaldo: boolean) {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = String(control.value ?? '').trim();
    if (valor === '') return { codigoMfa: 'Escribe el código.' };
    if (respaldo) return valor.length >= 6 && valor.length <= 30 ? null : { codigoMfa: 'Escribe tu código de respaldo completo.' };
    return /^\d{6}$/.test(valor) ? null : { codigoMfa: 'Son 6 dígitos, los que muestra tu app.' };
  };
}

/** The second-factor code field of the sensitive actions, with the «Usar un código de respaldo» switch. The parent owns the control. */
@Component({
  selector: 'app-campo-codigo-mfa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="space-y-1.5">
      <label [for]="id" class="text-sm font-medium">
        {{ respaldo() ? 'Código de respaldo' : 'Código de tu app de autenticación' }}
        <span class="text-destructive" aria-hidden="true">*</span>
      </label>
      @if (respaldo()) {
        <input [id]="id" class="sila-input font-mono" type="text" [formControl]="control()" maxlength="30" autocomplete="off" [attr.aria-invalid]="mensaje() ? 'true' : null" [attr.aria-describedby]="id + '-ayuda ' + id + '-error'" />
      } @else {
        <input [id]="id" class="sila-input font-mono tracking-widest" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" [formControl]="control()" [attr.aria-invalid]="mensaje() ? 'true' : null" [attr.aria-describedby]="id + '-ayuda ' + id + '-error'" />
      }
      <p [id]="id + '-ayuda'" class="text-xs text-muted-foreground">5 códigos incorrectos bloquean tu cuenta 15 minutos.</p>
      <p [id]="id + '-error'" class="text-xs font-medium text-destructive" aria-live="polite">{{ mensaje() }}</p>
      <button type="button" class="text-xs underline" (click)="alternar()">{{ respaldo() ? 'Usar el código de mi app' : 'Usar un código de respaldo' }}</button>
    </div>
  `,
})
export class CampoCodigoMfaComponent {
  readonly control = input.required<FormControl<string>>();
  /** A failure the server reported about this field (wrong code, already used…). */
  readonly error = input<string | null>(null);

  protected readonly id = `codigo-mfa-${siguiente++}`;
  protected readonly respaldo = signal(false);

  /** Revision counter: the control changes outside signals, so the message is recomputed when it does. */
  private readonly revision = signal(0);
  protected readonly mensaje = computed(() => {
    this.revision();
    const c = this.control();
    return this.error() ?? (c.invalid && c.touched ? mensajeDeError(c.errors) : null);
  });

  constructor() {
    effect((onCleanup) => {
      const c = this.control();
      c.setValidators(validador(this.respaldo()));
      c.updateValueAndValidity({ emitEvent: false });
      const sub = c.events.subscribe(() => this.revision.update((n) => n + 1));
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected alternar(): void {
    this.respaldo.update((v) => !v);
    this.control().reset('');
  }
}
