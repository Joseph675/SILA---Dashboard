import { FiltrosPlegablesComponent } from '../../shared/ui/filtros-plegables/filtros-plegables.component';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { ClienteSelectorComponent } from '../../shared/ui/cliente-selector/cliente-selector.component';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { formatoCop, formatoFecha, formatoFechaHora } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { FiltroFechasComponent } from '../auditoria/filtro-fechas.component';
import { METODOS_PAGO, etiquetaMetodo } from '../ventas/ventas.format';
import { VerComprobanteComponent } from '../comprobantes/ver-comprobante.component';
import { CARTERA_REPOSITORY } from './data/cartera.provider';
import type { Abono } from './models/cartera.models';
import type { MetodoPago } from '../ventas/models/ventas.models';

@Component({
  selector: 'app-abonos-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FiltrosPlegablesComponent, ClienteSelectorComponent, DataTableCellDirective, FiltroFechasComponent, ServerDataTableComponent, VerComprobanteComponent],
  template: `
    <app-filtros-plegables clases="mb-2 flex flex-wrap items-end gap-3">
      <div class="w-full sm:w-72">
        <span class="mb-1 block text-xs font-medium text-muted-foreground" id="abonos-cliente-etiqueta">Cliente</span>
        @if (idClienteFijo() !== null) {
          <p class="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm" data-testid="cliente-fijo">
            <span class="truncate">{{ nombreClienteFijo() }}</span>
            <button type="button" data-accion class="ms-auto underline" (click)="quitarCliente.emit()">Quitar</button>
          </p>
        } @else {
          <app-cliente-selector idCampo="abonos-cliente" (clienteElegido)="cliente.set($event?.id_cliente ?? null)" />
        }
      </div>
      <div>
        <label for="abonos-metodo" class="mb-1 block text-xs font-medium text-muted-foreground">Medio</label>
        <select id="abonos-metodo" class="sila-select w-40" (change)="metodo.set($any($event.target).value)">
          <option value="" [selected]="metodo() === ''">Todos</option>
          @for (m of metodos; track m.valor) {
            <option [value]="m.valor" [selected]="m.valor === metodo()">{{ m.etiqueta }}</option>
          }
        </select>
      </div>
      <div>
        <label for="abonos-recibo" class="mb-1 block text-xs font-medium text-muted-foreground">Recibo N.º</label>
        <input id="abonos-recibo" type="number" min="1" step="1" class="sila-input w-32" [value]="recibo()" (input)="recibo.set($any($event.target).value)" />
      </div>
      <app-filtro-fechas idBase="abonos" [desde]="desde()" [hasta]="hasta()" (desdeChange)="desde.set($event)" (hastaChange)="hasta.set($event)" />
    </app-filtros-plegables>
    <p class="mb-3 text-xs text-muted-foreground">Un pago se reparte entre varias ventas: cada reparto es una fila y todas comparten el número de recibo. Las fechas del filtro son días.</p>

    <app-server-data-table
      titulo="Abonos"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="abonoId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="listado.sort()"
      vacioTitulo="No hay abonos que coincidan"
      vacioAyuda="Cambia los filtros o registra un abono desde «Clientes con deuda»."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (sortChange)="listado.sort.set($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="id_recibo" [cellRows]="listado.datos()?.items" let-a let-i="index">
        <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span class="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-xs font-semibold">N.º {{ a.id_recibo }}</span>
          @if (comparteConAnterior(i)) {
            <span class="text-xs text-muted-foreground">mismo pago</span>
          }
        </span>
      </ng-template>
      <ng-template appDataTableCell="fecha_abono" [cellRows]="listado.datos()?.items" let-a><span class="whitespace-nowrap">{{ fechaAbono(a.fecha_abono) }}</span></ng-template>
      <ng-template appDataTableCell="id_venta" [cellRows]="listado.datos()?.items" let-a><span class="font-mono text-xs">N.º {{ a.id_venta }}</span></ng-template>
      <ng-template appDataTableCell="monto" [cellRows]="listado.datos()?.items" let-a><span class="font-medium tabular-nums">{{ cop(a.monto) }}</span></ng-template>
      <ng-template appDataTableCell="metodo_pago" [cellRows]="listado.datos()?.items" let-a>{{ metodoTexto(a.metodo_pago) }}</ng-template>
      <ng-template appDataTableCell="acciones" [cellRows]="listado.datos()?.items" let-a let-i="index">
        <!-- A receipt groups several abonos: the link is the receipt's, shown once per receipt. -->
        @if (!comparteConAnterior(i)) {
          <app-ver-comprobante tipo="ABONO" [id]="a.id_recibo" />
        }
      </ng-template>
    </app-server-data-table>
  `,
})
export class AbonosTabComponent {
  private readonly repo = inject(CARTERA_REPOSITORY);

  /** Client chosen from «Clientes con deuda» → «Historial de abonos». */
  readonly idClienteFijo = input<number | null>(null);
  readonly nombreClienteFijo = input('');
  readonly quitarCliente = output<void>();

  protected readonly cop = formatoCop;
  /**
   * SUPUESTO: VC-16. `fecha_abono` llega como día (`2026-10-09`, el día de Colombia) aunque el contrato no lo precisa;
   * convertirlo como una marca UTC lo mostraría el día anterior a las 19:00. Si llegara con hora, se convierte desde UTC.
   */
  protected readonly fechaAbono = (valor: string) => (valor.length <= 10 ? formatoFecha(valor) : formatoFechaHora(valor));
  protected readonly metodos = METODOS_PAGO;
  protected readonly metodoTexto = etiquetaMetodo;

  protected readonly cliente = signal<number | null>(null);
  protected readonly metodo = signal<'' | MetodoPago>('');
  protected readonly recibo = signal('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');

  protected readonly listado = crearListado({
    filtros: () => ({
      id_cliente: this.idClienteFijo() ?? this.cliente() ?? undefined,
      metodo_pago: this.metodo() || undefined,
      id_recibo: this.recibo().trim() !== '' && Number(this.recibo()) > 0 ? Number(this.recibo()) : undefined,
      desde: this.desde() || undefined,
      hasta: this.hasta() || undefined,
    }),
    cargar: (query) => this.repo.abonos(query),
    sort: 'fecha_abono,desc',
  });

  protected readonly columnas: DataTableColumn<Abono>[] = [
    { key: 'id_recibo', label: 'Recibo', value: (a) => a.id_recibo },
    { key: 'fecha_abono', label: 'Fecha', value: (a) => a.fecha_abono },
    { key: 'cliente', label: 'Cliente', value: (a) => a.cliente },
    { key: 'id_venta', label: 'Venta', sortable: false, value: (a) => a.id_venta },
    { key: 'monto', label: 'Monto', align: 'end', value: (a) => a.monto },
    { key: 'metodo_pago', label: 'Medio', sortable: false, value: (a) => a.metodo_pago },
    { key: 'referencia_pago', label: 'Referencia', sortable: false, value: (a) => a.referencia_pago ?? '—' },
    { key: 'usuario_registro', label: 'Usuario', sortable: false, value: (a) => a.usuario_registro },
    { key: 'acciones', label: 'Comprobante', sortable: false, rol: 'acciones', value: () => '' },
  ];
  protected readonly abonoId = (a: Abono) => a.id_abono;

  protected comparteConAnterior(indice: number): boolean {
    const filas = this.listado.datos()?.items ?? [];
    return indice > 0 && filas[indice - 1]?.id_recibo === filas[indice]?.id_recibo;
  }
}
