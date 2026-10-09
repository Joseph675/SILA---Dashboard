import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoCop, formatoFecha, formatoNumero } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { textoConEspera } from '../../shared/utils/texto-debounce';
import { AjusteDialogComponent } from '../produccion/ajuste-dialog.component';
import { etiquetaNivel, textoDias, tonoNivel } from '../produccion/caducidad.format';
import type { ProductoOpcion } from '../produccion/models/ajuste-tipos';
import type { Ajuste } from '../produccion/models/produccion.models';
import { deltaConUnidad } from '../produccion/ajustes-tab.component';
import { INVENTARIO_REPOSITORY } from './data/inventario.provider';
import type { AlertaCaducidad, ItemInventario } from './models/inventario.models';

/** Windows offered for the expiry panel; the value is sent as `dias_maximos` (0-60). */
const VENTANAS = [7, 15, 30] as const;

@Component({
  selector: 'app-inventario-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AjusteDialogComponent, DataTableCellDirective, IconComponent, PageHeaderComponent, ServerDataTableComponent, StatusChipComponent],
  template: `
    <app-page-header title="Inventario" description="Stock actual de los productos activos y los lotes que están por vencer." />

    <div class="mb-6 grid gap-4 sm:grid-cols-3" aria-live="polite">
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Total de productos</p>
        <p class="mt-1 text-2xl font-bold tabular-nums">{{ resumen.hasValue() ? numero(resumen.value().total_productos) : '—' }}</p>
      </div>
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Productos sin stock</p>
        <p class="mt-1 text-2xl font-bold tabular-nums" [class.text-destructive]="resumen.hasValue() && resumen.value().productos_sin_stock > 0">
          {{ resumen.hasValue() ? numero(resumen.value().productos_sin_stock) : '—' }}
        </p>
      </div>
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Valor total del inventario</p>
        <p class="mt-1 text-2xl font-bold tabular-nums">{{ resumen.hasValue() ? cop(resumen.value().valor_total) : '—' }}</p>
        <p class="mt-0.5 text-xs text-muted-foreground">Valor a precio de venta, no a costo.</p>
      </div>
    </div>
    @if (resumen.error()) {
      <p class="-mt-3 mb-4 text-sm text-destructive" role="alert">
        No se pudo cargar el resumen. <button type="button" class="underline" (click)="resumen.reload()">Reintentar</button>
      </p>
    }

    <h2 class="mb-3 text-base font-semibold">Stock por producto</h2>
    <div class="mb-4 flex flex-wrap items-end gap-3">
      <div class="w-full sm:w-64">
        <label for="inventario-texto" class="mb-1 block text-xs font-medium text-muted-foreground">Nombre o SKU</label>
        <input id="inventario-texto" type="search" class="sila-input" placeholder="Buscar…" maxlength="100" [value]="texto.crudo()" (input)="texto.crudo.set($any($event.target).value)" />
      </div>
      <label class="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" class="size-4" [checked]="soloConStock()" (change)="soloConStock.set($any($event.target).checked)" />
        Solo con stock
      </label>
    </div>

    <app-server-data-table
      titulo="Stock por producto"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="itemId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="listado.sort()"
      vacioTitulo="No hay productos que coincidan"
      vacioAyuda="Cambia la búsqueda o quita «Solo con stock»."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (sortChange)="listado.sort.set($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="codigo_sku" [cellRows]="listado.datos()?.items" let-i>
        <span class="font-mono text-xs">{{ i.codigo_sku }}</span>
      </ng-template>
      <ng-template appDataTableCell="stock_actual" [cellRows]="listado.datos()?.items" let-i>
        <span class="whitespace-nowrap font-medium tabular-nums" [class.text-destructive]="i.stock_actual <= 0">{{ numero(i.stock_actual) }} {{ i.unidad_medida }}</span>
      </ng-template>
      <ng-template appDataTableCell="precio_base" [cellRows]="listado.datos()?.items" let-i>
        <span class="tabular-nums">{{ cop(i.precio_base) }}</span>
      </ng-template>
      <ng-template appDataTableCell="valor_venta_inventario" [cellRows]="listado.datos()?.items" let-i>
        <span class="tabular-nums">{{ cop(i.valor_venta_inventario) }}</span>
      </ng-template>
      <ng-template appDataTableCell="acciones" [cellRows]="listado.datos()?.items" let-i>
        <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="ajustar(i)">
          <app-icon name="lucideSlidersHorizontal" class="size-4" aria-hidden="true" />
          Registrar ajuste
          <span class="sr-only">de {{ i.producto }}</span>
        </button>
      </ng-template>
    </app-server-data-table>

    <section class="mt-10" aria-labelledby="alertas-titulo">
      <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 id="alertas-titulo" class="text-base font-semibold">Alertas de caducidad</h2>
        <div>
          <label for="alertas-ventana" class="mb-1 block text-xs font-medium text-muted-foreground">Lotes que vencen en los próximos</label>
          <select id="alertas-ventana" class="sila-select w-36" (change)="ventana.set(+$any($event.target).value)">
            @for (v of ventanas; track v) {
              <option [value]="v" [selected]="v === ventana()">{{ v }} días</option>
            }
          </select>
        </div>
      </div>
      <p class="mb-3 rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground" data-testid="nota-lotes">
        El inventario es por producto, no por lote: la cantidad es lo producido en ese lote, no lo que queda sin vender.
      </p>
      <app-server-data-table
        titulo="Alertas de caducidad"
        [columns]="columnasAlertas"
        [page]="alertas.datos()"
        [rowId]="alertaId"
        [cargando]="alertas.cargando()"
        [error]="alertas.error()"
        [sort]="alertas.sort()"
        vacioTitulo="Ningún lote vence en esa ventana"
        vacioAyuda="También salen los vencidos hace menos de 30 días."
        (pageChange)="alertas.irAPagina($event)"
        (sizeChange)="alertas.cambiarTamano($event)"
        (sortChange)="alertas.sort.set($event)"
        (reintentar)="alertas.recargar()"
      >
        <ng-template appDataTableCell="codigo_lote" [cellRows]="alertas.datos()?.items" let-a>
          <span class="font-mono text-xs">{{ a.codigo_lote }}</span>
        </ng-template>
        <ng-template appDataTableCell="cantidad_producida" [cellRows]="alertas.datos()?.items" let-a>
          <span class="tabular-nums">{{ numero(a.cantidad_producida) }}</span>
        </ng-template>
        <ng-template appDataTableCell="fecha_vencimiento" [cellRows]="alertas.datos()?.items" let-a>
          <span class="whitespace-nowrap">{{ fecha(a.fecha_vencimiento) }}</span>
        </ng-template>
        <ng-template appDataTableCell="dias_restantes" [cellRows]="alertas.datos()?.items" let-a>
          <span class="inline-flex flex-wrap items-center gap-2">
            <span class="whitespace-nowrap tabular-nums">{{ dias(a.dias_restantes) }}</span>
            @if (tono(a.nivel_alerta); as t) {
              <app-status-chip [texto]="nivel(a.nivel_alerta)" [tono]="t" />
            }
          </span>
        </ng-template>
      </app-server-data-table>
    </section>

    <app-ajuste-dialog [abierto]="ajusteDe() !== null" [productos]="productosAjuste()" [productoInicial]="ajusteDe()?.id_producto ?? null" (registrado)="alAjustar($event)" (cerrar)="ajusteDe.set(null)" />
  `,
})
export class InventarioPageComponent {
  private readonly repo = inject(INVENTARIO_REPOSITORY);
  private readonly toast = inject(ToastService);

