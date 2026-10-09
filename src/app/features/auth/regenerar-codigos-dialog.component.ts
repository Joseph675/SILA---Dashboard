import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { CampoCodigoMfaComponent } from './campo-codigo-mfa.component';
import { SilaValidators } from '../../shared/validators/sila-validators';

/** Asks for the CURRENT password before generating new backup codes (the old ones stop working). The parent makes the call. */
@Component({
  selector: 'app-regenerar-codigos-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CampoCodigoMfaComponent, DialogComponent, FormFieldComponent, ReactiveFormsModule],
  template: `
    <app-dialog [open]="abierto()" title="Generar códigos nuevos" (closed)="cancelar.emit()">
      <p class="mb-4 rounded-md bg-warning/20 px-3 py-2 text-sm">Los códigos de respaldo anteriores dejarán de servir.</p>
      <form id="regenerar-codigos-form" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        <app-form-field etiqueta="Tu clave actual" ayuda="La pedimos para confirmar que eres tú." [obligatorio]="true">
          <input class="sila-input" type="password" formControlName="clave" autocomplete="current-password" maxlength="200" />
        </app-form-field>
        <div class="mt-4">
          <app-campo-codigo-mfa [control]="form.controls.codigo" [error]="errorCodigo()" />
        </div>
      </form>

      @if (error(); as mensaje) {
        <p class="mt-4 rounded-md bg-destructive/15 px-3 py-2 text-sm" role="alert">{{ mensaje }}</p>
      }

      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="ocupado()" (click)="cancelar.emit()">Cancelar</button>
        <button type="submit" form="regenerar-codigos-form" class="sila-btn sila-btn-primary" [disabled]="ocupado()" [attr.aria-busy]="ocupado()">
          {{ ocupado() ? 'Generando…' : 'Generar códigos nuevos' }}
        </button>
      </div>
    </app-dialog>
  `,
})
export class RegenerarCodigosDialogComponent {
  readonly abierto = input(false);
  readonly ocupado = input(false);
  readonly error = input<string | null>(null);
  readonly errorCodigo = input<string | null>(null);

  readonly confirmar = output<{ clave: string; codigo: string }>();
  readonly cancelar = output<void>();

  protected readonly form = inject(NonNullableFormBuilder).group({ clave: ['', [SilaValidators.requerido]], codigo: [''] });

  constructor() {
    // Each opening starts with an empty field: the password is not kept between uses.
    effect(() => {
      if (this.abierto()) this.form.reset();
    });
  }

  protected enviar(): void {
    if (this.ocupado()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.confirmar.emit({ clave: this.form.controls.clave.value, codigo: this.form.controls.codigo.value.trim() });
  }

  /** The parent calls these: the typed values stay only while the action can still be retried. */
  limpiar(): void {
    this.form.reset();
  }

  limpiarCodigo(): void {
    this.form.controls.codigo.reset('');
  }
}
