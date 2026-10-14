import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';
import { ClaveIdempotente } from '../../core/api/idempotencia';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { FiltrosPlegablesComponent } from '../../shared/ui/filtros-plegables/filtros-plegables.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SelectorBuscableComponent } from '../../shared/ui/selector-buscable/selector-buscable.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { formatoCop, formatoFecha, formatoNumero } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { FiltroFechasComponent } from '../auditoria/filtro-fechas.component';
import { CATALOGOS_REPOSITORY } from '../catalogos/data/catalogos.provider';
import { VerComprobanteComponent } from '../comprobantes/ver-comprobante.component';
import { CompraDialogComponent } from './compra-dialog.component';
import { INSUMOS_REPOSITORY } from './data/insumos.provider';
import { cargarInsumosActivos } from './insumos-activos';
import type { Compra, EstadoCompra } from './models/insumos.models';

@Component({
  selector: 'app-compras-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CompraDialogComponent, ConfirmDialogComponent, DataTableCellDirective, FiltroFechasComponent, FiltrosPlegablesComponent, HasRoleDirective, IconComponent, SelectorBuscableComponent, ServerDataTableComponent, StatusChipComponent, VerComprobanteComponent],
  template: `
    <app-filtros-plegables clases="mb-4 flex flex-wrap items-end gap-3">
      <div class="w-full sm:w-64">
        <label for="compras-insumo" class="mb-1 block text-xs font-medium text-muted-foreground">Insumo</label>
        <app-selector-buscable idCampo="compras-insumo" [opciones]="insumos.opciones()" [(valor)]="insumo" etiquetaVacia="Todos los insumos" placeholder="Buscar insumo…" />
      </div>
      <div class="w-full sm:w-64">
        <label for="compras-proveedor" class="mb-1 block text-xs font-medium text-muted-foreground">Proveedor</label>
        <app-selector-buscable idCampo="compras-proveedor" [opciones]="proveedores()" [(valor)]="proveedor" etiquetaVacia="Todos los proveedores" placeholder="Buscar proveedor…" />
      </div>
      <div>
        <label for="compras-estado" class="mb-1 block text-xs font-medium text-muted-foreground">Estado</label>
        <select id="compras-estado" class="sila-select w-40" (change)="estado.set($any($event.target).value)">
          <option value="" [selected]="estado() === ''">Todas</option>
          <option value="VIGENTE" [selected]="estado() === 'VIGENTE'">Vigentes</option>
          <option value="ANULADA" [selected]="estado() === 'ANULADA'">Anuladas</option>
        </select>
      </div>
      <app-filtro-fechas idBase="compras" [desde]="desde()" [hasta]="hasta()" (desdeChange)="desde.set($event)" (hastaChange)="hasta.set($event)" />
      <button *hasRole="'ADMIN'" type="button" data-accion class="sila-btn sila-btn-primary ms-auto" (click)="dialogo.set(true)">
        <app-icon name="lucidePlus" class="size-4" aria-hidden="true" />
        Registrar compra
      </button>
    </app-filtros-plegables>

    <app-server-data-table
      titulo="Compras de insumos"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="compraId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="null"
      vacioTitulo="No hay compras que coincidan"
      vacioAyuda="Cambia los filtros o registra una compra."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="fecha" [cellRows]="listado.datos()?.items" let-c><span class="whitespace-nowrap" [class.line-through]="c.estado === 'ANULADA'">{{ fecha(c.fecha) }}</span></ng-template>
      <ng-template appDataTableCell="insumo" [cellRows]="listado.datos()?.items" let-c><span [class.line-through]="c.estado === 'ANULADA'">{{ c.insumo }}</span></ng-template>
      <ng-template appDataTableCell="cantidad" [cellRows]="listado.datos()?.items" let-c><span class="whitespace-nowrap tabular-nums">{{ numero(c.cantidad) }} {{ c.unidad_medida }}</span></ng-template>
      <ng-template appDataTableCell="valor_total" [cellRows]="listado.datos()?.items" let-c><span class="tabular-nums">{{ cop(c.valor_total) }}</span></ng-template>
      <ng-template appDataTableCell="costo_unitario" [cellRows]="listado.datos()?.items" let-c><span class="whitespace-nowrap tabular-nums">{{ cop(c.costo_unitario) }} / {{ c.unidad_medida }}</span></ng-template>
      <ng-template appDataTableCell="estado" [cellRows]="listado.datos()?.items" let-c>
        <app-status-chip [texto]="c.estado === 'VIGENTE' ? 'Vigente' : 'Anulada'" [tono]="c.estado === 'VIGENTE' ? 'exito' : 'peligro'" />
        @if (c.estado === 'ANULADA' && c.motivo_anulacion) {
          <span class="mt-1 block max-w-56 text-xs text-muted-foreground">Motivo: {{ c.motivo_anulacion }}</span>
        }
      </ng-template>
      <ng-template appDataTableCell="acciones" [cellRows]="listado.datos()?.items" let-c>
        <app-ver-comprobante class="me-2 inline-block" tipo="COMPRA_INSUMO" [id]="c.id_compra" />
        @if (c.estado === 'VIGENTE') {
          <button *hasRole="'ADMIN'" type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="anulando.set(c)">Anular<span class="sr-only"> la compra de {{ c.insumo }}</span></button>
        }
      </ng-template>
    </app-server-data-table>

    <app-compra-dialog [abierto]="dialogo()" [insumos]="insumos.insumos()" [proveedores]="proveedores()" (registrada)="alRegistrar($event)" (cerrar)="dialogo.set(false)" />

    <app-confirm-dialog
      [open]="anulando() !== null"
      titulo="Anular compra"
      [mensaje]="'Se anulará la compra de ' + (anulando() ? numero(anulando()!.cantidad) + ' ' + anulando()!.unidad_medida + ' de ' + anulando()!.insumo : '') + ': el stock baja y el costo promedio se recalcula. Solo es posible si el stock alcanza para devolver lo comprado.'"
      textoConfirmar="Anular compra"
      [peligro]="true"
      [motivo]="regla"
      [ocupado]="procesando()"
      (confirmar)="anular($event)"
      (cancelar)="anulando.set(null)"
    />
  `,
})
export class ComprasTabComponent {
  private readonly repo = inject(INSUMOS_REPOSITORY);
  private readonly catalogos = inject(CATALOGOS_REPOSITORY);
  private readonly toast = inject(ToastService);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly insumos = cargarInsumosActivos();
  protected readonly regla = { min: 10, max: 255 };
  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;
  protected readonly fecha = formatoFecha;

