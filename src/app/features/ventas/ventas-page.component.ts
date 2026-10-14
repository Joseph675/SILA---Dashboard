import { FiltrosPlegablesComponent } from '../../shared/ui/filtros-plegables/filtros-plegables.component';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { formatoCop, formatoFecha } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { textoConEspera } from '../../shared/utils/texto-debounce';
import { FiltroFechasComponent } from '../auditoria/filtro-fechas.component';
import { VENTAS_REPOSITORY } from './data/ventas.provider';
import type { EstadoPago, TipoVenta, Venta } from './models/ventas.models';
import { VerComprobanteComponent } from '../comprobantes/ver-comprobante.component';
import { VentaDetalleDialogComponent } from './venta-detalle-dialog.component';
import { chipEstadoPago, etiquetaTipoVenta } from './ventas.format';

@Component({
  selector: 'app-ventas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FiltrosPlegablesComponent, DataTableCellDirective, FiltroFechasComponent, IconComponent, PageHeaderComponent, RouterLink, ServerDataTableComponent, StatusChipComponent, VentaDetalleDialogComponent, VerComprobanteComponent],
  template: `
    <app-page-header title="Historial de ventas" description="Consulta las ventas registradas, su detalle y, si eres administrador, anúlalas.">
      <a routerLink="/ventas/nueva" class="sila-btn sila-btn-primary shrink-0">
        <app-icon name="lucidePlus" class="size-4" aria-hidden="true" />
        Nueva venta
      </a>
    </app-page-header>

    <app-filtros-plegables clases="mb-4 flex flex-wrap items-end gap-3">
      <div class="w-full sm:w-64">
        <label for="ventas-texto" class="mb-1 block text-xs font-medium text-muted-foreground">Cliente o documento</label>
        <input id="ventas-texto" type="search" class="sila-input" placeholder="Buscar…" maxlength="100" [value]="texto.crudo()" (input)="texto.crudo.set($any($event.target).value)" />
      </div>
      <div>
        <label for="ventas-estado" class="mb-1 block text-xs font-medium text-muted-foreground">Estado</label>
        <select id="ventas-estado" class="sila-select w-40" (change)="estado.set($any($event.target).value)">
          <option value="" [selected]="estado() === ''">Todos</option>
          @for (e of estados; track e) {
            <option [value]="e" [selected]="e === estado()">{{ chip(e).texto }}</option>
          }
        </select>
      </div>
      <div>
        <label for="ventas-tipo" class="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
        <select id="ventas-tipo" class="sila-select w-36" (change)="tipo.set($any($event.target).value)">
          <option value="" [selected]="tipo() === ''">Todos</option>
          <option value="CONTADO" [selected]="tipo() === 'CONTADO'">Contado</option>
          <option value="CREDITO" [selected]="tipo() === 'CREDITO'">Crédito</option>
        </select>
      </div>
      <app-filtro-fechas idBase="ventas" [desde]="desde()" [hasta]="hasta()" (desdeChange)="desde.set($event)" (hastaChange)="hasta.set($event)" />
      <button type="button" class="sila-btn sila-btn-ghost sila-btn-sm" (click)="limpiar()">Quitar filtros</button>
    </app-filtros-plegables>

    <app-server-data-table
      titulo="Ventas"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="ventaId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="listado.sort()"
      vacioTitulo="No hay ventas que coincidan"
      vacioAyuda="Cambia los filtros o registra una venta en el punto de venta."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (sortChange)="listado.sort.set($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="id_venta" [cellRows]="listado.datos()?.items" let-v>
        <span class="font-mono text-xs">{{ v.id_venta }}</span>
      </ng-template>
      <ng-template appDataTableCell="fecha_venta" [cellRows]="listado.datos()?.items" let-v>
        <span class="whitespace-nowrap">{{ fecha(v.fecha_venta) }} {{ v.fecha_venta.slice(11, 16) }}</span>
      </ng-template>
      <ng-template appDataTableCell="tipo_venta" [cellRows]="listado.datos()?.items" let-v>{{ tipoTexto(v.tipo_venta) }}</ng-template>
      <ng-template appDataTableCell="total_venta" [cellRows]="listado.datos()?.items" let-v>
        <span class="tabular-nums">{{ cop(v.total_venta) }}</span>
      </ng-template>
      <ng-template appDataTableCell="saldo_pendiente" [cellRows]="listado.datos()?.items" let-v>
        <span class="tabular-nums">{{ cop(v.saldo_pendiente) }}</span>
      </ng-template>
      <ng-template appDataTableCell="estado_pago" [cellRows]="listado.datos()?.items" let-v>
        <app-status-chip [texto]="chip(v.estado_pago).texto" [tono]="chip(v.estado_pago).tono" />
      </ng-template>
      <ng-template appDataTableCell="acciones" [cellRows]="listado.datos()?.items" let-v>
        <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="seleccionada.set(v.id_venta)">
          Ver detalle<span class="sr-only"> de la venta {{ v.id_venta }}</span>
        </button>
        <app-ver-comprobante class="ms-2 inline-block" tipo="VENTA" [id]="v.id_venta" />
      </ng-template>
    </app-server-data-table>

    <app-venta-detalle-dialog [idVenta]="seleccionada()" (cerrar)="seleccionada.set(null)" (anulada)="listado.recargar()" />
  `,
})
export class VentasPageComponent {
  private readonly repo = inject(VENTAS_REPOSITORY);

  protected readonly texto = textoConEspera();
  protected readonly estado = signal<'' | EstadoPago>('');
  protected readonly tipo = signal<'' | TipoVenta>('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly seleccionada = signal<number | null>(null);

  protected readonly estados: readonly EstadoPago[] = ['PAGADA', 'PENDIENTE', 'ANULADA', 'CASTIGADA'];
  protected readonly chip = chipEstadoPago;
  protected readonly tipoTexto = etiquetaTipoVenta;
  protected readonly cop = formatoCop;
  protected readonly fecha = formatoFecha;

  protected readonly listado = crearListado({
    filtros: () => ({
      texto: this.texto.valor() || undefined,
      estado_pago: this.estado() || undefined,
      tipo_venta: this.tipo() || undefined,
      desde: this.desde() || undefined,
      hasta: this.hasta() || undefined,
    }),
    cargar: (query) => this.repo.listar(query),
    sort: 'fecha_venta,desc',
  });

  protected readonly columnas: DataTableColumn<Venta>[] = [
    { key: 'id_venta', label: 'N.º', value: (v) => v.id_venta },
    { key: 'fecha_venta', label: 'Fecha', value: (v) => v.fecha_venta },
    { key: 'cliente', label: 'Cliente', value: (v) => v.cliente },
    { key: 'tipo_venta', label: 'Tipo', value: (v) => v.tipo_venta },
    { key: 'total_venta', label: 'Total', align: 'end', value: (v) => v.total_venta },
    { key: 'saldo_pendiente', label: 'Saldo pendiente', align: 'end', value: (v) => v.saldo_pendiente },
    { key: 'estado_pago', label: 'Estado', value: (v) => v.estado_pago },
    { key: 'acciones', label: 'Detalle', sortable: false, value: () => '' },
  ];
  protected readonly ventaId = (v: Venta) => v.id_venta;

  protected limpiar(): void {
    this.texto.crudo.set('');
    this.estado.set('');
    this.tipo.set('');
    this.desde.set('');
    this.hasta.set('');
  }
}
