import { FiltrosPlegablesComponent } from '../../shared/ui/filtros-plegables/filtros-plegables.component';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SelectorBuscableComponent } from '../../shared/ui/selector-buscable/selector-buscable.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoCop, formatoFecha, formatoNumero } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { textoConEspera } from '../../shared/utils/texto-debounce';
import { FiltroFechasComponent } from '../auditoria/filtro-fechas.component';
import { etiquetaNivel, textoDias, tonoNivel } from './caducidad.format';
import { PRODUCCION_REPOSITORY } from './data/produccion.provider';
import { ConsumosLoteDialogComponent } from './consumos-lote-dialog.component';
import { LoteDialogComponent } from './lote-dialog.component';
import type { Lote } from './models/produccion.models';
import { cargarProductosActivos } from './productos-activos';

@Component({
  selector: 'app-lotes-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConsumosLoteDialogComponent, FiltrosPlegablesComponent, DataTableCellDirective, FiltroFechasComponent, IconComponent, LoteDialogComponent, SelectorBuscableComponent, ServerDataTableComponent, StatusChipComponent],
  template: `
    <app-filtros-plegables clases="mb-4 flex flex-wrap items-end gap-3">
      <div class="w-full sm:w-56">
        <label for="lotes-texto" class="mb-1 block text-xs font-medium text-muted-foreground">Código de lote o producto</label>
        <input id="lotes-texto" type="search" class="sila-input" placeholder="Buscar…" maxlength="100" [value]="texto.crudo()" (input)="texto.crudo.set($any($event.target).value)" />
      </div>
      <div class="w-full sm:w-64">
        <label for="lotes-producto" class="mb-1 block text-xs font-medium text-muted-foreground">Producto</label>
        <app-selector-buscable idCampo="lotes-producto" [opciones]="productos.opciones()" [(valor)]="producto" etiquetaVacia="Todos los productos" placeholder="Buscar producto…" />
      </div>
      <app-filtro-fechas idBase="lotes" [desde]="desde()" [hasta]="hasta()" (desdeChange)="desde.set($event)" (hastaChange)="hasta.set($event)" />
      <button type="button" class="sila-btn sila-btn-ghost sila-btn-sm" (click)="limpiar()">Quitar filtros</button>
      <button type="button" data-accion class="sila-btn sila-btn-primary ms-auto" (click)="dialogo.set(true)">
        <app-icon name="lucidePlus" class="size-4" aria-hidden="true" />
        Nuevo lote
      </button>
    </app-filtros-plegables>
    @if (productos.hayError()) {
      <p class="mb-3 text-sm text-destructive" role="alert">
        No se pudo cargar la lista de productos. <button type="button" class="underline" (click)="productos.recargar()">Reintentar</button>
      </p>
    }
    <p class="mb-3 text-xs text-muted-foreground">Las fechas del filtro son días de producción en hora de Colombia.</p>

    <app-server-data-table
      titulo="Lotes de producción"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="loteId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="listado.sort()"
      vacioTitulo="No hay lotes que coincidan"
      vacioAyuda="Cambia los filtros o registra un nuevo lote."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (sortChange)="listado.sort.set($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="codigo_lote" [cellRows]="listado.datos()?.items" let-l>
        <span class="font-mono text-xs">{{ l.codigo_lote }}</span>
      </ng-template>
      <ng-template appDataTableCell="fecha_produccion" [cellRows]="listado.datos()?.items" let-l>
        <span class="whitespace-nowrap">{{ fecha(l.fecha_produccion) }}</span>
      </ng-template>
      <ng-template appDataTableCell="litros_leche_usados" [cellRows]="listado.datos()?.items" let-l>
        <span class="tabular-nums">{{ numero(l.litros_leche_usados) }} L</span>
      </ng-template>
      <ng-template appDataTableCell="cantidad_obtenida" [cellRows]="listado.datos()?.items" let-l>
        <span class="tabular-nums">{{ numero(l.cantidad_obtenida) }} {{ l.unidad_medida }}</span>
      </ng-template>
      <ng-template appDataTableCell="porcentaje_rendimiento" [cellRows]="listado.datos()?.items" let-l>
        <span class="tabular-nums">{{ numero(l.porcentaje_rendimiento) }} %</span>
      </ng-template>
      <ng-template appDataTableCell="costo_total" [cellRows]="listado.datos()?.items" let-l>
        <span class="tabular-nums">{{ cop(l.costo_total) }}</span>
      </ng-template>
      <ng-template appDataTableCell="costo_leche" [cellRows]="listado.datos()?.items" let-l>
        <span class="tabular-nums">{{ cop(l.costo_leche) }}</span>
      </ng-template>
      <ng-template appDataTableCell="costo_insumos" [cellRows]="listado.datos()?.items" let-l>
        <span class="tabular-nums">{{ cop(l.costo_insumos) }}</span>
      </ng-template>
      <ng-template appDataTableCell="acciones" [cellRows]="listado.datos()?.items" let-l>
        <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="costosDe.set(l)">Ver costos<span class="sr-only"> del lote {{ l.codigo_lote }}</span></button>
      </ng-template>
      <ng-template appDataTableCell="costo_unitario" [cellRows]="listado.datos()?.items" let-l>
        <span class="tabular-nums">{{ cop(l.costo_unitario) }}</span>
      </ng-template>
      <ng-template appDataTableCell="fecha_vencimiento" [cellRows]="listado.datos()?.items" let-l>
        <span class="whitespace-nowrap">{{ fecha(l.fecha_vencimiento) }}</span>
      </ng-template>
      <ng-template appDataTableCell="dias_restantes" [cellRows]="listado.datos()?.items" let-l>
        <span class="inline-flex flex-wrap items-center gap-2">
          <span class="whitespace-nowrap tabular-nums">{{ dias(l.dias_restantes) }}</span>
          @if (tono(l.nivel_alerta); as t) {
            <app-status-chip [texto]="nivel(l.nivel_alerta)" [tono]="t" />
          }
        </span>
      </ng-template>
    </app-server-data-table>

    <app-consumos-lote-dialog [lote]="costosDe()" (cerrar)="costosDe.set(null)" />
    <app-lote-dialog [abierto]="dialogo()" [productos]="productos.productos()" (registrado)="alRegistrar($event)" (cerrar)="dialogo.set(false)" />
  `,
})
export class LotesTabComponent {
  private readonly repo = inject(PRODUCCION_REPOSITORY);
  private readonly toast = inject(ToastService);

