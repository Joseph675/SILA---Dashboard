import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import type { Observable } from 'rxjs';
import { ApiErrorService, isApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/services/auth.service';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { formatoNumero } from '../../../shared/utils/formato-co';
import { SilaValidators, limpiarTexto } from '../../../shared/validators/sila-validators';
import { LineaEdicion, RecetaEditorComponent, validarReceta } from '../recetas/receta-editor.component';
import { PARAMETROS_REPOSITORY } from '../../parametros/data/parametros.provider';
import { CATALOGOS_REPOSITORY } from '../data/catalogos.provider';
import { Producto, UNIDADES_MEDIDA, UnidadMedida } from '../models/catalogos.models';

/** crear [ADMIN]: every field. editar: name and unit. precio [ADMIN]: base price and VAT rate. */
export type ModoProducto = 'crear' | 'editar' | 'precio' | 'minimo';

/** Optional; 0 to 99.999.999 with at most 3 decimals. Empty is valid (no minimum). */
function stockMinimoValido(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 99_999_999) return { servidor: 'Debe estar entre 0 y 99.999.999.' };
  return Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6 ? null : { servidor: 'Máximo 3 decimales.' };
}

const TITULOS: Record<ModoProducto, string> = {
  crear: 'Nuevo producto',
  editar: 'Editar producto',
  precio: 'Cambiar precio',
  minimo: 'Stock mínimo (alerta)',
};

@Component({
  selector: 'app-producto-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule, RecetaEditorComponent],
  templateUrl: './producto-form-dialog.component.html',
})
export class ProductoFormDialogComponent {
  private readonly repo = inject(CATALOGOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  /** Optional: without it (or if it fails) the proposed IVA is 19. */
  private readonly parametros = inject(PARAMETROS_REPOSITORY, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  protected readonly esAdmin = computed(() => this.auth.hasRole('ADMIN'));
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly modo = input<ModoProducto>('crear');
  readonly producto = input<Producto | null>(null);
  readonly abierto = input(false);

  readonly guardado = output<Producto>();
  /**
   * The product was created but its recipe was NOT saved (two steps in the database). Retrying the creation would
   * duplicate the SKU, so the page opens the recipe editor of that product instead.
   */
  readonly recetaFallida = output<{ idProducto: number; mensaje: string }>();
  readonly cerrar = output<void>();

  protected readonly unidades = UNIDADES_MEDIDA;
  protected readonly titulo = computed(() => TITULOS[this.modo()]);
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly numero = formatoNumero;
  protected readonly receta = signal<LineaEdicion[]>([]);
  protected readonly errorReceta = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    codigo_sku: ['', [SilaValidators.requerido, SilaValidators.sku]],
    nombre: ['', [SilaValidators.requerido, SilaValidators.longitud(1, 100)]],
    unidad_medida: ['UND' as UnidadMedida, Validators.required],
    precio_base: [0, [SilaValidators.requerido, SilaValidators.rango(0, 999_999_999)]],
    tarifa_iva: [0, [SilaValidators.requerido, SilaValidators.rango(0, 100)]],
    stock_minimo: [null as number | null, [stockMinimoValido]],
  });

