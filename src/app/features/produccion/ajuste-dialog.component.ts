import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';
import { ClaveIdempotente } from '../../core/api/idempotencia';
import { AuthService } from '../../core/services/auth.service';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { OpcionSelector, SelectorBuscableComponent } from '../../shared/ui/selector-buscable/selector-buscable.component';
import { aplicarCamposDelServidor } from '../../shared/utils/errores-formulario';
import { formatoNumero } from '../../shared/utils/formato-co';
import { SilaValidators } from '../../shared/validators/sila-validators';
import { PRODUCCION_REPOSITORY } from './data/produccion.provider';
import { ProductoOpcion, TIPOS_AJUSTE } from './models/ajuste-tipos';
import type { Ajuste, NuevoAjuste, TipoAjuste } from './models/produccion.models';

const OBSERVACION = { min: 5, max: 255 };

/**
 * Manual stock adjustment, shared by Producción and Inventario (the latter passes `productoInicial`).
 * The quantity is always positive; the type decides the sign. The role only decides which types are OFFERED:
 * the server decides what is allowed (20008).
 */
@Component({
  selector: 'app-ajuste-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule, SelectorBuscableComponent],
  template: `
    <app-dialog
      [open]="abierto()"
      title="Nuevo ajuste de inventario"
      description="Corrige el stock de un producto a mano. Exige una observación y no se puede editar ni borrar después."
      [cerrable]="!guardando()"
      (closed)="cerrar.emit()"
    >
      <form id="ajuste-form" [formGroup]="form" (ngSubmit)="guardar()" novalidate class="space-y-4">
        @if (errorGeneral(); as mensaje) {
          <p role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{{ mensaje }}</p>
        }

        <div class="space-y-1.5">
          <label for="ajuste-producto" class="text-sm font-medium">Producto <span class="text-destructive" aria-hidden="true">*</span></label>
          <app-selector-buscable
            idCampo="ajuste-producto"
            [opciones]="opcionesProducto()"
            [(valor)]="producto"
            [etiquetaVacia]="null"
            [deshabilitado]="productoInicial() !== null"
            placeholder="Buscar producto…"
            [invalido]="!!errorProducto()"
          />
          @if (seleccionado(); as p) {
            @if (p.stock !== undefined) {
              <p class="text-xs text-muted-foreground" data-testid="stock-actual">Stock actual: {{ numero(p.stock) }} {{ p.unidad_medida }}</p>
            }
          }
          <p class="text-xs font-medium text-destructive" aria-live="polite">{{ errorProducto() }}</p>
        </div>

        <app-form-field etiqueta="Tipo de ajuste" [obligatorio]="true">
          <select class="sila-select" formControlName="tipo">
            <option value="">Elige un tipo…</option>
            <optgroup label="Restan stock">
              @for (t of restan; track t.valor) {
                <option [value]="t.valor">{{ t.etiqueta }}</option>
              }
            </optgroup>
            @if (esAdmin()) {
              <optgroup label="Suman o corrigen (solo administrador)">
                @for (t of administrativos; track t.valor) {
                  <option [value]="t.valor">{{ t.etiqueta }}</option>
                }
              </optgroup>
            }
          </select>
        </app-form-field>

        <app-form-field [etiqueta]="'Cantidad' + (seleccionado() ? ' (' + seleccionado()!.unidad_medida + ')' : '')" ayuda="Siempre positiva: el tipo decide si suma o resta." [obligatorio]="true">
          <input class="sila-input" type="number" inputmode="decimal" min="0" step="0.01" formControlName="cantidad" />
        </app-form-field>

        <app-form-field etiqueta="Observación" [ayuda]="'De 5 a 255 caracteres.'" [obligatorio]="true">
          <textarea class="sila-input min-h-20" rows="3" maxlength="255" formControlName="observacion"></textarea>
        </app-form-field>
        <p class="-mt-3 text-end text-xs text-muted-foreground" aria-hidden="true">{{ largoObservacion() }} / {{ maxObservacion }}</p>
      </form>

      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="guardando()" (click)="cerrar.emit()">Cancelar</button>
        <button type="submit" form="ajuste-form" class="sila-btn sila-btn-primary" [disabled]="guardando()" [attr.aria-busy]="guardando()">
          {{ guardando() ? 'Registrando…' : 'Registrar ajuste' }}
        </button>
      </div>
    </app-dialog>
  `,
})
export class AjusteDialogComponent {
  private readonly repo = inject(PRODUCCION_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly abierto = input(false);
  readonly productos = input.required<readonly ProductoOpcion[]>();
  /** When set, that product is chosen and cannot be changed (the action came from one row). */
  readonly productoInicial = input<number | null>(null);

  readonly registrado = output<Ajuste>();
  readonly cerrar = output<void>();

  protected readonly restan = TIPOS_AJUSTE.filter((t) => !t.soloAdmin);
  protected readonly administrativos = TIPOS_AJUSTE.filter((t) => t.soloAdmin);
  protected readonly maxObservacion = OBSERVACION.max;
  protected readonly numero = formatoNumero;

  /** SUPUESTO: AP-09. Los tipos de solo administrador se ofrecen únicamente a un ADMIN; el servidor decide igual (20008). */
  protected readonly esAdmin = computed(() => this.auth.hasRole('ADMIN'));

  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly producto = signal<number | null>(null);
  private readonly productoTocado = signal(false);

  protected readonly opcionesProducto = computed<OpcionSelector[]>(() => this.productos().map((p) => ({ valor: p.id_producto, etiqueta: `${p.nombre} (${p.codigo_sku})` })));
  protected readonly seleccionado = computed(() => this.productos().find((p) => p.id_producto === this.producto()) ?? null);
  protected readonly errorProducto = computed(() => (this.productoTocado() && this.producto() === null ? 'Elige el producto.' : null));

  protected readonly form = inject(NonNullableFormBuilder).group({
    tipo: ['' as '' | TipoAjuste, [SilaValidators.requerido]],
    cantidad: [null as number | null, [SilaValidators.requerido, SilaValidators.montoPositivo]],
    observacion: ['', [SilaValidators.requerido, SilaValidators.longitud(OBSERVACION.min, OBSERVACION.max)]],
  });
  private readonly observacion = toSignal(this.form.controls.observacion.valueChanges, { initialValue: '' });
  protected readonly largoObservacion = computed(() => this.observacion().length);

  private readonly clave = new ClaveIdempotente();

  constructor() {
    effect(() => {
      if (this.abierto()) {
        // Opening the dialog is a NEW user action: fresh data and a fresh idempotency key.
        this.form.reset({ tipo: '', cantidad: null, observacion: '' });
        this.producto.set(this.productoInicial());
        this.productoTocado.set(false);
        this.errorGeneral.set(null);
        this.guardando.set(false);
        this.clave.descartar();
      }
    });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    this.form.markAllAsTouched();
    this.productoTocado.set(true);
    const producto = this.producto();
    if (this.form.invalid || producto === null) {
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const v = this.form.getRawValue();
    const cuerpo: NuevoAjuste = {
      id_producto: producto,
      tipo_ajuste: v.tipo as TipoAjuste,
      cantidad: Number(v.cantidad),
      observacion: v.observacion.trim(),
    };
    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.repo
      .crearAjuste(cuerpo, this.clave.para(cuerpo))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ajuste) => {
          this.guardando.set(false);
          this.clave.exito();
          this.registrado.emit(ajuste);
        },
        error: (fallo: unknown) => {
          this.guardando.set(false);
          this.clave.fallo(fallo);
          this.mostrarError(fallo);
        },
      });
  }

  private mostrarError(fallo: unknown): void {
    const error = causaDe(fallo);
    if (!isApiError(error)) {
      this.errorGeneral.set(this.errores.describe(fallo).mensaje);
      return;
    }
    switch (error.code) {
      case 20002:
        // The server's text says which stock would go negative; the fixed text of ApiErrorService is too generic here.
        this.errorGeneral.set(error.message);
        break;
      case 20006:
        this.errorGeneral.set(error.message);
        break;
      case 20017:
        this.clave.descartar();
        this.errorGeneral.set('Ese ajuste ya se había enviado con otros datos. Revísalo y vuelve a registrarlo: se enviará como una operación nueva.');
        break;
      case 20001: {
        const sinCampo = aplicarCamposDelServidor(this.form, error.fields, { tipo_ajuste: 'tipo' });
        this.errorGeneral.set(sinCampo.length > 0 ? `Hay datos inválidos. ${sinCampo.join('; ')}` : 'Hay datos inválidos. Revisa los campos marcados.');
        break;
      }
      default:
        this.errorGeneral.set(this.errores.describe(fallo).mensaje);
    }
  }
}
