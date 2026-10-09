import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SelectorBuscableComponent } from '../../shared/ui/selector-buscable/selector-buscable.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoCop, formatoFecha, formatoFechaHora, formatoNumero } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { FiltroFechasComponent } from '../auditoria/filtro-fechas.component';
import { ACOPIO_REPOSITORY } from './data/acopio.provider';
import type { EstadoCalidad, Recepcion } from './models/acopio.models';
import { cargarProveedoresLecheros } from './proveedores-lecheros';
import { RecepcionDialogComponent } from './recepcion-dialog.component';

@Component({
  selector: 'app-recepciones-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableCellDirective,
    DialogComponent,
    FiltroFechasComponent,
    IconComponent,
    RecepcionDialogComponent,
    SelectorBuscableComponent,
    ServerDataTableComponent,
    StatusChipComponent,
  ],
  template: `
    <div class="mb-4 flex flex-wrap items-end gap-3">
      <div class="w-full sm:w-64">
        <label for="recepciones-proveedor" class="mb-1 block text-xs font-medium text-muted-foreground">Proveedor</label>
        <app-selector-buscable idCampo="recepciones-proveedor" [opciones]="proveedores.opciones()" [(valor)]="proveedor" etiquetaVacia="Todos los proveedores" placeholder="Buscar proveedor…" />
      </div>
      <div>
        <label for="recepciones-estado" class="mb-1 block text-xs font-medium text-muted-foreground">Calidad</label>
        <select id="recepciones-estado" class="sila-select w-40" [value]="estado()" (change)="estado.set($any($event.target).value)">
          <option value="" [selected]="estado() === ''">Todas</option>
          <option value="APROBADO" [selected]="estado() === 'APROBADO'">Aprobadas</option>
          <option value="RECHAZADO" [selected]="estado() === 'RECHAZADO'">Rechazadas</option>
        </select>
      </div>
      <app-filtro-fechas idBase="recepciones" [desde]="desde()" [hasta]="hasta()" (desdeChange)="desde.set($event)" (hastaChange)="hasta.set($event)" />
      <button type="button" class="sila-btn sila-btn-ghost sila-btn-sm" (click)="limpiar()">Quitar filtros</button>
      <button type="button" class="sila-btn sila-btn-primary ms-auto" (click)="dialogo.set(true)">
        <app-icon name="lucidePlus" class="size-4" aria-hidden="true" />
        Nueva recepción
      </button>
    </div>
    @if (proveedores.hayError()) {
      <p class="mb-3 text-sm text-destructive" role="alert">
        No se pudo cargar la lista de proveedores lecheros. <button type="button" class="underline" (click)="proveedores.recargar()">Reintentar</button>
      </p>
    }

    <app-server-data-table
      titulo="Recepciones de leche"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="recepcionId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="listado.sort()"
      vacioTitulo="No hay recepciones que coincidan"
      vacioAyuda="Cambia los filtros o registra una nueva recepción."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (sortChange)="listado.sort.set($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="fecha" [cellRows]="listado.datos()?.items" let-r>
        <span class="whitespace-nowrap">{{ fecha(r.fecha) }}</span>
      </ng-template>
      <ng-template appDataTableCell="litros" [cellRows]="listado.datos()?.items" let-r>
        <span class="tabular-nums">{{ numero(r.litros) }} L</span>
      </ng-template>
      <ng-template appDataTableCell="temperatura" [cellRows]="listado.datos()?.items" let-r>
        <span class="tabular-nums">{{ numero(r.temperatura) }} °C</span>
      </ng-template>
      <ng-template appDataTableCell="acidez" [cellRows]="listado.datos()?.items" let-r>
        <span class="tabular-nums">{{ numero(r.acidez) }} °D</span>
      </ng-template>
      <ng-template appDataTableCell="precio_litro" [cellRows]="listado.datos()?.items" let-r><span class="tabular-nums">{{ cop(r.precio_litro) }}</span></ng-template>
      <ng-template appDataTableCell="valor_total" [cellRows]="listado.datos()?.items" let-r>
        <span class="tabular-nums" [attr.title]="r.estado_calidad === 'RECHAZADO' ? 'Entrega rechazada: no se paga' : null">{{ cop(r.valor_total) }}</span>
      </ng-template>
      <ng-template appDataTableCell="estado_calidad" [cellRows]="listado.datos()?.items" let-r>
        <app-status-chip [texto]="r.estado_calidad === 'APROBADO' ? 'Aprobada' : 'Rechazada'" [tono]="r.estado_calidad === 'APROBADO' ? 'exito' : 'peligro'" />
      </ng-template>
      <ng-template appDataTableCell="motivo_rechazo" [cellRows]="listado.datos()?.items" let-r>
        <span class="block max-w-64 truncate text-muted-foreground" [attr.title]="r.motivo_rechazo">{{ r.motivo_rechazo ?? '—' }}</span>
      </ng-template>
      <ng-template appDataTableCell="registro" [cellRows]="listado.datos()?.items" let-r>
        <span class="whitespace-nowrap text-muted-foreground">{{ r.usuario_registro }} · {{ fechaHora(r.fecha_registro) }}</span>
      </ng-template>
    </app-server-data-table>

    <app-recepcion-dialog
      [abierto]="dialogo()"
      [proveedores]="proveedores.opciones()"
      [umbrales]="umbrales.hasValue() ? umbrales.value() : null"
      [precios]="precios()"
      (registrada)="alRegistrar($event)"
      (cerrar)="dialogo.set(false)"
    />

    <!-- A rejected delivery IS saved (201): this notice must not look like a success. -->
    <app-dialog [open]="rechazada() !== null" title="Entrega rechazada" (closed)="rechazada.set(null)">
      @if (rechazada(); as r) {
        <div role="alert" class="space-y-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm" data-testid="aviso-rechazada">
          <p class="flex items-center gap-2 text-base font-semibold">
            <app-icon name="lucideCircleX" class="size-5 text-destructive" aria-hidden="true" />
            La entrega quedó registrada como rechazada
          </p>
          <p><strong>Motivo:</strong> {{ r.motivo_rechazo ?? 'No cumple la calidad exigida.' }}</p>
          <p class="text-muted-foreground">
            {{ r.proveedor }} · {{ numero(r.litros) }} L · {{ numero(r.temperatura) }} °C · {{ numero(r.acidez) }} °D. Esta leche no se pagará al proveedor.
          </p>
        </div>
      }
      <button dialogFooter type="button" class="sila-btn sila-btn-primary" (click)="rechazada.set(null)">Entendido</button>
    </app-dialog>
  `,
})
export class RecepcionesTabComponent {
  private readonly repo = inject(ACOPIO_REPOSITORY);
  private readonly toast = inject(ToastService);

