import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';
import { ClaveIdempotente } from '../../core/api/idempotencia';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { aplicarCamposDelServidor } from '../../shared/utils/errores-formulario';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { SilaValidators, limpiarTexto } from '../../shared/validators/sila-validators';
import { DOCUMENTOS_REPOSITORY } from './data/documentos.provider';
import { Documento, NuevoDocumento, TipoEntidadDocumento, etiquetaTipoEntidad } from './models/documentos.models';

/**
 * Registers a document of an entity in the Drive queue (state PENDIENTE). It does NOT upload anything:
 * the real upload to Drive does not exist yet, and the state is never faked.
 */
@Component({
  selector: 'app-documento-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule],
  template: `
    <app-dialog [open]="abierto()" title="Registrar documento" [description]="descripcion()" [cerrable]="!guardando()" (closed)="cerrar.emit()">
      <form id="documento-form" [formGroup]="form" (ngSubmit)="guardar()" novalidate class="space-y-4">
        <p class="rounded-md bg-muted px-3 py-2 text-sm" data-testid="aviso-documento">Queda en la cola de Drive como «Pendiente». La subida del archivo aún no está disponible.</p>
        @if (errorGeneral(); as mensaje) {
          <p role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" data-testid="error-documento">{{ mensaje }}</p>
        }
        <app-form-field etiqueta="Nombre del archivo" ayuda="Por ejemplo recepcion-45.pdf." [obligatorio]="true">
          <input class="sila-input" type="text" maxlength="255" formControlName="nombre" autocomplete="off" />
        </app-form-field>
        <app-form-field etiqueta="Tipo de archivo (opcional)" ayuda="Por defecto application/pdf.">
          <input class="sila-input" type="text" maxlength="100" formControlName="mime" placeholder="application/pdf" autocomplete="off" />
        </app-form-field>
      </form>
      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="guardando()" (click)="cerrar.emit()">Cancelar</button>
        <button type="submit" form="documento-form" class="sila-btn sila-btn-primary" [disabled]="guardando()" [attr.aria-busy]="guardando()">{{ guardando() ? 'Registrando…' : 'Registrar documento' }}</button>
      </div>
    </app-dialog>
  `,
})
export class DocumentoDialogComponent {
  private readonly repo = inject(DOCUMENTOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly abierto = input(false);
  readonly tipoEntidad = input.required<TipoEntidadDocumento>();
  readonly idEntidad = input.required<number>();
  readonly registrado = output<Documento>();
  readonly cerrar = output<void>();

  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  private readonly clave = new ClaveIdempotente();

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: ['', [SilaValidators.requerido, SilaValidators.longitud(1, 255)]],
    mime: [''],
  });

  protected descripcion(): string {
    return `${etiquetaTipoEntidad(this.tipoEntidad())} N.º ${this.idEntidad()}`;
  }

  constructor() {
    effect(() => {
      if (this.abierto()) {
        this.form.reset({ nombre: '', mime: '' });
        this.errorGeneral.set(null);
        this.guardando.set(false);
        this.clave.descartar();
      }
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
    const mime = v.mime.trim();
    const cuerpo: NuevoDocumento = { tipo_entidad: this.tipoEntidad(), id_entidad: this.idEntidad(), nombre_archivo: limpiarTexto(v.nombre), ...(mime ? { mime_type: mime } : {}) };
    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.repo
      .crear(cuerpo, this.clave.para(cuerpo))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (documento) => {
          this.guardando.set(false);
          this.clave.exito();
          this.registrado.emit(documento);
        },
        error: (fallo: unknown) => {
          this.guardando.set(false);
          this.clave.fallo(fallo);
          const error = causaDe(fallo);
          if (isApiError(error) && error.code === 20017) this.clave.descartar();
          if (isApiError(error) && error.code === 20001) {
            const resto = aplicarCamposDelServidor(this.form, error.fields, { nombre_archivo: 'nombre', mime_type: 'mime' });
            this.errorGeneral.set(resto.length > 0 ? `${error.message} ${resto.join('; ')}` : 'Hay datos inválidos. Revisa los campos marcados.');
            return;
          }
          // 404 / 20007: the entity does not exist.
          this.errorGeneral.set(mensajeDeFallo(this.errores, fallo, [20007, 20010]));
        },
      });
  }
}
