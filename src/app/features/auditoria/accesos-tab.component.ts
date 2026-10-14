import { FiltrosPlegablesComponent } from '../../shared/ui/filtros-plegables/filtros-plegables.component';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { describirDispositivo } from '../../shared/utils/dispositivo';
import { formatoFechaHora } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { textoConEspera } from '../../shared/utils/texto-debounce';
import { AUDITORIA_REPOSITORY } from './data/auditoria.provider';
import { FiltroFechasComponent } from './filtro-fechas.component';
import type { AccesoAuditoria } from './models/auditoria.models';
import { EVENTOS_ACCESO, eventoAcceso } from './models/eventos-acceso';

/** Today as a UTC day: the filters work in UTC days. */
function hoyUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-accesos-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FiltrosPlegablesComponent, DataTableCellDirective, FiltroFechasComponent, ServerDataTableComponent, StatusChipComponent],
  templateUrl: './accesos-tab.component.html',
})
export class AccesosTabComponent {
  private readonly repo = inject(AUDITORIA_REPOSITORY);

  protected readonly usuario = textoConEspera();
  protected readonly ip = textoConEspera();
  protected readonly evento = signal('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');

  protected readonly eventos = EVENTOS_ACCESO;
  protected readonly de = eventoAcceso;
  protected readonly fechaHora = formatoFechaHora;
  protected readonly dispositivo = describirDispositivo;

  protected readonly listado = crearListado({
    filtros: () => ({
      usuario: this.usuario.valor() || undefined,
      evento: this.evento() || undefined,
      ip: this.ip.valor() || undefined,
      desde: this.desde() || undefined,
      hasta: this.hasta() || undefined,
    }),
    cargar: (query) => this.repo.accesos(query),
    sort: 'fecha,desc',
  });

  protected readonly columnas: DataTableColumn<AccesoAuditoria>[] = [
    { key: 'fecha', label: 'Fecha', value: (a) => formatoFechaHora(a.fecha) },
    { key: 'usuario', label: 'Usuario', value: (a) => a.usuario ?? '—' },
    { key: 'evento', label: 'Evento', value: (a) => a.evento },
    { key: 'ip', label: 'IP', value: (a) => a.ip ?? '—' },
    { key: 'dispositivo', label: 'Dispositivo', sortable: false, value: (a) => describirDispositivo(a.user_agent) },
    { key: 'detalle', label: 'Detalle', sortable: false, value: (a) => a.detalle ?? '' },
  ];
  protected readonly accesoId = (a: AccesoAuditoria) => a.id_evento;

  // ---------- Shortcuts ----------

  /** `evento` takes ONE value, so failed passwords and failed second factors are separate shortcuts. */
  protected fallosDeHoy(evento: 'LOGIN_FALLIDO' | 'MFA_FALLIDO'): void {
    this.limpiar();
    this.evento.set(evento);
    this.desde.set(hoyUtc());
  }

  protected bloqueos(): void {
    this.limpiar();
    this.evento.set('CUENTA_BLOQUEADA');
  }

  protected limpiar(): void {
    this.usuario.crudo.set('');
    this.ip.crudo.set('');
    this.evento.set('');
    this.desde.set('');
    this.hasta.set('');
  }
}