  /** SUPUESTO: IR-02. Proveedores de tipo INSUMOS activos, hasta 100. */
  private readonly proveedoresRecurso = rxResource({
    stream: () => this.catalogos.listarProveedores({ tipo_proveedor: 'INSUMOS', activo: true, page: 0, size: 100, sort: 'nombre,asc' }),
  });
  protected readonly proveedores = computed(() => (this.proveedoresRecurso.hasValue() ? this.proveedoresRecurso.value().items.map((p) => ({ valor: p.id_proveedor, etiqueta: p.nombre })) : []));

  protected readonly insumo = signal<number | null>(null);
  protected readonly proveedor = signal<number | null>(null);
  protected readonly estado = signal<'' | EstadoCompra>('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly dialogo = signal(false);
  protected readonly anulando = signal<Compra | null>(null);
  protected readonly procesando = signal(false);
  private readonly clave = new ClaveIdempotente();

  protected readonly listado = crearListado({
    filtros: () => ({
      id_insumo: this.insumo() ?? undefined,
      id_proveedor: this.proveedor() ?? undefined,
      estado: this.estado() || undefined,
      desde: this.desde() || undefined,
      hasta: this.hasta() || undefined,
    }),
    cargar: (query) => this.repo.listarCompras(query),
    // The contract lists no sort for this endpoint: none is sent.
    sort: '',
  });

  protected readonly columnas: DataTableColumn<Compra>[] = [
    { key: 'fecha', label: 'Fecha', sortable: false, value: (c) => c.fecha },
    { key: 'insumo', label: 'Insumo', rol: 'titulo', sortable: false, value: (c) => c.insumo },
    { key: 'proveedor', label: 'Proveedor', sortable: false, ocultarEnMovil: true, value: (c) => c.proveedor ?? '—' },
    { key: 'cantidad', label: 'Cantidad', sortable: false, align: 'end', value: (c) => c.cantidad },
    { key: 'valor_total', label: 'Valor factura', sortable: false, align: 'end', value: (c) => c.valor_total },
    { key: 'costo_unitario', label: 'Costo unitario', sortable: false, align: 'end', value: (c) => c.costo_unitario },
    { key: 'referencia', label: 'Referencia', sortable: false, ocultarEnMovil: true, value: (c) => c.referencia ?? '—' },
    { key: 'estado', label: 'Estado', sortable: false, value: (c) => c.estado },
    { key: 'acciones', label: 'Acciones', sortable: false, value: () => '' },
  ];
  protected readonly compraId = (c: Compra) => c.id_compra;

  protected alRegistrar(compra: Compra): void {
    this.dialogo.set(false);
    this.listado.recargar();
    this.insumos.recargar();
    this.toast.exito(`Compra registrada: ${formatoNumero(compra.cantidad)} ${compra.unidad_medida} de ${compra.insumo} a ${formatoCop(compra.costo_unitario)} c/u.`);
  }

  protected anular(motivo: string): void {
    const compra = this.anulando();
    if (!compra || this.procesando()) return;
    this.procesando.set(true);
    this.repo
      .anularCompra(compra.id_compra, motivo, this.clave.para({ id: compra.id_compra, motivo }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.procesando.set(false);
          this.clave.exito();
          this.anulando.set(null);
          this.listado.recargar();
          this.insumos.recargar();
          this.toast.exito('Compra anulada.');
        },
        error: (fallo: unknown) => {
          this.procesando.set(false);
          this.clave.fallo(fallo);
          this.anulando.set(null);
          const error = causaDe(fallo);
          const base = mensajeDeFallo(this.errores, fallo, [20004, 20006, 20007, 20010]);
          // 409 / 20002: part of what was bought is already spent in production.
          this.toast.error(isApiError(error) && error.code === 20002 ? (/anular/i.test(error.message) ? error.message : `No se puede anular: ya se gastó parte de lo comprado. ${error.message}`) : base);
        },
      });
  }
}
