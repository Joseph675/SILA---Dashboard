import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { AyudaComponent } from '../../shared/ui/ayuda/ayuda.component';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { MontoComponent } from '../../shared/ui/monto/monto.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoCop, formatoFecha, formatoNumero } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { etiquetaQuincena } from '../periodos/periodos.format';
import { ACOPIO_REPOSITORY } from './data/acopio.provider';
import type { PagoProveedor, SaldoProveedor } from './models/acopio.models';
import { PagoLecheroDialogComponent } from './pago-lechero-dialog.component';
import { PagosTablaComponent } from './pagos-tabla.component';

/** «Cuánto le debo»: what is owed to each lechero, the quincenas behind it and the payments made. */
@Component({
  selector: 'app-lecheros-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AyudaComponent, DataTableCellDirective, DialogComponent, HasRoleDirective, MontoComponent, PagoLecheroDialogComponent, PagosTablaComponent, ServerDataTableComponent],
  template: `
    <div class="mb-6 grid gap-4 sm:grid-cols-3" data-testid="tarjetas-saldos">
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Total comprado <app-ayuda texto="Valor de toda la leche aprobada recibida (litros × precio del día de la entrega)." /></p>
        <p class="mt-1 text-2xl font-bold"><app-monto [valor]="totales().comprado" /></p>
      </div>
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Total pagado <app-ayuda texto="Pagos vigentes a lecheros. Los anulados no cuentan." /></p>
        <p class="mt-1 text-2xl font-bold"><app-monto [valor]="totales().pagado" /></p>
      </div>
      <div class="sila-card border-primary/50 p-4">
        <p class="text-sm text-muted-foreground">Total que se debe <app-ayuda texto="Suma de los saldos de todos los lecheros: comprado menos pagado." /></p>
        <p class="mt-1 text-2xl font-bold" data-testid="total-debe"><app-monto [valor]="totales().saldo" [destacado]="true" /></p>
      </div>
    </div>
    @if (resumen.error()) {
      <p class="-mt-3 mb-4 text-sm text-destructive" role="alert">No se pudieron calcular los totales. <button type="button" class="underline" (click)="resumen.reload()">Reintentar</button></p>
    }

    <label class="mb-3 flex items-center gap-2 text-sm">
      <input type="checkbox" class="size-4" [checked]="soloConDeuda()" (change)="soloConDeuda.set($any($event.target).checked)" />
      Solo con deuda
    </label>

    <app-server-data-table
      titulo="Saldos por lechero"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="saldoId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="listado.sort()"
      vacioTitulo="No hay lecheros con deuda"
      vacioAyuda="Quita «Solo con deuda» para ver a todos."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (sortChange)="listado.sort.set($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="precio_vigente" [cellRows]="listado.datos()?.items" let-s>
        <span class="whitespace-nowrap tabular-nums">{{ cop(s.precio_vigente) }}</span>
        @if (esPorDefecto(s)) {
          <span class="ms-1 rounded bg-muted px-1.5 py-0.5 text-xs" title="Este lechero no tiene precio propio: se usa el precio por defecto.">precio por defecto</span>
        }
      </ng-template>
      <ng-template appDataTableCell="litros_aprobados" [cellRows]="listado.datos()?.items" let-s><span class="tabular-nums">{{ numero(s.litros_aprobados) }} L</span></ng-template>
      <ng-template appDataTableCell="total_comprado" [cellRows]="listado.datos()?.items" let-s><app-monto [valor]="s.total_comprado" /></ng-template>
      <ng-template appDataTableCell="total_pagado" [cellRows]="listado.datos()?.items" let-s><app-monto [valor]="s.total_pagado" /></ng-template>
      <ng-template appDataTableCell="saldo" [cellRows]="listado.datos()?.items" let-s><app-monto [valor]="s.saldo" [destacado]="s.saldo > 0" /></ng-template>
      <ng-template appDataTableCell="ultima_entrega" [cellRows]="listado.datos()?.items" let-s>{{ s.ultima_entrega ? fecha(s.ultima_entrega) : '—' }}</ng-template>
      <ng-template appDataTableCell="ultimo_pago" [cellRows]="listado.datos()?.items" let-s>{{ s.ultimo_pago ? fecha(s.ultimo_pago) : '—' }}</ng-template>
      <ng-template appDataTableCell="acciones" [cellRows]="listado.datos()?.items" let-s>
        <div class="flex flex-wrap gap-1.5">
          <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="detalle.set(s)">Ver detalle<span class="sr-only"> de {{ s.proveedor }}</span></button>
          <button *hasRole="'ADMIN'" type="button" class="sila-btn sila-btn-primary sila-btn-sm" [disabled]="s.saldo <= 0" (click)="pagando.set(s)">Registrar pago<span class="sr-only"> a {{ s.proveedor }}</span></button>
        </div>
      </ng-template>
    </app-server-data-table>

    <h2 class="mb-3 mt-8 text-base font-semibold">Pagos realizados</h2>
    <app-pagos-tabla [version]="version()" (anulado)="recargar()" />

    <app-dialog [open]="detalle() !== null" [title]="'Detalle · ' + (detalle()?.proveedor ?? '')" [wide]="true" (closed)="detalle.set(null)">
      @if (detalle(); as d) {
        <h3 class="mb-2 text-sm font-semibold">Sus quincenas</h3>
        @if (quincenas.hasValue()) {
          <div class="mb-6 overflow-x-auto">
            <table class="w-full text-left text-sm">
              <caption class="sr-only">Quincenas de {{ d.proveedor }}</caption>
              <thead class="text-xs text-muted-foreground">
                <tr>
                  <th scope="col" class="py-1 pe-2 font-medium">Quincena</th>
                  <th scope="col" class="px-2 py-1 text-end font-medium">Litros</th>
                  <th scope="col" class="px-2 py-1 text-end font-medium">Precio prom.</th>
                  <th scope="col" class="px-2 py-1 text-end font-medium">Valor</th>
                  <th scope="col" class="px-2 py-1 text-end font-medium">Pagado</th>
                  <th scope="col" class="py-1 ps-2 text-end font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                @for (q of quincenas.value().items; track q.id_periodo) {
                  <tr class="border-t border-border">
                    <td class="py-1.5 pe-2">{{ q.anio }} · {{ quincena(q.mes, q.quincena) }}</td>
                    <td class="px-2 py-1.5 text-end tabular-nums">{{ numero(q.litros_a_pagar) }}</td>
                    <td class="px-2 py-1.5 text-end tabular-nums">{{ cop(q.precio_promedio) }}</td>
                    <td class="px-2 py-1.5 text-end"><app-monto [valor]="q.valor_leche" /></td>
                    <td class="px-2 py-1.5 text-end"><app-monto [valor]="q.valor_pagado" /></td>
                    <td class="py-1.5 ps-2 text-end"><app-monto [valor]="q.saldo" [destacado]="q.saldo > 0" /></td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="py-3 text-center text-muted-foreground">Sin entregas.</td></tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (quincenas.error()) {
          <p class="mb-6 text-sm text-destructive" role="alert">No se pudieron cargar las quincenas.</p>
        } @else {
          <p class="mb-6 text-sm text-muted-foreground" aria-busy="true">Cargando…</p>
        }
        <h3 class="mb-2 text-sm font-semibold">Sus pagos</h3>
        <app-pagos-tabla [idProveedor]="d.id_proveedor" [version]="version()" (anulado)="recargar()" />
      }
      <button dialogFooter type="button" class="sila-btn sila-btn-primary" (click)="detalle.set(null)">Cerrar</button>
    </app-dialog>

    <app-pago-lechero-dialog
      [proveedor]="pagando() ? { id_proveedor: pagando()!.id_proveedor, nombre: pagando()!.proveedor } : null"
      (registrado)="alPagar($event)"
      (cerrado)="pagando.set(null)"
    />
  `,
})
export class LecherosTabComponent {
  private readonly repo = inject(ACOPIO_REPOSITORY);
  private readonly toast = inject(ToastService);

  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;
  protected readonly fecha = formatoFecha;
  protected readonly quincena = etiquetaQuincena;

