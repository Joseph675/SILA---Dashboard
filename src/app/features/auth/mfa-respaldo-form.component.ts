import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { SilaValidators } from '../../shared/validators/sila-validators';

/** Backup code without hyphen or spaces: 10 letters/digits. */
const FORMATO = /^[A-Z0-9]{10}$/;

/** `ab cde-fghij` -> `ABCDEFGHIJ` */
export function normalizarCodigoRespaldo(valor: string): string {
  return valor.toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Field for a backup code (lost phone). Accepts it in lower case, with or without
 * hyphen and spaces, and sends it as `XXXXX-XXXXX`. After a failed attempt it clears
 * the field and puts the cursor back.
 */
@Component({
  selector: 'app-mfa-respaldo-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldComponent, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="enviar()" novalidate class="space-y-4">
      <app-form-field etiqueta="Código de respaldo" ayuda="Uno de los 10 que guardaste. Con o sin guion. Cada uno sirve una sola vez." [obligatorio]="true">
        <input
          class="sila-input text-center font-mono text-base uppercase tracking-widest"
          formControlName="codigo"
          autocomplete="off"
          autocapitalize="characters"
          autocorrect="off"
          spellcheck="false"
          maxlength="24"
          (input)="alEscribir()"
        />
      </app-form-field>

      @if (error(); as mensaje) {
        <p class="rounded-md bg-destructive/15 px-3 py-2 text-sm" role="alert">{{ mensaje }}</p>
      }

      <button type="submit" class="sila-btn sila-btn-primary w-full" [disabled]="ocupado()" [attr.aria-busy]="ocupado()">
        {{ ocupado() ? 'Procesando…' : 'Entrar con el código de respaldo' }}
      </button>
    </form>
  `,
})
export class MfaRespaldoFormComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly ocupado = input(false);
  readonly error = input<string | null>(null);
  readonly enfocar = input(false);

  readonly codigo = output<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    codigo: ['', [SilaValidators.requerido, SilaValidators.codigoRespaldo]],
  });

  constructor() {
    afterNextRender(() => {
      if (this.enfocar()) this.campo()?.focus();
    });
    effect(() => {
      if (this.error()) {
        this.form.reset();
        this.campo()?.focus();
      }
    });
  }

  protected alEscribir(): void {
    const control = this.form.controls.codigo;
    const mayusculas = control.value.toUpperCase();
    if (mayusculas !== control.value) control.setValue(mayusculas);
  }

  protected enviar(): void {
    if (this.ocupado()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.campo()?.focus();
      return;
    }
    const limpio = normalizarCodigoRespaldo(this.form.controls.codigo.value);
    if (!FORMATO.test(limpio)) return;
    this.codigo.emit(`${limpio.slice(0, 5)}-${limpio.slice(5)}`);
  }

  private campo(): HTMLInputElement | null {
    return this.host.nativeElement.querySelector('input');
  }
}
