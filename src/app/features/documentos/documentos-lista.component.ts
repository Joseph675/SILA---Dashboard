import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { ApiErrorService } from '../../core/api/api-error';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { FiltrosPlegablesComponent } from '../../shared/ui/filtros-plegables/filtros-plegables.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { formatoFechaHora } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { DOCUMENTOS_REPOSITORY } from './data/documentos.provider';
import { chipEstadoCarga, enlaceSeguro } from './documento-estado';
import { DocumentosService } from './documentos.service';
import { Documento, EstadoCarga, TIPOS_ENTIDAD, TipoEntidadDocumento, etiquetaTipoEntidad } from './models/documentos.models';

/** The documents in the Drive queue: state, attempts, last error and the link once uploaded. */
@Component({
  selector: 'app-documentos-lista',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableCellDirective, FiltrosPlegablesComponent, ServerDataTableComponent, StatusChipComponent],
  template: `
    @if (filtrable()) {
      <app-filtros-plegables clases="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label for="docs-tipo" class="mb-1 block text-xs font-medium text-muted-foreground">Tipo de entidad</label>
          <select id="docs-tipo" class="sila-select w-52" (change)="tipo.set($any($event.target).value)">
            <option value="" [selected]="tipo() === ''">Todos</option>
            @for (t of tipos; track t.valor) {
              <option [value]="t.valor" [selected]="t.valor === tipo()">{{ t.etiqueta }}</option>
            }
          </select>
        </div>
        <div>
          <label for="docs-estado" class="mb-1 block text-xs font-medium text-muted-foreground">Estado</label>
          <select id="docs-estado" class="sila-select w-40" (change)="estado.set($any($event.target).value)">
            <option value="" [selected]="estado() === ''">Todos</option>
            <option value="PENDIENTE" [selected]="estado() === 'PENDIENTE'">Pendientes</option>
            <option value="SUBIDO" [selected]="estado() === 'SUBIDO'">Subidos</option>
            <option value="ERROR" [selected]="estado() === 'ERROR'">Con error</option>
          </select>
        </div>
      </app-filtros-plegables>
    }

    <app-server-data-table
      titulo="Documentos"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="documentoId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="listado.sort()"
      vacioTitulo="No hay documentos"
      vacioAyuda="Los documentos se registran desde el detalle de cada recepción."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (sortChange)="listado.sort.set($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="tipo_entidad" [cellRows]="listado.datos()?.items" let-d>{{ tipoTexto(d.tipo_entidad) }} N.º {{ d.id_entidad }}</ng-template>
      <ng-template appDataTableCell="estado_carga" [cellRows]="listado.datos()?.items" let-d>
        <app-status-chip [texto]="chip(d.estado_carga).texto" [tono]="chip(d.estado_carga).tono" />
      </ng-template>
      <ng-template appDataTableCell="ultimo_error" [cellRows]="listado.datos()?.items" let-d>
        @if (d.ultimo_error) {
          <span class="block max-w-64 break-words text-xs text-destructive" data-testid="ultimo-error">{{ d.ultimo_error }}</span>
        } @else {
          <span class="text-muted-foreground">—</span>
        }
      </ng-template>
      <ng-template appDataTableCell="drive_url" [cellRows]="listado.datos()?.items" let-d>
        @if (enlace(d.drive_url); as url) {
          <a [href]="url" target="_blank" rel="noopener noreferrer" class="text-primary underline max-lg:inline-flex max-lg:min-h-11 max-lg:items-center">Abrir en Drive<span class="sr-only"> {{ d.nombre_archivo }}</span></a>
        } @else {
          <span class="text-muted-foreground">—</span>
        }
      </ng-template>
      <ng-template appDataTableCell="fecha_registro" [cellRows]="listado.datos()?.items" let-d><span class="whitespace-nowrap">{{ fechaHora(d.fecha_registro) }}</span></ng-template>
      <ng-template appDataTableCell="acciones" [cellRows]="listado.datos()?.items" let-d>
        @if (subidaDisponible && d.estado_carga !== 'SUBIDO') {
          <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" [disabled]="subiendo() === d.id_documento" (click)="subir(d)">
            {{ subiendo() === d.id_documento ? 'Subiendo…' : 'Subir a Drive' }}<span class="sr-only"> {{ d.nombre_archivo }}</span>
          </button>
        }
      </ng-template>
    </app-server-data-table>
  `,
})
export class DocumentosListaComponent {
  private readonly repo = inject(DOCUMENTOS_REPOSITORY);
  private readonly servicio = inject(DocumentosService);
  private readonly toast = inject(ToastService);
  private readonly errores = inject(ApiErrorService);

