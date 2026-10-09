import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SelectorBuscableComponent } from '../../shared/ui/selector-buscable/selector-buscable.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoFechaHora, formatoNumero } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { FiltroFechasComponent } from '../auditoria/filtro-fechas.component';
import { AjusteDialogComponent } from './ajuste-dialog.component';
import { PRODUCCION_REPOSITORY } from './data/produccion.provider';
import { TIPOS_AJUSTE, etiquetaTipoAjuste } from './models/ajuste-tipos';
import type { Ajuste, TipoAjuste } from './models/produccion.models';
import { cargarProductosActivos } from './productos-activos';

/** `-5, 'KG'` -> `−5 KG`; `5, 'KG'` -> `+5 KG`. The sign tells whether stock went out or in. */
export function deltaConUnidad(delta: number, unidad: string): string {
  const signo = delta < 0 ? '−' : delta > 0 ? '+' : '';
  return `${signo}${formatoNumero(Math.abs(delta))} ${unidad}`;
}

@Component({
  selector: 'app-ajustes-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AjusteDialogComponent, DataTableCellDirective, FiltroFechasComponent, IconComponent, SelectorBuscableComponent, ServerDataTableComponent, StatusChipComponent],
  template: `
    <div class="mb-2 flex flex-wrap items-end gap-3">
      <div class="w-full sm:w-64">
        <label for="ajustes-producto" class="mb-1 block text-xs font-medium text-muted-foreground">Producto</label>
        <app-selector-buscable idCampo="ajustes-producto" [opciones]="productos.opciones()" [(valor)]="producto" etiquetaVacia="Todos los productos" placeholder="Buscar producto…" />
      </div>
      <div>
        <label for="ajustes-tipo" class="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
        <select id="ajustes-tipo" class="sila-select w-48" [value]="tipo()" (change)="tipo.set($any($event.target).value)">
          <option value="" [selected]="tipo() === ''">Todos</option>
          @for (t of tipos; track t.valor) {
            <option [value]="t.valor" [selected]="t.valor === tipo()">{{ t.etiqueta }}</option>
          }
        </select>
      </div>
      <app-filtro-fechas idBase="ajustes" [desde]="desde()" [hasta]="hasta()" (desdeChange)="desde.set($event)" (hastaChange)="hasta.set($event)" />
      <button type="button" class="sila-btn sila-btn-ghost sila-btn-sm" (click)="limpiar()">Quitar filtros</button>
      <button type="button" class="sila-btn sila-btn-primary ms-auto" (click)="dialogo.set(true)">
        <app-icon name="lucidePlus" class="size-4" aria-hidden="true" />
        Nuevo ajuste
      </button>
    </div>
    @if (productos.hayError()) {
      <p class="mb-2 text-sm text-destructive" role="alert">
        No se pudo cargar la lista de productos. <button type="button" class="underline" (click)="productos.recargar()">Reintentar</button>
      </p>
    }
    <p class="mb-3 text-xs text-muted-foreground">Las fechas del filtro son días en UTC; las horas de la tabla están en hora de Colombia (UTC−5).</p>

    <app-server-data-table
      titulo="Ajustes de inventario"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="ajusteId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="listado.sort()"
      vacioTitulo="No hay ajustes que coincidan"
      vacioAyuda="Cambia los filtros o registra un nuevo ajuste."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (sortChange)="listado.sort.set($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="fecha_registro" [cellRows]="listado.datos()?.items" let-a>
        <span class="whitespace-nowrap">{{ fechaHora(a.fecha_registro) }}</span>
      </ng-template>
      <ng-template appDataTableCell="tipo_ajuste" [cellRows]="listado.datos()?.items" let-a>
        <!-- Subtracting adjustments warn, adding ones are success; icon + text, never color alone. -->
        <app-status-chip [texto]="etiqueta(a.tipo_ajuste)" [tono]="a.cantidad_delta < 0 ? 'alerta' : 'exito'" />
      </ng-template>
      <ng-template appDataTableCell="cantidad_delta" [cellRows]="listado.datos()?.items" let-a>
        <span class="whitespace-nowrap font-medium tabular-nums">{{ delta(a.cantidad_delta, a.unidad_medida) }}</span>
      </ng-template>
      <ng-template appDataTableCell="observacion" [cellRows]="listado.datos()?.items" let-a>
        <span class="block max-w-72 truncate text-muted-foreground" [attr.title]="a.observacion">{{ a.observacion }}</span>
      </ng-template>
    </app-server-data-table>

    <app-ajuste-dialog [abierto]="dialogo()" [productos]="productos.productos()" (registrado)="alRegistrar($event)" (cerrar)="dialogo.set(false)" />
  `,
})
export class AjustesTabComponent {
  private readonly repo = inject(PRODUCCION_REPOSITORY);
  private readonly toast = inject(ToastService);

  protected readonly productos = cargarProductosActivos();

  protected readonly producto = signal<number | null>(null);
  protected readonly tipo = signal<'' | TipoAjuste>('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly dialogo = signal(false);

  protected readonly tipos = TIPOS_AJUSTE;
  protected readonly fechaHora = formatoFechaHora;
  protected readonly etiqueta = etiquetaTipoAjuste;
  protected readonly delta = deltaConUnidad;

  protected readonly listado = crearListado({
    filtros: () => ({
      id_producto: this.producto() ?? undefined,
      tipo_ajuste: this.tipo() || undefined,
      desde: this.desde() || undefined,
      hasta: this.hasta() || undefined,
    }),
    cargar: (query) => this.repo.listarAjustes(query),
    sort: 'fecha_registro,desc',
  });

  protected readonly columnas: DataTableColumn<Ajuste>[] = [
    { key: 'fecha_registro', label: 'Fecha', value: (a) => formatoFechaHora(a.fecha_registro) },
    { key: 'producto', label: 'Producto', value: (a) => a.producto },
    { key: 'tipo_ajuste', label: 'Tipo', value: (a) => a.tipo_ajuste },
    { key: 'cantidad_delta', label: 'Cantidad', align: 'end', value: (a) => a.cantidad_delta },
    { key: 'observacion', label: 'Observación', sortable: false, value: (a) => a.observacion },
    { key: 'usuario_registro', label: 'Usuario', sortable: false, value: (a) => a.usuario_registro },
  ];
  protected readonly ajusteId = (a: Ajuste) => a.id_ajuste;

  protected alRegistrar(ajuste: Ajuste): void {
    this.dialogo.set(false);
    this.listado.recargar();
    this.productos.recargar();
    this.toast.exito(`Ajuste registrado: ${deltaConUnidad(ajuste.cantidad_delta, ajuste.unidad_medida)} de ${ajuste.producto}.`);
  }

  protected limpiar(): void {
    this.producto.set(null);
    this.tipo.set('');
    this.desde.set('');
    this.hasta.set('');
  }
}
