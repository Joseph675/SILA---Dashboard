import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { FiltrosPlegablesComponent } from '../../shared/ui/filtros-plegables/filtros-plegables.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SelectorBuscableComponent } from '../../shared/ui/selector-buscable/selector-buscable.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoCop, formatoFechaHora, formatoNumero } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { FiltroFechasComponent } from '../auditoria/filtro-fechas.component';
import { AjusteInsumoDialogComponent } from './ajuste-insumo-dialog.component';
import { INSUMOS_REPOSITORY } from './data/insumos.provider';
import { cargarInsumosActivos } from './insumos-activos';
import { AjusteInsumo, TIPOS_AJUSTE_INSUMO, TipoAjusteInsumo, etiquetaTipoAjusteInsumo } from './models/insumos.models';

/** `-5, 'KG'` -> `−5 KG`; `5, 'KG'` -> `+5 KG`. */
export function deltaInsumo(delta: number, unidad: string): string {
  const signo = delta < 0 ? '−' : delta > 0 ? '+' : '';
  return `${signo}${formatoNumero(Math.abs(delta))} ${unidad}`;
}

@Component({
  selector: 'app-ajustes-insumo-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AjusteInsumoDialogComponent, DataTableCellDirective, FiltroFechasComponent, FiltrosPlegablesComponent, IconComponent, SelectorBuscableComponent, ServerDataTableComponent, StatusChipComponent],
  template: `
    <app-filtros-plegables clases="mb-2 flex flex-wrap items-end gap-3">
      <div class="w-full sm:w-64">
        <label for="ajustes-insumo-filtro" class="mb-1 block text-xs font-medium text-muted-foreground">Insumo</label>
        <app-selector-buscable idCampo="ajustes-insumo-filtro" [opciones]="insumos.opciones()" [(valor)]="insumo" etiquetaVacia="Todos los insumos" placeholder="Buscar insumo…" />
      </div>
      <div>
        <label for="ajustes-insumo-tipo" class="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
        <select id="ajustes-insumo-tipo" class="sila-select w-48" (change)="tipo.set($any($event.target).value)">
          <option value="" [selected]="tipo() === ''">Todos</option>
          @for (t of tipos; track t.valor) {
            <option [value]="t.valor" [selected]="t.valor === tipo()">{{ t.etiqueta }}</option>
          }
        </select>
      </div>
      <app-filtro-fechas idBase="ajustes-insumo" [desde]="desde()" [hasta]="hasta()" (desdeChange)="desde.set($event)" (hastaChange)="hasta.set($event)" />
      <button type="button" data-accion class="sila-btn sila-btn-primary ms-auto" (click)="dialogo.set(true)">
        <app-icon name="lucidePlus" class="size-4" aria-hidden="true" />
        Nuevo ajuste
      </button>
    </app-filtros-plegables>
    <p class="mb-3 text-xs text-muted-foreground">Las fechas del filtro son días en UTC; las horas de la tabla están en hora de Colombia (UTC−5).</p>

    <app-server-data-table
      titulo="Ajustes de insumos"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="ajusteId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="null"
      vacioTitulo="No hay ajustes que coincidan"
      vacioAyuda="Cambia los filtros o registra un ajuste."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="fecha_registro" [cellRows]="listado.datos()?.items" let-a><span class="whitespace-nowrap">{{ fechaHora(a.fecha_registro) }}</span></ng-template>
      <ng-template appDataTableCell="tipo_ajuste" [cellRows]="listado.datos()?.items" let-a>
        <app-status-chip [texto]="etiqueta(a.tipo_ajuste)" [tono]="a.cantidad_delta < 0 ? 'alerta' : 'exito'" />
      </ng-template>
      <ng-template appDataTableCell="cantidad_delta" [cellRows]="listado.datos()?.items" let-a><span class="whitespace-nowrap font-medium tabular-nums">{{ delta(a.cantidad_delta, a.unidad_medida) }}</span></ng-template>
      <ng-template appDataTableCell="valor_delta" [cellRows]="listado.datos()?.items" let-a><span class="tabular-nums" [class.text-destructive]="a.valor_delta < 0">{{ cop(a.valor_delta) }}</span></ng-template>
      <ng-template appDataTableCell="observacion" [cellRows]="listado.datos()?.items" let-a><span class="block max-w-72 truncate text-muted-foreground" [attr.title]="a.observacion">{{ a.observacion }}</span></ng-template>
    </app-server-data-table>

    <app-ajuste-insumo-dialog [abierto]="dialogo()" [insumos]="insumos.insumos()" (registrado)="alRegistrar($event)" (cerrar)="dialogo.set(false)" />
  `,
})
export class AjustesInsumoTabComponent {
  private readonly repo = inject(INSUMOS_REPOSITORY);
  private readonly toast = inject(ToastService);

  protected readonly insumos = cargarInsumosActivos();
  protected readonly tipos = TIPOS_AJUSTE_INSUMO;
  protected readonly fechaHora = formatoFechaHora;
  protected readonly cop = formatoCop;
  protected readonly etiqueta = etiquetaTipoAjusteInsumo;
  protected readonly delta = deltaInsumo;

  protected readonly insumo = signal<number | null>(null);
  protected readonly tipo = signal<'' | TipoAjusteInsumo>('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly dialogo = signal(false);

  protected readonly listado = crearListado({
    filtros: () => ({ id_insumo: this.insumo() ?? undefined, tipo_ajuste: this.tipo() || undefined, desde: this.desde() || undefined, hasta: this.hasta() || undefined }),
    cargar: (query) => this.repo.listarAjustes(query),
    // The contract lists no sort for this endpoint: none is sent.
    sort: '',
  });

  protected readonly columnas: DataTableColumn<AjusteInsumo>[] = [
    { key: 'fecha_registro', label: 'Fecha', sortable: false, value: (a) => a.fecha_registro },
    { key: 'insumo', label: 'Insumo', rol: 'titulo', sortable: false, value: (a) => a.insumo },
    { key: 'tipo_ajuste', label: 'Tipo', sortable: false, value: (a) => a.tipo_ajuste },
    { key: 'cantidad_delta', label: 'Cantidad', sortable: false, align: 'end', value: (a) => a.cantidad_delta },
    { key: 'valor_delta', label: 'Valor', sortable: false, align: 'end', ocultarEnMovil: true, value: (a) => a.valor_delta },
    { key: 'observacion', label: 'Observación', sortable: false, value: (a) => a.observacion },
    { key: 'usuario_registro', label: 'Usuario', sortable: false, ocultarEnMovil: true, value: (a) => a.usuario_registro },
  ];
  protected readonly ajusteId = (a: AjusteInsumo) => a.id_ajuste;

  protected alRegistrar(ajuste: AjusteInsumo): void {
    this.dialogo.set(false);
    this.listado.recargar();
    this.insumos.recargar();
    this.toast.exito(`Ajuste registrado: ${deltaInsumo(ajuste.cantidad_delta, ajuste.unidad_medida)} de ${ajuste.insumo}.`);
  }
}
