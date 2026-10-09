import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiErrorService, isApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/services/auth.service';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { SilaValidators, limpiarTexto } from '../../../shared/validators/sila-validators';
import { CATALOGOS_REPOSITORY } from '../data/catalogos.provider';
import { Cliente, ClienteGuardar, TIPOS_DOCUMENTO, TipoDocumento } from '../models/catalogos.models';

@Component({
  selector: 'app-cliente-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule],
  templateUrl: './cliente-form-dialog.component.html',
})
export class ClienteFormDialogComponent {
  private readonly repo = inject(CATALOGOS_REPOSITORY);
  private readonly auth = inject(AuthService);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /** `null` = new client. */
  readonly cliente = input<Cliente | null>(null);
  readonly abierto = input(false);

  readonly guardado = output<Cliente>();
  readonly cerrar = output<void>();

  protected readonly tiposDocumento = TIPOS_DOCUMENTO;
  protected readonly esAdmin = computed(() => this.auth.rol() === 'ADMIN');
  protected readonly titulo = computed(() => (this.cliente() ? 'Editar cliente' : 'Nuevo cliente'));
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  // SUPUESTO: teléfono y dirección son opcionales; dirección máx. 200 (el documento no fija estos límites).
  protected readonly form = inject(NonNullableFormBuilder).group({
    tipo_documento: ['CC' as TipoDocumento, Validators.required],
    numero_documento: ['', [SilaValidators.requerido, SilaValidators.documento]],
    nombre: ['', [SilaValidators.requerido, SilaValidators.longitud(1, 120)]],
    email: ['', [SilaValidators.requerido, Validators.email, SilaValidators.longitud(1, 120)]],
    telefono: ['', SilaValidators.telefono],
    direccion: ['', SilaValidators.longitud(0, 200)],
    limite_credito: [0, [SilaValidators.requerido, SilaValidators.rango(0, 999_999_999_999)]],
  });

  constructor() {
    // Each opening loads the client (or blanks) and applies the role rule for the credit limit.
    effect(() => {
      if (!this.abierto()) return;
      const cliente = this.cliente();
      this.errorGeneral.set(null);
      this.form.reset({
        tipo_documento: cliente?.tipo_documento ?? 'CC',
        numero_documento: cliente?.numero_documento ?? '',
        nombre: cliente?.nombre ?? '',
        email: cliente?.email ?? '',
        telefono: cliente?.telefono ?? '',
        direccion: cliente?.direccion ?? '',
        limite_credito: cliente?.limite_credito ?? 0,
      });
      // The backend ignores the document on edit: it is the client's identity.
      if (cliente) {
        this.form.controls.tipo_documento.disable();
        this.form.controls.numero_documento.disable();
      } else {
        this.form.controls.tipo_documento.enable();
        this.form.controls.numero_documento.enable();
      }
      if (this.esAdmin()) {
        this.form.controls.limite_credito.enable();
      } else {
        this.form.controls.limite_credito.disable();
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
    const datos: ClienteGuardar = {
      tipo_documento: valor.tipo_documento,
      numero_documento: valor.numero_documento.trim(),
      nombre: limpiarTexto(valor.nombre),
      email: valor.email.trim().toLowerCase(),
      telefono: valor.telefono.trim(),
      direccion: limpiarTexto(valor.direccion),
      // Only ADMIN sends the credit limit; the procedure rejects it from OPERATIVO (20008).
      ...(this.esAdmin() ? { limite_credito: Number(valor.limite_credito) } : {}),
    };
    const actual = this.cliente();
    const peticion = actual ? this.repo.actualizarCliente(actual.id_cliente, datos) : this.repo.crearCliente(datos);

    this.guardando.set(true);
    this.errorGeneral.set(null);
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (cliente) => {
        this.guardando.set(false);
        this.guardado.emit(cliente);
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
