import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { aplicarCamposDelServidor } from '../../shared/utils/errores-formulario';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { SilaValidators, limpiarTexto } from '../../shared/validators/sila-validators';
import { INSUMOS_REPOSITORY } from './data/insumos.provider';
import { Insumo, UNIDADES_INSUMO, UnidadInsumo } from './models/insumos.models';

/** Creates or edits an insumo [ADMIN]. The unit is the server's call once there are movements or a recipe (409 / 20006). */
@Component({
  selector: 'app-insumo-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule],
  template: `
    <app-dialog [open]="abierto()" [title]="insumo() ? 'Editar insumo' : 'Nuevo insumo'" [description]="insumo() ? insumo()!.codigo : 'Nace con stock 0 y costo 0: el stock entra con una compra.'" [cerrable]="!guardando()" (closed)="cerrar.emit()">
      <form id="insumo-form" [formGroup]="form" (ngSubmit)="guardar()" novalidate class="space-y-4">
        @if (errorGeneral(); as mensaje) {
          <p role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{{ mensaje }}</p>
        }
        @if (!insumo()) {
          <app-form-field etiqueta="Código" ayuda="3 a 20 caracteres: mayúsculas, números o guion." [obligatorio]="true">
            <input class="sila-input font-mono uppercase" formControlName="codigo" maxlength="20" autocomplete="off" />
          </app-form-field>
        }
        <app-form-field etiqueta="Nombre" ayuda="Máximo 100 caracteres." [obligatorio]="true">
          <input class="sila-input" formControlName="nombre" maxlength="100" autocomplete="off" />
        </app-form-field>
        <div class="grid gap-4 sm:grid-cols-2">
          <app-form-field etiqueta="Unidad de medida" [obligatorio]="true">
            <select class="sila-select" formControlName="unidad_medida">
              @for (u of unidades; track u) {
                <option [value]="u">{{ u }}</option>
              }
            </select>
          </app-form-field>
          <app-form-field etiqueta="Stock mínimo" ayuda="Por debajo de esto sale la alerta." [obligatorio]="true">
            <input class="sila-input" type="number" inputmode="decimal" min="0" step="0.01" formControlName="stock_minimo" />
          </app-form-field>
        </div>
      </form>
      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="guardando()" (click)="cerrar.emit()">Cancelar</button>
        <button type="submit" form="insumo-form" class="sila-btn sila-btn-primary" [disabled]="guardando()" [attr.aria-busy]="guardando()">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button>
      </div>
    </app-dialog>
  `,
})
export class InsumoDialogComponent {
  private readonly repo = inject(INSUMOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly abierto = input(false);
  /** When set, that insumo is edited; otherwise a new one is created. */
  readonly insumo = input<Insumo | null>(null);
  readonly guardado = output<Insumo>();
  readonly cerrar = output<void>();

  protected readonly unidades = UNIDADES_INSUMO;
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    codigo: ['', [SilaValidators.requerido, SilaValidators.sku]],
    nombre: ['', [SilaValidators.requerido, SilaValidators.longitud(2, 100)]],
    unidad_medida: ['KG' as UnidadInsumo, [SilaValidators.requerido]],
    stock_minimo: [0 as number | null, [SilaValidators.requerido, SilaValidators.rango(0, 1_000_000_000)]],
  });

  constructor() {
    effect(() => {
      if (!this.abierto()) return;
      const i = this.insumo();
      this.form.reset({ codigo: i?.codigo ?? '', nombre: i?.nombre ?? '', unidad_medida: i?.unidad_medida ?? 'KG', stock_minimo: i?.stock_minimo ?? 0 });
      if (i) this.form.controls.codigo.disable();
      else this.form.controls.codigo.enable();
      this.errorGeneral.set(null);
      this.guardando.set(false);
    });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const v = this.form.getRawValue();
    const base = { nombre: limpiarTexto(v.nombre), unidad_medida: v.unidad_medida, stock_minimo: Number(v.stock_minimo) };
    const actual = this.insumo();
    this.guardando.set(true);
    this.errorGeneral.set(null);
    const peticion = actual ? this.repo.actualizar(actual.id_insumo, base) : this.repo.crear({ ...base, codigo: v.codigo.trim().toUpperCase() });
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (insumo) => {
        this.guardando.set(false);
        this.guardado.emit(insumo);
      },
      error: (fallo: unknown) => {
        this.guardando.set(false);
        const error = causaDe(fallo);
        if (isApiError(error) && error.code === 20001) {
          const resto = aplicarCamposDelServidor(this.form, error.fields);
          this.errorGeneral.set(resto.length > 0 ? `${error.message} ${resto.join('; ')}` : 'Hay datos inválidos. Revisa los campos marcados.');
          return;
        }
        if (isApiError(error) && error.code === 20006 && !actual) this.form.controls.codigo.setErrors({ duplicado: true });
        // 20006 on edit: the unit cannot change (movements or recipes); the server's message says why.
        this.errorGeneral.set(mensajeDeFallo(this.errores, fallo, [20006, 20007]));
      },
    });
  }
}