  protected readonly productos = cargarProductosActivos();

  protected readonly texto = textoConEspera();
  protected readonly producto = signal<number | null>(null);
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly dialogo = signal(false);
  protected readonly costosDe = signal<Lote | null>(null);

  protected readonly fecha = formatoFecha;
  protected readonly numero = formatoNumero;
  protected readonly cop = formatoCop;
  protected readonly dias = textoDias;
  protected readonly tono = tonoNivel;
  protected readonly nivel = etiquetaNivel;

  protected readonly listado = crearListado({
    filtros: () => ({
      texto: this.texto.valor() || undefined,
      id_producto: this.producto() ?? undefined,
      desde: this.desde() || undefined,
      hasta: this.hasta() || undefined,
    }),
    cargar: (query) => this.repo.listarLotes(query),
    sort: 'fecha_produccion,desc',
  });

  protected readonly columnas: DataTableColumn<Lote>[] = [
    { key: 'codigo_lote', label: 'Código', value: (l) => l.codigo_lote },
    { key: 'producto', label: 'Producto', value: (l) => l.producto },
    { key: 'fecha_produccion', label: 'Producción', value: (l) => formatoFecha(l.fecha_produccion) },
    { key: 'litros_leche_usados', label: 'Litros usados', align: 'end', sortable: false, value: (l) => l.litros_leche_usados },
    { key: 'cantidad_obtenida', label: 'Cantidad', align: 'end', value: (l) => l.cantidad_obtenida },
    { key: 'porcentaje_rendimiento', label: 'Rendimiento', align: 'end', value: (l) => l.porcentaje_rendimiento },
    { key: 'costo_total', label: 'Costo total', align: 'end', value: (l) => l.costo_total },
    { key: 'costo_leche', label: 'Costo leche', align: 'end', sortable: false, ocultarEnMovil: true, value: (l) => l.costo_leche },
    { key: 'costo_insumos', label: 'Costo insumos', align: 'end', sortable: false, ocultarEnMovil: true, value: (l) => l.costo_insumos },
    { key: 'costo_unitario', label: 'Costo unitario', align: 'end', sortable: false, value: (l) => l.costo_unitario },
    { key: 'fecha_vencimiento', label: 'Vencimiento', value: (l) => formatoFecha(l.fecha_vencimiento) },
    { key: 'dias_restantes', label: 'Días restantes', value: (l) => l.dias_restantes },
    { key: 'acciones', label: 'Costos', sortable: false, value: () => '' },
  ];
  protected readonly loteId = (l: Lote) => l.id_lote;

  protected alRegistrar(lote: Lote): void {
    this.dialogo.set(false);
    this.listado.recargar();
    this.toast.exito(`Lote ${lote.codigo_lote} registrado.`);
  }

  protected limpiar(): void {
    this.texto.crudo.set('');
    this.producto.set(null);
    this.desde.set('');
    this.hasta.set('');
  }
}
