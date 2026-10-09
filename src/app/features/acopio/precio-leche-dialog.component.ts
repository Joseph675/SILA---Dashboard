import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { OpcionSelector, SelectorBuscableComponent } from '../../shared/ui/selector-buscable/selector-buscable.component';
import { aplicarCamposDelServidor } from '../../shared/utils/errores-formulario';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { hoyColombia } from '../../shared/utils/fecha-co';
import { SilaValidators } from '../../shared/validators/sila-validators';
import { ACOPIO_REPOSITORY } from './data/acopio.provider';
import type { PrecioProveedor } from './models/acopio.models';

function precioValido(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return n >= 0.01 && n <= 20000 ? null : { servidor: 'Debe estar entre 0,01 y 20.000 por litro.' };
}

/** Sets the price per liter of a lechero from a date on. It only affects NEW deliveries. ADMIN only (the server decides: 20008). */
@Component({
  selector: 'app-precio-leche-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule, SelectorBuscableComponent],
  template: `
    <app-dialog [open]="abierto()" title="Fijar precio de la leche" [cerrable]="!guardando()" (closed)="cerrar.emit()">
      <form id="precio-leche-form" [formGroup]="form" (ngSubmit)="guardar()" novalidate class="space-y-4">
        <p class="rounded-md bg-warning/15 px-3 py-2 text-sm" data-testid="aviso-precio">Solo afecta las entregas nuevas; las ya registradas conservan su precio.</p>
        @if (errorGeneral(); as mensaje) {
          <p role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" data-testid="error-precio">{{ mensaje }}</p>
        }
        <div class="space-y-1.5">
          <label for="precio-lechero" class="text-sm font-medium">Lechero <span class="text-destructive" aria-hidden="true">*</span></label>
          <app-selector-buscable idCampo="precio-lechero" [opciones]="proveedores()" [(valor)]="proveedor" [etiquetaVacia]="null" placeholder="Buscar lechero…" [invalido]="!!errorProveedor()" />
          <p class="text-xs font-medium text-destructive" aria-live="polite">{{ errorProveedor() }}</p>
        </div>
        <app-form-field etiqueta="Precio por litro (COP)" ayuda="Entre 0,01 y 20.000." [obligatorio]="true">
          <input class="sila-input" type="number" inputmode="decimal" min="0" step="0.01" formControlName="precio" />
        </app-form-field>
        <app-form-field etiqueta="Rige desde" ayuda="Por defecto, hoy." [obligatorio]="true">
          <input class="sila-input" type="date" formControlName="desde" />
        </app-form-field>
      </form>
      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="guardando()" (click)="cerrar.emit()">Cancelar</button>
        <button type="submit" form="precio-leche-form" class="sila-btn sila-btn-primary" [disabled]="guardando()" [attr.aria-busy]="guardando()">{{ guardando() ? 'Guardando…' : 'Fijar precio' }}</button>
      </div>
    </app-dialog>
  `,
})
export class PrecioLecheDialogComponent {
  private readonly repo = inject(ACOPIO_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  readonly abierto = input(false);
  readonly proveedores = input.required<readonly OpcionSelector[]>();
  readonly guardado = output<PrecioProveedor>();
  readonly cerrar = output<void>();

  protected readonly proveedor = signal<number | null>(null);
  private readonly tocado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly errorProveedor = () => (this.tocado() && this.proveedor() === null ? 'Elige el lechero.' : null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    precio: [null as number | null, [SilaValidators.requerido, SilaValidators.montoPositivo, precioValido]],
    desde: [hoyColombia(), [SilaValidators.requerido]],
  });

  constructor() {
    effect(() => {
      if (this.abierto()) {
        this.form.reset({ precio: null, desde: hoyColombia() });
        this.proveedor.set(null);
        this.tocado.set(false);
        this.errorGeneral.set(null);
        this.guardando.set(false);
      }
    });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    this.form.markAllAsTouched();
    this.tocado.set(true);
    const proveedor = this.proveedor();
    if (this.form.invalid || proveedor === null) return;
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.errorGeneral.set(null);
    // The API does not ask for Idempotency-Key here (setting a price is not an accumulation).
    this.repo
      .fijarPrecio({ id_proveedor: proveedor, precio_litro: Number(v.precio), vigente_desde: v.desde })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (precio) => {
          this.guardando.set(false);
          this.guardado.emit(precio);
        },
        error: (fallo: unknown) => {
          this.guardando.set(false);
          const error = causaDe(fallo);
          if (isApiError(error) && error.code === 20001) {
            const resto = aplicarCamposDelServidor(this.form, error.fields, { precio_litro: 'precio', vigente_desde: 'desde' });
            this.errorGeneral.set(resto.length > 0 ? `${error.message} ${resto.join('; ')}` : error.message);
            return;
          }
          this.errorGeneral.set(mensajeDeFallo(this.errores, fallo, [20006, 20007]));
        },
      });
  }
}
