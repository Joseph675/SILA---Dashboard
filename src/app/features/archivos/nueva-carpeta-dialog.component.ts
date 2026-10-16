import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiErrorService } from '../../core/api/api-error';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { SilaValidators, limpiarTexto } from '../../shared/validators/sila-validators';
import { ARCHIVOS_REPOSITORY } from './data/archivos.provider';
import type { Carpeta } from './models/archivos.models';

/** «Nueva carpeta» (ADMIN, only inside «Mis carpetas»). 1–80 characters, no `/` or `\`; the server rejects a repeated name or a 6th level (409). */
@Component({
  selector: 'app-nueva-carpeta-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule],
  template: `
    <app-dialog [open]="abierto()" title="Nueva carpeta" description="Máximo 5 niveles. No se pueden renombrar ni mover." (closed)="cerrar.emit()">
      <form [formGroup]="form" (ngSubmit)="crear()" novalidate id="form-nueva-carpeta">
        <app-form-field etiqueta="Nombre de la carpeta" ayuda="Entre 1 y 80 caracteres, sin «/» ni «\\»." [obligatorio]="true">
          <input class="sila-input" type="text" formControlName="nombre" maxlength="80" autocomplete="off" data-testid="nombre-carpeta" />
        </app-form-field>
        @if (error(); as e) {
          <p class="mt-3 rounded-md bg-destructive/15 px-3 py-2 text-sm" role="alert" data-testid="error-carpeta">{{ e }}</p>
        }
      </form>
      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="ocupado()" (click)="cerrar.emit()">Cancelar</button>
        <button type="submit" form="form-nueva-carpeta" class="sila-btn sila-btn-primary" data-testid="crear-carpeta" [disabled]="ocupado()">{{ ocupado() ? 'Creando…' : 'Crear carpeta' }}</button>
      </div>
    </app-dialog>
  `,
})
export class NuevaCarpetaDialogComponent {
  private readonly repo = inject(ARCHIVOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);

  readonly abierto = input(false);
  /** The folder it goes into; `null` = the root of «Mis carpetas». */
  readonly idPadre = input<number | null>(null);
  readonly creada = output<Carpeta>();
  readonly cerrar = output<void>();

  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: ['', [SilaValidators.requerido, SilaValidators.longitud(1, 80), SilaValidators.sinBarras]],
  });

  constructor() {
    effect(() => {
      if (this.abierto()) {
        this.form.reset({ nombre: '' });
        this.error.set(null);
      }
    });
  }

  protected async crear(): Promise<void> {
    if (this.ocupado()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.ocupado.set(true);
    this.error.set(null);
    try {
      const carpeta = await firstValueFrom(this.repo.crearCarpeta(limpiarTexto(this.form.getRawValue().nombre), this.idPadre()));
      this.creada.emit(carpeta);
    } catch (fallo) {
      this.error.set(this.errores.describe(fallo).mensaje);
    } finally {
      this.ocupado.set(false);
    }
  }
}