  protected readonly resumen = rxResource({ stream: () => this.repo.resumen() });

  protected readonly texto = textoConEspera();
  protected readonly soloConStock = signal(false);
  protected readonly ventanas = VENTANAS;
  protected readonly ventana = signal<number>(VENTANAS[0]);
  protected readonly ajusteDe = signal<ItemInventario | null>(null);

  protected readonly numero = formatoNumero;
  protected readonly cop = formatoCop;
  protected readonly fecha = formatoFecha;
  protected readonly dias = textoDias;
  protected readonly tono = tonoNivel;
  protected readonly nivel = etiquetaNivel;

  protected readonly listado = crearListado({
    filtros: () => ({ texto: this.texto.valor() || undefined, solo_con_stock: this.soloConStock() || undefined }),
    cargar: (query) => this.repo.listar(query),
    sort: 'producto,asc',
  });

  protected readonly alertas = crearListado({
    filtros: () => ({ dias_maximos: this.ventana() }),
    cargar: (query) => this.repo.alertasCaducidad(query),
    sort: 'dias_restantes,asc',
    tamanoInicial: 10,
  });

  protected readonly columnas: DataTableColumn<ItemInventario>[] = [
    { key: 'codigo_sku', label: 'SKU', value: (i) => i.codigo_sku },
    { key: 'producto', label: 'Producto', value: (i) => i.producto },
    { key: 'stock_actual', label: 'Stock', align: 'end', value: (i) => i.stock_actual },
    { key: 'precio_base', label: 'Precio base', align: 'end', value: (i) => i.precio_base },
    { key: 'valor_venta_inventario', label: 'Valor a precio de venta', align: 'end', value: (i) => i.valor_venta_inventario },
    { key: 'acciones', label: 'Acciones', sortable: false, value: () => '' },
  ];
  protected readonly itemId = (i: ItemInventario) => i.id_producto;

  // SUPUESTO: AP-10. Only `dias_restantes` is sortable here: the contract names the default sort of this endpoint but not the allowed ones.
  protected readonly columnasAlertas: DataTableColumn<AlertaCaducidad>[] = [
    { key: 'codigo_lote', label: 'Lote', sortable: false, value: (a) => a.codigo_lote },
    { key: 'producto', label: 'Producto', sortable: false, value: (a) => a.producto },
    { key: 'cantidad_producida', label: 'Cantidad producida en el lote', align: 'end', sortable: false, value: (a) => a.cantidad_producida },
    { key: 'fecha_vencimiento', label: 'Vencimiento', sortable: false, value: (a) => formatoFecha(a.fecha_vencimiento) },
    { key: 'dias_restantes', label: 'Días restantes', value: (a) => a.dias_restantes },
  ];
  protected readonly alertaId = (a: AlertaCaducidad) => a.codigo_lote;

  /** The dialog gets only the row's product (its stock is already known). */
  protected readonly productosAjuste = computed<ProductoOpcion[]>(() => {
    const i = this.ajusteDe();
    return i ? [{ id_producto: i.id_producto, nombre: i.producto, codigo_sku: i.codigo_sku, unidad_medida: i.unidad_medida, stock: i.stock_actual }] : [];
  });

  protected ajustar(item: ItemInventario): void {
    this.ajusteDe.set(item);
  }

  protected alAjustar(ajuste: Ajuste): void {
    this.ajusteDe.set(null);
    this.listado.recargar();
    this.resumen.reload();
    this.toast.exito(`Ajuste registrado: ${deltaConUnidad(ajuste.cantidad_delta, ajuste.unidad_medida)} de ${ajuste.producto}.`);
  }
}