  protected readonly soloConDeuda = signal(true);
  protected readonly detalle = signal<SaldoProveedor | null>(null);
  protected readonly pagando = signal<SaldoProveedor | null>(null);
  /** Bumped when a payment is made or annulled, so the payments tables reload. */
  protected readonly version = signal(0);

  /**
   * SUPUESTO: CP-03. Los totales de las tarjetas suman los saldos de TODOS los lecheros (se piden hasta 100, el máximo de
   * una página), sin depender del filtro «Solo con deuda» de la tabla.
   */
  protected readonly resumen = rxResource({ stream: () => this.repo.saldos({ page: 0, size: 100 }) });
  protected readonly totales = computed(() => {
    const filas = this.resumen.hasValue() ? this.resumen.value().items : [];
    const suma = (c: 'total_comprado' | 'total_pagado' | 'saldo') => Math.round(filas.reduce((s, f) => s + f[c], 0) * 100) / 100;
    return { comprado: suma('total_comprado'), pagado: suma('total_pagado'), saldo: suma('saldo') };
  });

  protected readonly listado = crearListado({
    filtros: () => ({ solo_con_saldo: this.soloConDeuda() }),
    cargar: (query) => this.repo.saldos(query),
    sort: 'saldo,desc',
  });

  protected readonly quincenas = rxResource({
    params: () => this.detalle()?.id_proveedor,
    stream: ({ params }) => this.repo.pagoLecheros({ id_proveedor: params, page: 0, size: 50 }),
  });

