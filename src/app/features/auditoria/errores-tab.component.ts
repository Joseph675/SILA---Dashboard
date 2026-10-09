import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { formatoFechaHora } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { textoConEspera } from '../../shared/utils/texto-debounce';
import { AUDITORIA_REPOSITORY } from './data/auditoria.provider';
import { FiltroFechasComponent } from './filtro-fechas.component';
import type { ErrorAuditoria } from './models/auditoria.models';

@Component({
  selector: 'app-errores-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableCellDirective, FiltroFechasComponent, ServerDataTableComponent],
  templateUrl: './errores-tab.component.html',
})
export class ErroresTabComponent {
  private readonly repo = inject(AUDITORIA_REPOSITORY);

  protected readonly usuario = textoConEspera();
  protected readonly unidad = textoConEspera();
  protected readonly codigo = textoConEspera();
  protected readonly desde = signal('');
  protected readonly hasta = signal('');

  protected readonly fechaHora = formatoFechaHora;

  protected readonly listado = crearListado({
    filtros: () => {
      const codigo = this.codigo.valor();
      return {
        usuario: this.usuario.valor() || undefined,
        unidad: this.unidad.valor() || undefined,
        // The API wants a whole number (ORA codes can be negative: -1). Anything else is ignored.
        codigo_error: /^-?\d+$/.test(codigo) ? Number(codigo) : undefined,
        desde: this.desde() || undefined,
        hasta: this.hasta() || undefined,
      };
    },
    cargar: (query) => this.repo.errores(query),
    sort: 'fecha,desc',
  });

  protected readonly columnas: DataTableColumn<ErrorAuditoria>[] = [
    { key: 'id_log', label: '#', value: (e) => e.id_log },
    { key: 'fecha', label: 'Fecha', value: (e) => formatoFechaHora(e.fecha) },
    { key: 'usuario', label: 'Usuario', value: (e) => e.usuario ?? '—' },
    { key: 'unidad', label: 'Unidad', value: (e) => e.unidad ?? '—' },
    { key: 'codigo_error', label: 'Código', align: 'end', value: (e) => e.codigo_error ?? '—' },
    { key: 'mensaje', label: 'Mensaje', sortable: false, value: (e) => e.mensaje ?? '' },
  ];
  protected readonly errorId = (e: ErrorAuditoria) => e.id_log;
}
