import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiErrorService, isApiError } from '../../../core/api/api-error';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { SilaValidators, limpiarTexto } from '../../../shared/validators/sila-validators';
import { CATALOGOS_REPOSITORY } from '../data/catalogos.provider';
import { Proveedor, ProveedorGuardar, TIPOS_DOCUMENTO, TIPOS_PROVEEDOR, TipoDocumento, TipoProveedor } from '../models/catalogos.models';

@Component({
  selector: 'app-proveedor-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule],
  templateUrl: './proveedor-form-dialog.component.html',
})
export class ProveedorFormDialogComponent {
  private readonly repo = inject(CATALOGOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /** `null` = new supplier. */
  readonly proveedor = input<Proveedor | null>(null);
  readonly abierto = input(false);

  readonly guardado = output<Proveedor>();
  readonly cerrar = output<void>();

  protected readonly tiposDocumento = TIPOS_DOCUMENTO;
  protected readonly tiposProveedor = TIPOS_PROVEEDOR;
  protected readonly titulo = computed(() => (this.proveedor() ? 'Editar proveedor' : 'Nuevo proveedor'));
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  // SUPUESTO: nombre de proveedor máx. 120 (igual que clientes) y teléfono opcional.
  protected readonly form = inject(NonNullableFormBuilder).group({
    tipo_documento: ['CC' as TipoDocumento, Validators.required],
    numero_documento: ['', [SilaValidators.requerido, SilaValidators.documento]],
    nombre: ['', [SilaValidators.requerido, SilaValidators.longitud(1, 120)]],
    telefono: ['', SilaValidators.telefono],
    tipo_proveedor: ['LECHERO' as TipoProveedor, Validators.required],
  });

  constructor() {
    effect(() => {
      if (!this.abierto()) return;
      const proveedor = this.proveedor();
      this.errorGeneral.set(null);
      this.form.reset({
        tipo_documento: proveedor?.tipo_documento ?? 'CC',
        numero_documento: proveedor?.numero_documento ?? '',
        nombre: proveedor?.nombre ?? '',
        telefono: proveedor?.telefono ?? '',
        tipo_proveedor: proveedor?.tipo_proveedor ?? 'LECHERO',
      });
      // The backend ignores document and supplier type on edit.
      const { tipo_documento, numero_documento, tipo_proveedor } = this.form.controls;
      for (const control of [tipo_documento, numero_documento, tipo_proveedor]) {
        if (proveedor) {
          control.disable();
        } else {
          control.enable();
        }
      }
    });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.enfocarPrimerError();
      return;
    }
    const valor = this.form.getRawValue();
    const datos: ProveedorGuardar = {
      tipo_documento: valor.tipo_documento,
      numero_documento: valor.numero_documento.trim(),
      nombre: limpiarTexto(valor.nombre),
      telefono: valor.telefono.trim(),
      tipo_proveedor: valor.tipo_proveedor,
    };
    const actual = this.proveedor();
    const peticion = actual ? this.repo.actualizarProveedor(actual.id_proveedor, datos) : this.repo.crearProveedor(datos);

    this.guardando.set(true);
    this.errorGeneral.set(null);
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (proveedor) => {
        this.guardando.set(false);
        this.guardado.emit(proveedor);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        if (isApiError(error) && error.code === 20006) {
          this.form.controls.numero_documento.setErrors({ duplicado: true });
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