  /** Lecheros with their own price vigente (the rest are paid at the default price). */
  private readonly propios = rxResource({ stream: () => this.repo.listarPrecios({ page: 0, size: 100, solo_vigentes: true }) });
  protected readonly esPorDefecto = (s: SaldoProveedor) => this.propios.hasValue() && !this.propios.value().items.some((p) => p.id_proveedor === s.id_proveedor);

  // Only the sort fields the API lists for saldos would be safe; the contract names only the default (`saldo,desc`).
  protected readonly columnas: DataTableColumn<SaldoProveedor>[] = [
    { key: 'proveedor', label: 'Lechero', sortable: false, value: (s) => s.proveedor },
    { key: 'precio_vigente', label: 'Precio vigente', sortable: false, align: 'end', value: (s) => s.precio_vigente },
    { key: 'litros_aprobados', label: 'Litros', sortable: false, align: 'end', value: (s) => s.litros_aprobados },
    { key: 'total_comprado', label: 'Comprado', sortable: false, align: 'end', value: (s) => s.total_comprado },
    { key: 'total_pagado', label: 'Pagado', sortable: false, align: 'end', value: (s) => s.total_pagado },
    { key: 'saldo', label: 'Saldo', align: 'end', value: (s) => s.saldo },
    { key: 'ultima_entrega', label: 'Última entrega', sortable: false, value: (s) => s.ultima_entrega ?? '' },
    { key: 'ultimo_pago', label: 'Último pago', sortable: false, value: (s) => s.ultimo_pago ?? '' },
    { key: 'acciones', label: 'Acciones', sortable: false, value: () => '' },
  ];
  protected readonly saldoId = (s: SaldoProveedor) => s.id_proveedor;

  protected recargar(): void {
    this.listado.recargar();
    this.resumen.reload();
    this.quincenas.reload();
    this.version.update((v) => v + 1);
  }

  protected alPagar(pago: PagoProveedor): void {
    this.pagando.set(null);
    this.recargar();
    this.toast.exito(`Pago de ${formatoCop(pago.monto)} a ${pago.proveedor} registrado.`);
  }
}
