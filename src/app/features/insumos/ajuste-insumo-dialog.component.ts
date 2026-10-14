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
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { formatoNumero } from '../../shared/utils/formato-co';
import { SilaValidators } from '../../shared/validators/sila-validators';
import { INSUMOS_REPOSITORY } from './data/insumos.provider';
import { AjusteInsumo, Insumo, NuevoAjusteInsumo, TIPOS_AJUSTE_INSUMO, TipoAjusteInsumo } from './models/insumos.models';

const OBSERVACION = { min: 5, max: 255 };

/**
 * Manual stock adjustment of an insumo. The quantity is always positive; the type decides the sign.
 * An OPERATIVO is offered the 3 that take stock out; an ADMIN also the 2 corrections. The server decides (403 / 20008).
 */
@Component({
  selector: 'app-ajuste-insumo-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule, SelectorBuscableComponent],
  template: `
    <app-dialog [open]="abierto()" title="Nuevo ajuste de insumo" description="Corrige el stock de un insumo a mano. Exige una observación y no se puede editar ni borrar después." [cerrable]="!guardando()" (closed)="cerrar.emit()">
      <form id="ajuste-insumo-form" [formGroup]="form" (ngSubmit)="guardar()" novalidate class="space-y-4">
        @if (errorGeneral(); as mensaje) {
          <p role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" data-testid="error-ajuste">{{ mensaje }}</p>
        }
        <div class="space-y-1.5">
          <label for="ajuste-insumo" class="text-sm font-medium">Insumo <span class="text-destructive" aria-hidden="true">*</span></label>
          <app-selector-buscable idCampo="ajuste-insumo" [opciones]="opcionesInsumo()" [(valor)]="insumo" [etiquetaVacia]="null" placeholder="Buscar insumo…" [invalido]="!!errorInsumo()" />
          @if (seleccionado(); as s) {
            <p class="text-xs text-muted-foreground" data-testid="stock-insumo">Stock actual: {{ numero(s.stock_actual) }} {{ s.unidad_medida }}</p>
          }
          <p class="text-xs font-medium text-destructive" aria-live="polite">{{ errorInsumo() }}</p>
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
              <optgroup label="Correcciones (solo administrador)">
                @for (t of correcciones; track t.valor) {
                  <option [value]="t.valor">{{ t.etiqueta }}</option>
                }
              </optgroup>
            }
          </select>
        </app-form-field>
        <app-form-field [etiqueta]="'Cantidad' + (seleccionado() ? ' (' + seleccionado()!.unidad_medida + ')' : '')" ayuda="Siempre positiva: el tipo decide si suma o resta." [obligatorio]="true">
          <input class="sila-input" type="number" inputmode="decimal" min="0" step="any" formControlName="cantidad" />
        </app-form-field>
        <app-form-field etiqueta="Observación" ayuda="De 5 a 255 caracteres." [obligatorio]="true">
          <textarea class="sila-input min-h-20" rows="3" maxlength="255" formControlName="observacion"></textarea>
        </app-form-field>
        <p class="-mt-3 text-end text-xs text-muted-foreground" aria-hidden="true">{{ largoObservacion() }} / {{ maxObservacion }}</p>
      </form>
      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="guardando()" (click)="cerrar.emit()">Cancelar</button>
        <button type="submit" form="ajuste-insumo-form" class="sila-btn sila-btn-primary" [disabled]="guardando()" [attr.aria-busy]="guardando()">{{ guardando() ? 'Registrando…' : 'Registrar ajuste' }}</button>
      </div>
    </app-dialog>
  `,
})
export class AjusteInsumoDialogComponent {
  private readonly repo = inject(INSUMOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly abierto = input(false);
  readonly insumos = input.required<readonly Insumo[]>();
  readonly registrado = output<AjusteInsumo>();
  readonly cerrar = output<void>();

  protected readonly restan = TIPOS_AJUSTE_INSUMO.filter((t) => !t.soloAdmin);
  protected readonly correcciones = TIPOS_AJUSTE_INSUMO.filter((t) => t.soloAdmin);
  protected readonly maxObservacion = OBSERVACION.max;
  protected readonly numero = formatoNumero;
  protected readonly esAdmin = computed(() => this.auth.hasRole('ADMIN'));

  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly insumo = signal<number | null>(null);
  private readonly insumoTocado = signal(false);
  private readonly clave = new ClaveIdempotente();

  protected readonly opcionesInsumo = computed<OpcionSelector[]>(() => this.insumos().map((i) => ({ valor: i.id_insumo, etiqueta: `${i.nombre} (${i.codigo})` })));
  protected readonly seleccionado = computed(() => this.insumos().find((i) => i.id_insumo === this.insumo()) ?? null);
  protected readonly errorInsumo = computed(() => (this.insumoTocado() && this.insumo() === null ? 'Elige el insumo.' : null));

  protected readonly form = inject(NonNullableFormBuilder).group({
    tipo: ['' as '' | TipoAjusteInsumo, [SilaValidators.requerido]],
    cantidad: [null as number | null, [SilaValidators.requerido, SilaValidators.montoPositivo]],
    observacion: ['', [SilaValidators.requerido, SilaValidators.longitud(OBSERVACION.min, OBSERVACION.max)]],
  });
  private readonly observacion = toSignal(this.form.controls.observacion.valueChanges, { initialValue: '' });
  protected readonly largoObservacion = computed(() => this.observacion().length);

  constructor() {
    effect(() => {
      if (this.abierto()) {
        this.form.reset({ tipo: '', cantidad: null, observacion: '' });
        this.insumo.set(null);
        this.insumoTocado.set(false);
        this.errorGeneral.set(null);
        this.guardando.set(false);
        this.clave.descartar();
      }
    });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    this.form.markAllAsTouched();
    this.insumoTocado.set(true);
    const insumo = this.insumo();
    if (this.form.invalid || insumo === null) {
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const v = this.form.getRawValue();
    const cuerpo: NuevoAjusteInsumo = { id_insumo: insumo, tipo_ajuste: v.tipo as TipoAjusteInsumo, cantidad: Number(v.cantidad), observacion: v.observacion.trim() };
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
          const error = causaDe(fallo);
          if (isApiError(error) && error.code === 20017) this.clave.descartar();
          if (isApiError(error) && error.code === 20001) {
            const resto = aplicarCamposDelServidor(this.form, error.fields, { tipo_ajuste: 'tipo' });
            this.errorGeneral.set(resto.length > 0 ? `${error.message} ${resto.join('; ')}` : 'Hay datos inválidos. Revisa los campos marcados.');
            return;
          }
          // 20002: it would leave negative stock (the message says how much there is); 20008: type reserved to an ADMIN.
          this.errorGeneral.set(mensajeDeFallo(this.errores, fallo, [20002, 20006, 20007]));
        },
      });
  }
}
