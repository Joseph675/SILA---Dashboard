import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { INSUMOS_REPOSITORY } from '../../insumos/data/insumos.provider';
import type { Insumo } from '../../insumos/models/insumos.models';
import type { LineaRecetaGuardar } from '../models/catalogos.models';

/** A recipe row being edited: the quantity stays as typed until validated. */
export interface LineaEdicion {
  uid: number;
  id_insumo: number | null;
  cantidadTexto: string;
}

let siguienteUid = 1;
export const lineaVacia = (id_insumo: number | null = null, cantidadTexto = ''): LineaEdicion => ({ uid: siguienteUid++, id_insumo, cantidadTexto });

export interface ResultadoReceta {
  /** The lines to send (empty is valid: no recipe). */
  lineas: LineaRecetaGuardar[];
  error: string | null;
}

/** Checks the rows: every one needs an insumo and a quantity above 0, and an insumo cannot repeat. */
export function validarReceta(filas: readonly LineaEdicion[]): ResultadoReceta {
  const lineas: LineaRecetaGuardar[] = [];
  const vistos = new Set<number>();
  for (const f of filas) {
    if (f.id_insumo === null && f.cantidadTexto.trim() === '') continue; // a row the person left empty is dropped
    const cantidad = Number(f.cantidadTexto.trim().replace(',', '.'));
    if (f.id_insumo === null) return { lineas: [], error: 'Elige el insumo en cada fila (o quita la fila).' };
    if (!Number.isFinite(cantidad) || cantidad <= 0) return { lineas: [], error: 'La cantidad de cada insumo debe ser mayor que 0.' };
    if (vistos.has(f.id_insumo)) return { lineas: [], error: 'Un insumo no puede repetirse en la receta.' };
    vistos.add(f.id_insumo);
    lineas.push({ id_insumo: f.id_insumo, cantidad });
  }
  return { lineas, error: null };
}

/** Rows «insumo + cantidad por unidad» of a recipe. The insumo's unit is shown next to the quantity. Only active insumos are offered. */
@Component({
  selector: 'app-receta-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <fieldset class="space-y-3">
      <legend class="text-sm font-medium">Insumos que usa <span class="font-normal text-muted-foreground">(por cada unidad del producto)</span></legend>
      @if (cargandoInsumos()) {
        <p class="text-xs text-muted-foreground" aria-busy="true">Cargando insumos…</p>
      }
      @for (f of lineas(); track f.uid; let i = $index) {
        <div class="grid grid-cols-[minmax(0,1fr)_7.5rem_auto] items-end gap-2" data-fila-receta>
          <div class="min-w-0">
            <label [for]="'rec-insumo-' + f.uid" class="mb-1 block text-xs text-muted-foreground">Insumo</label>
            <select [id]="'rec-insumo-' + f.uid" class="sila-select" (change)="cambiar(f.uid, { id_insumo: $any($event.target).value === '' ? null : +$any($event.target).value })">
              <option value="" [selected]="f.id_insumo === null">Elige…</option>
              @for (ins of insumosActivos(); track ins.id_insumo) {
                <option [value]="ins.id_insumo" [selected]="ins.id_insumo === f.id_insumo">{{ ins.nombre }} ({{ ins.codigo }})</option>
              }
            </select>
          </div>
          <div>
            <label [for]="'rec-cant-' + f.uid" class="mb-1 block text-xs text-muted-foreground">Cantidad{{ unidad(f) ? ' (' + unidad(f) + ')' : '' }}</label>
            <input [id]="'rec-cant-' + f.uid" type="text" inputmode="decimal" class="sila-input text-end" [value]="f.cantidadTexto" (input)="cambiar(f.uid, { cantidadTexto: $any($event.target).value })" />
          </div>
          <button type="button" class="sila-btn sila-btn-ghost h-9 w-9 px-0" (click)="quitar(f.uid)">
            <app-icon name="lucideTrash2" class="size-4" aria-hidden="true" />
            <span class="sr-only">Quitar la fila {{ i + 1 }}</span>
          </button>
        </div>
      } @empty {
        <p class="text-sm text-muted-foreground">Sin insumos: el producto no gasta nada además de la leche. Es válido.</p>
      }
      @if (error(); as mensaje) {
        <p class="text-xs font-medium text-destructive" role="alert" data-testid="error-receta">{{ mensaje }}</p>
      }
      <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="agregar()">
        <app-icon name="lucidePlus" class="size-4" aria-hidden="true" />
        Agregar insumo
      </button>
    </fieldset>
  `,
})
export class RecetaEditorComponent {
  /** Optional: without the insumos repository (some tests) the list is simply empty. */
  private readonly repo = inject(INSUMOS_REPOSITORY, { optional: true });

  readonly lineas = model<LineaEdicion[]>([]);
  readonly error = input<string | null>(null);

  private readonly recurso = rxResource({
    stream: () => (this.repo ? this.repo.listar({ activo: true, page: 0, size: 100, sort: 'nombre,asc' }) : of({ items: [] as Insumo[], total: 0, page: 0, size: 100 })),
  });
  protected readonly cargandoInsumos = this.recurso.isLoading;
  protected readonly insumosActivos = computed<Insumo[]>(() => (this.recurso.hasValue() ? this.recurso.value().items : []));

  protected unidad(f: LineaEdicion): string {
    return this.insumosActivos().find((i) => i.id_insumo === f.id_insumo)?.unidad_medida ?? '';
  }

  protected agregar(): void {
    this.lineas.update((ls) => [...ls, lineaVacia()]);
  }

  protected quitar(uid: number): void {
    this.lineas.update((ls) => ls.filter((l) => l.uid !== uid));
  }

  protected cambiar(uid: number, cambio: Partial<LineaEdicion>): void {
    this.lineas.update((ls) => ls.map((l) => (l.uid === uid ? { ...l, ...cambio } : l)));
  }
}
