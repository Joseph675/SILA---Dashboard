import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';
import { ClaveIdempotente } from '../../core/api/idempotencia';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { OpcionSelector, SelectorBuscableComponent } from '../../shared/ui/selector-buscable/selector-buscable.component';
import { aplicarCamposDelServidor } from '../../shared/utils/errores-formulario';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { hoyColombia } from '../../shared/utils/fecha-co';
import { formatoCop, formatoNumero } from '../../shared/utils/formato-co';
import { SilaValidators } from '../../shared/validators/sila-validators';
import { INSUMOS_REPOSITORY } from './data/insumos.provider';
import type { Compra, Insumo, NuevaCompra } from './models/insumos.models';

function fechaNoFutura(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '');
  return valor && valor > hoyColombia() ? { servidor: 'La fecha no puede ser futura.' } : null;
}

function mayorQueCero(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v === null || v === undefined || v === '') return null;
  return Number(v) > 0 ? null : { mayorQueCero: true };
}

/** Registers a purchase of an insumo [ADMIN]. The invoice TOTAL is typed; the unit cost is computed (and shown before sending). */
@Component({
  selector: 'app-compra-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule, SelectorBuscableComponent],
  template: `
    <app-dialog [open]="abierto()" title="Registrar compra de insumo" description="Suma al stock y recalcula el costo promedio. Solo se anula si el stock alcanza para devolverla." [wide]="true" [cerrable]="!guardando()" (closed)="cerrar.emit()">
      <form id="compra-form" [formGroup]="form" (ngSubmit)="guardar()" novalidate class="space-y-4">
        @if (errorGeneral(); as mensaje) {
          <p role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" data-testid="error-compra">{{ mensaje }}</p>
        }
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label for="compra-insumo" class="text-sm font-medium">Insumo <span class="text-destructive" aria-hidden="true">*</span></label>
            <app-selector-buscable idCampo="compra-insumo" [opciones]="opcionesInsumo()" [(valor)]="insumo" [etiquetaVacia]="null" placeholder="Buscar insumo…" [invalido]="!!errorInsumo()" />
            <p class="text-xs font-medium text-destructive" aria-live="polite">{{ errorInsumo() }}</p>
          </div>
          <div class="space-y-1.5">
            <label for="compra-proveedor" class="text-sm font-medium">Proveedor (opcional)</label>
            <app-selector-buscable idCampo="compra-proveedor" [opciones]="proveedores()" [(valor)]="proveedor" etiquetaVacia="Sin proveedor" placeholder="Buscar proveedor…" />
            <p class="text-xs text-muted-foreground">Solo proveedores de insumos.</p>
          </div>
          <app-form-field [etiqueta]="'Cantidad' + (seleccionado() ? ' (' + seleccionado()!.unidad_medida + ')' : '')" ayuda="Lo que dice la factura." [obligatorio]="true">
            <input class="sila-input" type="number" inputmode="decimal" min="0" step="any" formControlName="cantidad" />
          </app-form-field>
          <app-form-field etiqueta="Valor total de la factura (COP)" ayuda="El total pagado por esa cantidad, no el precio por unidad." [obligatorio]="true">
            <input class="sila-input" type="number" inputmode="decimal" min="0" step="0.01" formControlName="valor_total" />
          </app-form-field>
          <app-form-field etiqueta="Referencia (opcional)" ayuda="Número de factura.">
            <input class="sila-input" type="text" maxlength="60" formControlName="referencia" />
          </app-form-field>
          <app-form-field etiqueta="Fecha de la compra" ayuda="Hoy en hora de Colombia, o una anterior." [obligatorio]="true">
            <input class="sila-input" type="date" [max]="hoy()" formControlName="fecha" />
          </app-form-field>
        </div>
        <p class="rounded-md bg-muted px-4 py-3 text-sm" aria-live="polite" data-testid="costo-unitario">
          Costo unitario estimado:
          <strong>{{ costoUnitario() === null ? '—' : cop(costoUnitario()!) + (seleccionado() ? ' por ' + seleccionado()!.unidad_medida : '') }}</strong>
          @if (seleccionado(); as s) {
            <span class="block text-xs text-muted-foreground">Costo promedio actual: {{ cop(s.costo_promedio) }} · Stock: {{ numero(s.stock_actual) }} {{ s.unidad_medida }}. El servidor calcula el definitivo.</span>
          }
        </p>
      </form>
      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="guardando()" (click)="cerrar.emit()">Cancelar</button>
        <button type="submit" form="compra-form" class="sila-btn sila-btn-primary" [disabled]="guardando()" [attr.aria-busy]="guardando()">{{ guardando() ? 'Registrando…' : 'Registrar compra' }}</button>
      </div>
    </app-dialog>
  `,
})
export class CompraDialogComponent {
  private readonly repo = inject(INSUMOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly abierto = input(false);
  readonly insumos = input.required<readonly Insumo[]>();
  /** Providers of type INSUMOS only. */
  readonly proveedores = input<readonly OpcionSelector[]>([]);
  /** Preselected insumo (when opened from a row). */
  readonly insumoInicial = input<number | null>(null);

  readonly registrada = output<Compra>();
  readonly cerrar = output<void>();

  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;
  protected readonly hoy = signal(hoyColombia());
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly insumo = signal<number | null>(null);
  protected readonly proveedor = signal<number | null>(null);
  private readonly insumoTocado = signal(false);
  private readonly clave = new ClaveIdempotente();

  protected readonly opcionesInsumo = computed<OpcionSelector[]>(() => this.insumos().map((i) => ({ valor: i.id_insumo, etiqueta: `${i.nombre} (${i.codigo})` })));
  protected readonly seleccionado = computed(() => this.insumos().find((i) => i.id_insumo === this.insumo()) ?? null);
  protected readonly errorInsumo = computed(() => (this.insumoTocado() && this.insumo() === null ? 'Elige el insumo.' : null));

  protected readonly form = inject(NonNullableFormBuilder).group({
    cantidad: [null as number | null, [SilaValidators.requerido, mayorQueCero]],
    valor_total: [null as number | null, [SilaValidators.requerido, SilaValidators.montoPositivo]],
    referencia: [''],
    fecha: [hoyColombia(), [SilaValidators.requerido, fechaNoFutura]],
  });
  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** SUPUESTO: IR-03. Informativo: valor total ÷ cantidad, a 2 decimales; el servidor calcula el real. */
  protected readonly costoUnitario = computed<number | null>(() => {
    const v = this.valores();
    const cantidad = Number(v.cantidad);
    const total = Number(v.valor_total);
    return v.cantidad != null && v.valor_total != null && cantidad > 0 && total > 0 ? Math.round((total / cantidad) * 100) / 100 : null;
  });

  constructor() {
    effect(() => {
      if (this.abierto()) {
        this.hoy.set(hoyColombia());
        this.form.reset({ cantidad: null, valor_total: null, referencia: '', fecha: hoyColombia() });
        this.insumo.set(this.insumoInicial());
        this.proveedor.set(null);
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
    const referencia = v.referencia.trim();
    const proveedor = this.proveedor();
    const cuerpo: NuevaCompra = {
      id_insumo: insumo,
      ...(proveedor !== null ? { id_proveedor: proveedor } : {}),
      cantidad: Number(v.cantidad),
      valor_total: Number(v.valor_total),
      ...(referencia ? { referencia } : {}),
      fecha: v.fecha,
    };
    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.repo
      .crearCompra(cuerpo, this.clave.para(cuerpo))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (compra) => {
          this.guardando.set(false);
          this.clave.exito();
          this.registrada.emit(compra);
        },
        error: (fallo: unknown) => {
          this.guardando.set(false);
          this.clave.fallo(fallo);
          const error = causaDe(fallo);
          if (isApiError(error) && error.code === 20017) this.clave.descartar();
          if (isApiError(error) && error.code === 20001) {
            const resto = aplicarCamposDelServidor(this.form, error.fields);
            this.errorGeneral.set(resto.length > 0 ? `${error.message} ${resto.join('; ')}` : 'Hay datos inválidos. Revisa los campos marcados.');
            return;
          }
          this.errorGeneral.set(mensajeDeFallo(this.errores, fallo, [20004, 20006, 20007]));
        },
      });
  }
}