  constructor() {
    effect(() => {
      if (!this.abierto()) return;
      const producto = this.producto();
      const modo = this.modo();
      this.errorGeneral.set(null);
      this.receta.set([]);
      this.errorReceta.set(null);
      this.form.reset({
        codigo_sku: producto?.codigo_sku ?? '',
        nombre: producto?.nombre ?? '',
        unidad_medida: producto?.unidad_medida ?? 'UND',
        precio_base: producto?.precio_base ?? 0,
        tarifa_iva: producto?.tarifa_iva ?? 0,
        stock_minimo: producto && producto.stock_minimo > 0 ? producto.stock_minimo : null,
      });
      // Only the fields of the current mode are validated and sent.
      const { codigo_sku, nombre, unidad_medida, precio_base, tarifa_iva, stock_minimo } = this.form.controls;
      const activar = (control: { enable(): void; disable(): void }, si: boolean) => (si ? control.enable() : control.disable());
      activar(codigo_sku, modo === 'crear');
      activar(nombre, modo === 'crear' || modo === 'editar');
      activar(unidad_medida, modo === 'crear' || modo === 'editar');
      activar(precio_base, modo === 'crear' || modo === 'precio');
      activar(tarifa_iva, modo === 'crear' || modo === 'precio');
      // Only an ADMIN sets the alert threshold (the server rejects anyone else with 403 / 20008); the others see it read-only.
      activar(stock_minimo, modo !== 'precio' && untracked(() => this.esAdmin()));
      stock_minimo.setValidators(modo === 'minimo' ? [SilaValidators.requerido, stockMinimoValido] : [stockMinimoValido]);
      stock_minimo.updateValueAndValidity({ emitEvent: false });

      // SUPUESTO: VC-12. El IVA de un producto NUEVO se propone con el parámetro IVA_DEFECTO_PORCENTAJE (19 si no se puede leer);
      // solo se aplica si la persona aún no tocó el campo.
      if (modo === 'crear' && !producto) {
        tarifa_iva.setValue(19);
        this.parametros
          ?.listar()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (lista) => {
              const iva = lista.find((p) => p.clave === 'IVA_DEFECTO_PORCENTAJE');
              if (iva && tarifa_iva.pristine) tarifa_iva.setValue(iva.valor);
            },
            error: () => undefined,
          });
      }
    });
  }

  /** SKU is typed in uppercase as the rule requires. */
  protected aMayusculas(): void {
    const control = this.form.controls.codigo_sku;
    control.setValue(control.value.toUpperCase(), { emitEvent: false });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.enfocarPrimerError();
      return;
    }
    const valor = this.form.getRawValue();
    const actual = this.producto();
    let peticion: Observable<Producto>;
    switch (this.modo()) {
      case 'crear': {
        const { lineas, error } = validarReceta(this.receta());
        this.errorReceta.set(error);
        if (error) return;
        peticion = this.repo.crearProducto({
          codigo_sku: valor.codigo_sku.trim(),
          nombre: limpiarTexto(valor.nombre),
          unidad_medida: valor.unidad_medida,
          precio_base: Number(valor.precio_base),
          tarifa_iva: Number(valor.tarifa_iva),
          ...(lineas.length > 0 ? { receta: lineas } : {}),
          ...(valor.stock_minimo !== null && valor.stock_minimo !== undefined ? { stock_minimo: Number(valor.stock_minimo) } : {}),
        });
        break;
      }
      case 'editar':
        // SUPUESTO: SM-02. Un ADMIN envía el mínimo solo si lo escribió y cambió; un OPERATIVO nunca lo envía (daría 403).
        peticion = this.repo.actualizarProducto(actual!.id_producto, {
          nombre: limpiarTexto(valor.nombre),
          unidad_medida: valor.unidad_medida,
          ...(this.esAdmin() && valor.stock_minimo !== null && valor.stock_minimo !== undefined && Number(valor.stock_minimo) !== actual!.stock_minimo ? { stock_minimo: Number(valor.stock_minimo) } : {}),
        });
        break;
      case 'minimo':
        peticion = this.repo.cambiarStockMinimoProducto(actual!.id_producto, Number(valor.stock_minimo));
        break;
      case 'precio':
        peticion = this.repo.cambiarPrecioProducto(actual!.id_producto, { precio_base: Number(valor.precio_base), tarifa_iva: Number(valor.tarifa_iva) });
        break;
    }

    this.guardando.set(true);
    this.errorGeneral.set(null);
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (producto) => {
        this.guardando.set(false);
        this.guardado.emit(producto);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        // «El producto se creó (id N) pero la receta no se guardó…»: the product EXISTS; do not offer to create it again.
        const parcial = isApiError(error) && this.modo() === 'crear' ? /se cre[óo] \(id (\d+)\)/i.exec(error.message) : null;
        if (parcial && isApiError(error)) {
          this.recetaFallida.emit({ idProducto: Number(parcial[1]), mensaje: error.message });
          return;
        }
        if (isApiError(error) && error.code === 20006 && this.modo() === 'crear') {
          this.form.controls.codigo_sku.setErrors({ duplicado: true });
          this.enfocarPrimerError();
        }
        this.errorGeneral.set(this.errores.describe(error).mensaje);
      },
    });
  }

  private enfocarPrimerError(): void {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }
}
