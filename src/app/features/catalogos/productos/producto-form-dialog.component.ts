import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Observable } from 'rxjs';
import { ApiErrorService, isApiError } from '../../../core/api/api-error';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { formatoNumero } from '../../../shared/utils/formato-co';
import { SilaValidators, limpiarTexto } from '../../../shared/validators/sila-validators';
import { PARAMETROS_REPOSITORY } from '../../parametros/data/parametros.provider';
import { CATALOGOS_REPOSITORY } from '../data/catalogos.provider';
import { Producto, UNIDADES_MEDIDA, UnidadMedida } from '../models/catalogos.models';

/** crear [ADMIN]: every field. editar: name and unit. precio [ADMIN]: base price and VAT rate. */
export type ModoProducto = 'crear' | 'editar' | 'precio';

const TITULOS: Record<ModoProducto, string> = {
  crear: 'Nuevo producto',
  editar: 'Editar producto',
  precio: 'Cambiar precio',
};

@Component({
  selector: 'app-producto-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule],
  templateUrl: './producto-form-dialog.component.html',
})
export class ProductoFormDialogComponent {
  private readonly repo = inject(CATALOGOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  /** Optional: without it (or if it fails) the proposed IVA is 19. */
  private readonly parametros = inject(PARAMETROS_REPOSITORY, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly modo = input<ModoProducto>('crear');
  readonly producto = input<Producto | null>(null);
  readonly abierto = input(false);

  readonly guardado = output<Producto>();
  readonly cerrar = output<void>();

  protected readonly unidades = UNIDADES_MEDIDA;
  protected readonly titulo = computed(() => TITULOS[this.modo()]);
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly numero = formatoNumero;

  protected readonly form = inject(NonNullableFormBuilder).group({
    codigo_sku: ['', [SilaValidators.requerido, SilaValidators.sku]],
    nombre: ['', [SilaValidators.requerido, SilaValidators.longitud(1, 100)]],
    unidad_medida: ['UND' as UnidadMedida, Validators.required],
    precio_base: [0, [SilaValidators.requerido, SilaValidators.rango(0, 999_999_999)]],
    tarifa_iva: [0, [SilaValidators.requerido, SilaValidators.rango(0, 100)]],
  });

  constructor() {
    effect(() => {
      if (!this.abierto()) return;
      const producto = this.producto();
      const modo = this.modo();
      this.errorGeneral.set(null);
      this.form.reset({
        codigo_sku: producto?.codigo_sku ?? '',
        nombre: producto?.nombre ?? '',
        unidad_medida: producto?.unidad_medida ?? 'UND',
        precio_base: producto?.precio_base ?? 0,
        tarifa_iva: producto?.tarifa_iva ?? 0,
      });
      // Only the fields of the current mode are validated and sent.
      const { codigo_sku, nombre, unidad_medida, precio_base, tarifa_iva } = this.form.controls;
      const activar = (control: { enable(): void; disable(): void }, si: boolean) => (si ? control.enable() : control.disable());
      activar(codigo_sku, modo === 'crear');
      activar(nombre, modo !== 'precio');
      activar(unidad_medida, modo !== 'precio');
      activar(precio_base, modo !== 'editar');
      activar(tarifa_iva, modo !== 'editar');

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
      case 'crear':
        peticion = this.repo.crearProducto({
          codigo_sku: valor.codigo_sku.trim(),
          nombre: limpiarTexto(valor.nombre),
          unidad_medida: valor.unidad_medida,
          precio_base: Number(valor.precio_base),
          tarifa_iva: Number(valor.tarifa_iva),
        });
        break;
      case 'editar':
        peticion = this.repo.actualizarProducto(actual!.id_producto, { nombre: limpiarTexto(valor.nombre), unidad_medida: valor.unidad_medida });
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
