import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';

/**
 * 6-digit code field (authenticator app). It sends by itself when the sixth
 * digit is typed, or with the button. After a failed attempt it clears the
 * field and puts the cursor back so the next code can be typed.
 */
@Component({
  selector: 'app-mfa-codigo-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldComponent, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="enviar()" novalidate class="space-y-4">
      <app-form-field etiqueta="Código de 6 dígitos" ayuda="Lo muestra tu aplicación de autenticación y cambia cada 30 segundos." [obligatorio]="true">
        <input
          class="sila-input text-center font-mono text-lg tracking-[0.4em]"
          formControlName="codigo"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          (input)="alEscribir()"
        />
      </app-form-field>

      @if (error(); as mensaje) {
        <p class="rounded-md bg-destructive/15 px-3 py-2 text-sm" role="alert">{{ mensaje }}</p>
      }

      <button type="submit" class="sila-btn sila-btn-primary w-full" [disabled]="ocupado()" [attr.aria-busy]="ocupado()">
        {{ ocupado() ? 'Procesando…' : textoBoton() }}
      </button>
    </form>
  `,
})
export class MfaCodigoFormComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly textoBoton = input('Verificar');
  readonly ocupado = input(false);
  readonly error = input<string | null>(null);
  readonly enfocar = input(false);

  readonly codigo = output<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
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

  /** Keeps digits only and sends at the sixth one. */
  protected alEscribir(): void {
    const control = this.form.controls.codigo;
    const soloDigitos = control.value.replace(/\D/g, '').slice(0, 6);
    if (soloDigitos !== control.value) control.setValue(soloDigitos);
    if (soloDigitos.length === 6) this.enviar();
  }

  protected enviar(): void {
    if (this.ocupado()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.campo()?.focus();
      return;
    }
    this.codigo.emit(this.form.controls.codigo.value);
  }

  private campo(): HTMLInputElement | null {
    return this.host.nativeElement.querySelector('input');
  }
}
