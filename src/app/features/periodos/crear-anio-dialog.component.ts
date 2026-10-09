import { ChangeDetectionStrategy, Component, effect, inject, input, output, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { SilaValidators } from '../../shared/validators/sila-validators';

/** Asks for the year whose 24 quincenas will be created. The page makes the API call. */
@Component({
  selector: 'app-crear-anio-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule],
  template: `
    <app-dialog
      [open]="abierto()"
      title="Crear períodos de un año"
      description="Se crean las 24 quincenas del año. Si el año ya existe, no se duplica nada."
      (closed)="cerrar.emit()"
    >
      <form id="crear-anio-form" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        <app-form-field etiqueta="Año" ayuda="Entre 2000 y 2100." [obligatorio]="true">
          <input class="sila-input" type="number" inputmode="numeric" min="2000" max="2100" step="1" formControlName="anio" />
        </app-form-field>
      </form>

      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="ocupado()" (click)="cerrar.emit()">Cancelar</button>
        <button type="submit" form="crear-anio-form" class="sila-btn sila-btn-primary" [disabled]="ocupado()" [attr.aria-busy]="ocupado()">
          {{ ocupado() ? 'Creando…' : 'Crear períodos' }}
        </button>
      </div>
    </app-dialog>
  `,
})
export class CrearAnioDialogComponent {
  readonly abierto = input(false);
  /** Year proposed each time the dialog opens. */
  readonly sugerido = input.required<number>();
  readonly ocupado = input(false);

  readonly confirmar = output<number>();
  readonly cerrar = output<void>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    anio: [0, [SilaValidators.requerido, SilaValidators.entero, SilaValidators.rango(2000, 2100)]],
  });

  constructor() {
    effect(() => {
      if (this.abierto()) {
        const sugerido = untracked(() => this.sugerido());
        this.form.reset({ anio: sugerido });
      }
    });
  }

  protected enviar(): void {
    if (this.ocupado()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.confirmar.emit(Number(this.form.controls.anio.value));
  }
}
