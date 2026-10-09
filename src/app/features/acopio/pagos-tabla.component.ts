import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiErrorService } from '../../core/api/api-error';
import { ClaveIdempotente } from '../../core/api/idempotencia';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { formatoCop, formatoFecha } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { etiquetaMetodo } from '../ventas/ventas.format';
import { etiquetaQuincena } from '../periodos/periodos.format';
import { ACOPIO_REPOSITORY } from './data/acopio.provider';
import type { PagoProveedor } from './models/acopio.models';

/** Payments made to lecheros (all, or one lechero's). An ADMIN can annul a valid one (reason of 10 to 255 characters). */
@Component({
  selector: 'app-pagos-tabla',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, DataTableCellDirective, HasRoleDirective, ServerDataTableComponent, StatusChipComponent],
  template: `
    <app-server-data-table
      titulo="Pagos a lecheros"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="pagoId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="null"
      vacioTitulo="Aún no hay pagos"
      vacioAyuda="Los pagos a lecheros se registran desde «Registrar pago»."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="fecha_pago" [cellRows]="listado.datos()?.items" let-p>
        <span class="whitespace-nowrap" [class.line-through]="p.estado === 'ANULADO'">{{ fecha(p.fecha_pago) }}</span>
      </ng-template>
      <ng-template appDataTableCell="liquida" [cellRows]="listado.datos()?.items" let-p>
        <span [class.line-through]="p.estado === 'ANULADO'">{{ p.anio }} · {{ quincena(p.mes, p.quincena) }}</span>
      </ng-template>
      <ng-template appDataTableCell="monto" [cellRows]="listado.datos()?.items" let-p>
        <span class="font-medium tabular-nums" [class.line-through]="p.estado === 'ANULADO'">{{ cop(p.monto) }}</span>
      </ng-template>
      <ng-template appDataTableCell="metodo_pago" [cellRows]="listado.datos()?.items" let-p>
        <span [class.line-through]="p.estado === 'ANULADO'">{{ metodo(p.metodo_pago) }}@if (p.referencia_pago) { · {{ p.referencia_pago }} }</span>
      </ng-template>
      <ng-template appDataTableCell="estado" [cellRows]="listado.datos()?.items" let-p>
        <app-status-chip [texto]="p.estado === 'VIGENTE' ? 'Vigente' : 'Anulado'" [tono]="p.estado === 'VIGENTE' ? 'exito' : 'peligro'" />
        @if (p.estado === 'ANULADO' && p.motivo_anulacion) {
          <span class="mt-1 block max-w-56 text-xs text-muted-foreground">Motivo: {{ p.motivo_anulacion }}</span>
        }
      </ng-template>
      <ng-template appDataTableCell="acciones" [cellRows]="listado.datos()?.items" let-p>
        @if (p.estado === 'VIGENTE') {
          <button *hasRole="'ADMIN'" type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="anulando.set(p)">Anular<span class="sr-only"> el pago de {{ p.proveedor }}</span></button>
        }
      </ng-template>
    </app-server-data-table>

    <app-confirm-dialog
      [open]="anulando() !== null"
      titulo="Anular pago"
      [mensaje]="'Se anulará el pago de ' + (anulando() ? cop(anulando()!.monto) : '') + ' a ' + (anulando()?.proveedor ?? '') + ': el saldo de esa quincena vuelve a subir. No se puede deshacer.'"
      textoConfirmar="Anular pago"
      [peligro]="true"
      [motivo]="regla"
      [ocupado]="procesando()"
      (confirmar)="anular($event)"
      (cancelar)="anulando.set(null)"
    />
  `,
})
export class PagosTablaComponent {
  private readonly repo = inject(ACOPIO_REPOSITORY);
  private readonly toast = inject(ToastService);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  /** Only this lechero's payments; `null` = all. */
  readonly idProveedor = input<number | null>(null);
  /** Changes when a payment is registered elsewhere, to reload. */
  readonly version = input(0);

  protected readonly regla = { min: 10, max: 255 };
  protected readonly cop = formatoCop;
  protected readonly fecha = formatoFecha;
  protected readonly quincena = etiquetaQuincena;
  protected readonly metodo = etiquetaMetodo as (m: string) => string;
  protected readonly anulando = signal<PagoProveedor | null>(null);
  protected readonly procesando = signal(false);
  private readonly clave = new ClaveIdempotente();

  protected readonly listado = crearListado({
    filtros: () => ({ id_proveedor: this.idProveedor() ?? undefined, _v: this.version() }),
    cargar: ({ _v, ...query }) => this.repo.listarPagos(query),
    // The contract does not list a sort for this endpoint: none is sent.
    sort: '',
    tamanoInicial: 10,
  });

  protected readonly columnas: DataTableColumn<PagoProveedor>[] = [
    { key: 'fecha_pago', label: 'Fecha', sortable: false, value: (p) => p.fecha_pago },
    { key: 'proveedor', label: 'Lechero', sortable: false, value: (p) => p.proveedor },
    { key: 'liquida', label: 'Quincena que paga', sortable: false, value: (p) => `${p.anio} ${p.mes} ${p.quincena}` },
    { key: 'monto', label: 'Monto', sortable: false, align: 'end', value: (p) => p.monto },
    { key: 'metodo_pago', label: 'Medio', sortable: false, value: (p) => p.metodo_pago },
    { key: 'estado', label: 'Estado', sortable: false, value: (p) => p.estado },
    { key: 'acciones', label: 'Acciones', sortable: false, value: () => '' },
  ];
  protected readonly pagoId = (p: PagoProveedor) => p.id_pago;

  protected anular(motivo: string): void {
    const pago = this.anulando();
    if (!pago || this.procesando()) return;
    this.procesando.set(true);
    this.repo
      .anularPago(pago.id_pago, motivo, this.clave.para({ id: pago.id_pago, motivo }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.procesando.set(false);
          this.clave.exito();
          this.anulando.set(null);
          this.listado.recargar();
          this.toast.exito('Pago anulado.');
          this.anulado.emit();
        },
        error: (fallo: unknown) => {
          this.procesando.set(false);
          this.clave.fallo(fallo);
          this.anulando.set(null);
          this.toast.error(mensajeDeFallo(this.errores, fallo, [20004, 20006, 20007, 20010]));
        },
      });
  }

  /** A payment was annulled: balances elsewhere must reload. */
  readonly anulado = output<void>();
}
