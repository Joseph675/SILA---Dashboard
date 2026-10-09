import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { ChipTono, StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { formatoNumero } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { ACOPIO_REPOSITORY } from './data/acopio.provider';
import type { CalidadProveedor } from './models/acopio.models';

/**
 * SUPUESTO: AP-05. The API sends `porcentaje_rechazo` but no verdict, so the chip tone is ours:
 * more than 20 % rejected is "peligro", more than 10 % "alerta", otherwise "exito".
 */
export const RECHAZO_PELIGRO = 20;
export const RECHAZO_ALERTA = 10;

export function tonoRechazo(porcentaje: number): ChipTono {
  return porcentaje > RECHAZO_PELIGRO ? 'peligro' : porcentaje > RECHAZO_ALERTA ? 'alerta' : 'exito';
}

@Component({
  selector: 'app-calidad-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableCellDirective, ServerDataTableComponent, StatusChipComponent],
  template: `
    <p class="mb-3 text-sm text-muted-foreground">
      Promedios y rechazos por proveedor, con todas sus entregas. El porcentaje se marca en rojo por encima de {{ peligro }} % y en ámbar por encima de {{ alerta }} %.
    </p>
    <app-server-data-table
      titulo="Calidad por proveedor"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="proveedorId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="listado.sort()"
      vacioTitulo="Aún no hay entregas registradas"
      vacioAyuda="La calidad se calcula a partir de las recepciones."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (sortChange)="listado.sort.set($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="temperatura_promedio" [cellRows]="listado.datos()?.items" let-c>
        <span class="tabular-nums">{{ numero(c.temperatura_promedio) }} °C</span>
      </ng-template>
      <ng-template appDataTableCell="acidez_promedio" [cellRows]="listado.datos()?.items" let-c>
        <span class="tabular-nums">{{ numero(c.acidez_promedio) }} °D</span>
      </ng-template>
      <ng-template appDataTableCell="porcentaje_rechazo" [cellRows]="listado.datos()?.items" let-c>
        <app-status-chip [texto]="numero(c.porcentaje_rechazo) + ' %'" [tono]="tono(c.porcentaje_rechazo)" />
      </ng-template>
    </app-server-data-table>
  `,
})
export class CalidadTabComponent {
  private readonly repo = inject(ACOPIO_REPOSITORY);

  protected readonly peligro = RECHAZO_PELIGRO;
  protected readonly alerta = RECHAZO_ALERTA;
  protected readonly numero = formatoNumero;
  protected readonly tono = tonoRechazo;

  protected readonly listado = crearListado({
    filtros: () => ({}),
    cargar: (query) => this.repo.calidad(query),
    sort: 'proveedor,asc',
  });

  protected readonly columnas: DataTableColumn<CalidadProveedor>[] = [
    { key: 'proveedor', label: 'Proveedor', value: (c) => c.proveedor },
    { key: 'numero_entregas', label: 'Entregas', align: 'end', value: (c) => c.numero_entregas },
    // Not in the API's sort list (proveedor, numero_entregas, porcentaje_rechazo, entregas_rechazadas).
    { key: 'temperatura_promedio', label: 'Temp. promedio', align: 'end', sortable: false, value: (c) => c.temperatura_promedio },
    { key: 'acidez_promedio', label: 'Acidez promedio', align: 'end', sortable: false, value: (c) => c.acidez_promedio },
    { key: 'entregas_rechazadas', label: 'Rechazadas', align: 'end', value: (c) => c.entregas_rechazadas },
    { key: 'porcentaje_rechazo', label: '% de rechazo', value: (c) => c.porcentaje_rechazo },
  ];
  protected readonly proveedorId = (c: CalidadProveedor) => c.id_proveedor;
}