  /** With these two the list is fixed to one entity (e.g. the documents of a reception). */
  readonly tipoEntidad = input<TipoEntidadDocumento | null>(null);
  readonly idEntidad = input<number | null>(null);
  readonly filtrable = input(true);
  /** Changes when a document is registered elsewhere, to reload. */
  readonly version = input(0);

  protected readonly tipos = TIPOS_ENTIDAD;
  protected readonly tipoTexto = etiquetaTipoEntidad;
  protected readonly chip = chipEstadoCarga;
  protected readonly enlace = enlaceSeguro;
  protected readonly fechaHora = formatoFechaHora;
  protected readonly subidaDisponible = this.servicio.disponible;

  protected readonly tipo = signal<'' | TipoEntidadDocumento>('');
  protected readonly estado = signal<'' | EstadoCarga>('');
  protected readonly subiendo = signal<number | null>(null);

  protected readonly listado = crearListado({
    filtros: () => ({
      tipo_entidad: this.tipoEntidad() ?? (this.tipo() || undefined),
      id_entidad: this.idEntidad() ?? undefined,
      estado_carga: this.estado() || undefined,
      _v: this.version(),
    }),
    cargar: ({ _v, ...query }) => this.repo.listar(query),
    sort: 'fecha_registro,desc',
    tamanoInicial: 10,
  });

  // Sort fields of the contract: id_documento, tipo_entidad, nombre_archivo, estado_carga, fecha_registro, fecha_carga.
  protected readonly columnas: DataTableColumn<Documento>[] = [
    { key: 'nombre_archivo', label: 'Archivo', rol: 'titulo', value: (d) => d.nombre_archivo },
    { key: 'tipo_entidad', label: 'Entidad', value: (d) => `${d.tipo_entidad} ${d.id_entidad}` },
    { key: 'estado_carga', label: 'Estado', value: (d) => d.estado_carga },
    { key: 'intentos', label: 'Intentos', align: 'end', sortable: false, value: (d) => d.intentos },
    { key: 'ultimo_error', label: 'Último error', sortable: false, value: (d) => d.ultimo_error ?? '' },
    { key: 'drive_url', label: 'Drive', sortable: false, value: (d) => d.drive_url ?? '' },
    { key: 'fecha_registro', label: 'Registrado', ocultarEnMovil: true, value: (d) => d.fecha_registro },
    ...(this.servicio.disponible ? [{ key: 'acciones', label: 'Acciones', sortable: false, value: () => '' } as DataTableColumn<Documento>] : []),
  ];
  protected readonly documentoId = (d: Documento) => d.id_documento;

  /** Only available when the Drive hook is provided. The backend state is whatever the real upload reported. */
  protected subir(documento: Documento): void {
    this.subiendo.set(documento.id_documento);
    this.servicio
      .subir(documento)
      .then(() => this.toast.exito(`«${documento.nombre_archivo}» subido a Drive.`))
      .catch((fallo: unknown) => this.toast.error(mensajeDeFallo(this.errores, fallo, [20010]) || 'No se pudo subir el documento.'))
      .finally(() => {
        this.subiendo.set(null);
        this.listado.recargar();
      });
  }
}
