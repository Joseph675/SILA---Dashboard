import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiErrorService } from '../../core/api/api-error';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { OpcionSelector, SelectorBuscableComponent } from '../../shared/ui/selector-buscable/selector-buscable.component';
import { redondear2 } from '../../shared/utils/dinero';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { formatoCop } from '../../shared/utils/formato-co';
import { SilaValidators } from '../../shared/validators/sila-validators';
import type { ProductoOpcion } from '../produccion/models/ajuste-tipos';
import { PRECIOS_CLIENTE_REPOSITORY } from './data/precios-cliente.provider';
import type { PrecioCliente } from './models/precios-cliente.models';

/** Creates an agreement or edits the price of an existing one (the same `PUT`, which also leaves it active). */
@Component({
  selector: 'app-precio-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule, SelectorBuscableComponent],
  template: `
    <app-dialog
      [open]="abierto()"
      [title]="existente() ? 'Editar precio pactado' : 'Nuevo acuerdo de precio'"
      [description]="'Cliente: ' + nombreCliente()"
      [cerrable]="!guardando()"
      (closed)="cerrar.emit()"
    >
      <form id="precio-form" [formGroup]="form" (ngSubmit)="guardar()" novalidate class="space-y-4">
        @if (errorGeneral(); as mensaje) {
          <p role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{{ mensaje }}</p>
        }
        <div class="space-y-1.5">
          <label for="precio-producto" class="text-sm font-medium">Producto <span class="text-destructive" aria-hidden="true">*</span></label>
          <app-selector-buscable idCampo="precio-producto" [opciones]="opciones()" [(valor)]="producto" [etiquetaVacia]="null" [deshabilitado]="!!existente()" placeholder="Buscar producto…" [invalido]="!!errorProducto()" />
          <p class="text-xs font-medium text-destructive" aria-live="polite">{{ errorProducto() }}</p>
        </div>

        <app-form-field etiqueta="Precio pactado (COP)" ayuda="Mayor que 0, hasta 2 decimales." [obligatorio]="true">
          <input class="sila-input" type="number" inputmode="decimal" min="0" step="0.01" formControlName="precio" />
        </app-form-field>

        @if (lista() !== null) {
          <div class="rounded-md bg-muted px-4 py-3 text-sm" aria-live="polite" data-testid="comparacion-precio">
            <p>Precio de lista: <strong>{{ cop(lista()!) }}</strong></p>
            @if (diferencia() !== null) {
              <p [class.text-success]="diferencia()! < 0" [class.text-destructive]="diferencia()! > 0">
                Diferencia: <strong>{{ diferencia()! > 0 ? '+ ' : diferencia()! < 0 ? '− ' : '' }}{{ cop(abs(diferencia()!)) }}</strong>
                {{ diferencia()! > 0 ? 'sobre la lista' : diferencia()! < 0 ? 'bajo la lista (descuento)' : '(igual a la lista)' }}
              </p>
            }
            <div class="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <label for="precio-atajo" class="mb-1 block text-xs text-muted-foreground">Atajo: lista + $ (negativo = descuento)</label>
                <input id="precio-atajo" type="number" inputmode="decimal" step="0.01" class="sila-input h-9 w-36" [value]="atajo()" (input)="atajo.set($any($event.target).value)" />
              </div>
              <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" [disabled]="!atajoValido()" (click)="aplicarAtajo()">Calcular precio</button>
            </div>
          </div>
        }
        <p class="text-xs text-muted-foreground">Si el precio de lista cambia después, este precio no se mueve hasta que lo renegocies.</p>
      </form>

      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="guardando()" (click)="cerrar.emit()">Cancelar</button>
        <button type="submit" form="precio-form" class="sila-btn sila-btn-primary" [disabled]="guardando()" [attr.aria-busy]="guardando()">
          {{ guardando() ? 'Guardando…' : 'Guardar precio' }}
        </button>
      </div>
    </app-dialog>
  `,
})
export class PrecioDialogComponent {
  private readonly repo = inject(PRECIOS_CLIENTE_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly abierto = input(false);
  readonly idCliente = input.required<number>();
  readonly nombreCliente = input('');
  readonly productos = input.required<readonly ProductoOpcion[]>();
  /** When set, its price is being edited. */
  readonly existente = input<PrecioCliente | null>(null);

  readonly guardado = output<PrecioCliente>();
  readonly cerrar = output<void>();

  protected readonly cop = formatoCop;
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly producto = signal<number | null>(null);
  private readonly productoTocado = signal(false);
  protected readonly atajo = signal('');

  protected readonly form = inject(NonNullableFormBuilder).group({
    precio: [null as number | null, [SilaValidators.requerido, SilaValidators.montoPositivo]],
  });
  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly opciones = computed<OpcionSelector[]>(() => this.productos().map((p) => ({ valor: p.id_producto, etiqueta: `${p.nombre} (${p.codigo_sku})` })));
  protected readonly errorProducto = computed(() => (this.productoTocado() && this.producto() === null ? 'Elige el producto.' : null));

  /** List price of the chosen product (from the catalog, or the row being edited). */
  protected readonly lista = computed<number | null>(() => {
    const e = this.existente();
    if (e) return e.precio_base;
    return this.productos().find((p) => p.id_producto === this.producto())?.precio_base ?? null;
  });
  protected readonly diferencia = computed<number | null>(() => {
    const precio = this.valores().precio;
    const lista = this.lista();
    return precio == null || lista === null || Number.isNaN(Number(precio)) ? null : redondear2(Number(precio) - lista);
  });
  protected readonly atajoValido = computed(() => this.atajo().trim() !== '' && Number.isFinite(Number(this.atajo())) && this.lista() !== null);

  constructor() {
    effect(() => {
      if (this.abierto()) {
        const e = this.existente();
        this.form.reset({ precio: e ? e.precio : null });
        this.producto.set(e ? e.id_producto : null);
        this.productoTocado.set(false);
        this.errorGeneral.set(null);
        this.guardando.set(false);
        this.atajo.set('');
      }
    });
  }

  protected abs(n: number): number {
    return Math.abs(n);
  }

  protected aplicarAtajo(): void {
    const lista = this.lista();
    if (lista === null) return;
    this.form.controls.precio.setValue(redondear2(lista + Number(this.atajo())));
    this.form.controls.precio.markAsTouched();
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
    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.repo
      .fijar({ id_cliente: this.idCliente(), id_producto: producto, precio: Number(this.form.getRawValue().precio) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (precio) => {
          this.guardando.set(false);
          this.guardado.emit(precio);
        },
        error: (fallo: unknown) => {
          this.guardando.set(false);
          this.errorGeneral.set(mensajeDeFallo(this.errores, fallo, [20001, 20006, 20007]));
        },
      });
  }
}
