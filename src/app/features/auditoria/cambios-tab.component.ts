import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { formatoFechaHora } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { textoConEspera } from '../../shared/utils/texto-debounce';
import { AUDITORIA_REPOSITORY } from './data/auditoria.provider';
import { FiltroFechasComponent } from './filtro-fechas.component';
import type { CambioAuditoria } from './models/auditoria.models';

@Component({
  selector: 'app-cambios-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableCellDirective, FiltroFechasComponent, ServerDataTableComponent],
  templateUrl: './cambios-tab.component.html',
})
export class CambiosTabComponent {
  private readonly repo = inject(AUDITORIA_REPOSITORY);

  protected readonly usuario = textoConEspera();
  protected readonly tabla = textoConEspera();
  protected readonly columna = textoConEspera();
  protected readonly desde = signal('');
  protected readonly hasta = signal('');

  protected readonly fechaHora = formatoFechaHora;

  protected readonly listado = crearListado({
    filtros: () => ({
      usuario: this.usuario.valor() || undefined,
      tabla: this.tabla.valor() || undefined,
      columna: this.columna.valor() || undefined,
      desde: this.desde() || undefined,
      hasta: this.hasta() || undefined,
    }),
    cargar: (query) => this.repo.cambios(query),
    sort: 'fecha,desc',
  });

  protected readonly columnas: DataTableColumn<CambioAuditoria>[] = [
    { key: 'fecha', label: 'Fecha', value: (c) => formatoFechaHora(c.fecha) },
    { key: 'usuario', label: 'Usuario', value: (c) => c.usuario ?? '—' },
    { key: 'tabla', label: 'Tabla', value: (c) => c.tabla },
    { key: 'id_registro', label: 'Registro', sortable: false, value: (c) => c.id_registro ?? '—' },
    { key: 'columna', label: 'Columna', value: (c) => c.columna },
    { key: 'valor_anterior', label: 'Valor anterior', sortable: false, value: (c) => c.valor_anterior ?? '—' },
    { key: 'valor_nuevo', label: 'Valor nuevo', sortable: false, value: (c) => c.valor_nuevo ?? '—' },
  ];
  protected readonly cambioId = (c: CambioAuditoria) => c.id_auditoria;
}