  protected readonly proveedores = cargarProveedoresLecheros();
  protected readonly umbrales = rxResource({ stream: () => this.repo.umbrales() });

  /** Price in force per lechero (from the balances) and whether it is the system default (no own price row). */
  private readonly saldos = rxResource({ stream: () => this.repo.saldos({ page: 0, size: 100 }) });
  private readonly propios = rxResource({ stream: () => this.repo.listarPrecios({ page: 0, size: 100, solo_vigentes: true }) });
  protected readonly precios = computed(() => {
    const mapa = new Map<number, { precio: number; porDefecto: boolean }>();
    if (!this.saldos.hasValue()) return mapa;
    const propios = new Set(this.propios.hasValue() ? this.propios.value().items.map((p) => p.id_proveedor) : []);
    for (const s of this.saldos.value().items) mapa.set(s.id_proveedor, { precio: s.precio_vigente, porDefecto: this.propios.hasValue() && !propios.has(s.id_proveedor) });
    return mapa;
  });

  protected readonly proveedor = signal<number | null>(null);
  protected readonly estado = signal<'' | EstadoCalidad>('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');

  protected readonly dialogo = signal(false);
  protected readonly rechazada = signal<Recepcion | null>(null);

  protected readonly fecha = formatoFecha;
  protected readonly fechaHora = formatoFechaHora;
  protected readonly numero = formatoNumero;
  protected readonly cop = formatoCop;

  protected readonly listado = crearListado({
    filtros: () => ({
      id_proveedor: this.proveedor() ?? undefined,
      estado_calidad: this.estado() || undefined,
      desde: this.desde() || undefined,
      hasta: this.hasta() || undefined,
    }),
    cargar: (query) => this.repo.listarRecepciones(query),
    sort: 'fecha,desc',
  });

  protected readonly columnas: DataTableColumn<Recepcion>[] = [
    { key: 'fecha', label: 'Fecha', value: (r) => formatoFecha(r.fecha) },
    { key: 'proveedor', label: 'Proveedor', value: (r) => r.proveedor },
    { key: 'litros', label: 'Litros', align: 'end', value: (r) => r.litros },
    { key: 'temperatura', label: 'Temperatura', align: 'end', value: (r) => r.temperatura },
    { key: 'acidez', label: 'Acidez', align: 'end', value: (r) => r.acidez },
    // Not in the API's sort list (id_recepcion, fecha, proveedor, litros, temperatura, acidez, estado_calidad).
    { key: 'precio_litro', label: 'Precio/L', align: 'end', sortable: false, value: (r) => r.precio_litro },
    { key: 'valor_total', label: 'Valor', align: 'end', sortable: false, value: (r) => r.valor_total },
    { key: 'estado_calidad', label: 'Calidad', value: (r) => r.estado_calidad },
    { key: 'motivo_rechazo', label: 'Motivo de rechazo', sortable: false, value: (r) => r.motivo_rechazo ?? '' },
    { key: 'registro', label: 'Registrada por', sortable: false, value: (r) => r.usuario_registro },
  ];
  protected readonly recepcionId = (r: Recepcion) => r.id_recepcion;

  protected readonly hayFiltros = computed(() => this.proveedor() !== null || !!this.estado() || !!this.desde() || !!this.hasta());

  protected alRegistrar(recepcion: Recepcion): void {
    this.dialogo.set(false);
    this.listado.recargar();
    if (recepcion.estado_calidad === 'RECHAZADO') {
      this.rechazada.set(recepcion);
    } else {
      this.toast.exito(`Recepción registrada: ${formatoNumero(recepcion.litros)} L de ${recepcion.proveedor}.`);
    }
  }

  protected limpiar(): void {
    this.proveedor.set(null);
    this.estado.set('');
    this.desde.set('');
    this.hasta.set('');
  }
}
