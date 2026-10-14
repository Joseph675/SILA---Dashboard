import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ApiErrorService } from '../../core/api/api-error';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { AyudaComponent } from '../../shared/ui/ayuda/ayuda.component';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { MontoComponent } from '../../shared/ui/monto/monto.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoCop, formatoNumero } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { ACOPIO_REPOSITORY } from '../acopio/data/acopio.provider';
import type { PagoLechero, PagoProveedor } from '../acopio/models/acopio.models';
import { PagoLecheroDialogComponent } from '../acopio/pago-lechero-dialog.component';
import { PERIODOS_REPOSITORY } from './data/periodos.provider';
import type { Periodo } from './models/periodos.models';
import { etiquetaQuincena } from './periodos.format';

interface Fila {
  etiqueta: string;
  valor: number | string;
  /** `true` = a COP amount; `false` = plain text (liters). */
  dinero: boolean;
  ayuda: string;
  /** Indented sub-line (a part of the line above). */
  detalle?: boolean;
  destacada?: boolean;
}

/**
 * «Cuentas de la quincena»: what was sold and collected, what is owed to the lecheros, and TWO different results
 * (what the quincena EARNED and the CASH that came in and out). They are never added together.
 */
@Component({
  selector: 'app-cuentas-quincena-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AyudaComponent, DataTableCellDirective, HasRoleDirective, IconComponent, MontoComponent, PageHeaderComponent, PagoLecheroDialogComponent, RouterLink, ServerDataTableComponent, StatusChipComponent],
  template: `
    <app-page-header [title]="'Cuentas de la quincena'" [description]="subtitulo()">
      <a routerLink="/periodos" class="sila-btn sila-btn-outline shrink-0">
        <app-icon name="lucideArrowLeft" class="size-4" aria-hidden="true" />
        Todas las quincenas
      </a>
    </app-page-header>

    @if (periodo.error()) {
      <div role="alert" class="sila-card p-6 text-center">
        <p class="mb-3 font-medium">{{ errorTexto() }}</p>
        <button type="button" class="sila-btn sila-btn-outline" (click)="periodo.reload()">Reintentar</button>
      </div>
    } @else if (periodo.hasValue()) {
      @let p = periodo.value();
      <div class="mb-6 flex flex-wrap items-center gap-3">
        <app-status-chip [texto]="p.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'" [tono]="p.estado === 'ABIERTA' ? 'exito' : 'neutro'" />
        <span class="text-sm text-muted-foreground">{{ etiqueta() }}</span>
        @if (p.estado === 'CERRADA') {
          <span class="text-sm" role="status" data-testid="aviso-cerrada">Quincena cerrada: las acciones están deshabilitadas.</span>
        }
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <section class="sila-card p-5" aria-labelledby="bloque-ventas">
          <h2 id="bloque-ventas" class="mb-3 text-base font-semibold">Ventas y cobros</h2>
          <ul class="divide-y divide-border text-sm">
            @for (f of ventas(); track f.etiqueta) {
              <li class="flex items-center justify-between gap-3 py-2" [class.ps-5]="f.detalle" [class.text-muted-foreground]="f.detalle">
                <span>{{ f.etiqueta }} <app-ayuda [texto]="f.ayuda" /></span>
                <app-monto [valor]="+f.valor" [destacado]="!!f.destacada" />
              </li>
            }
          </ul>
        </section>

        <section class="sila-card p-5" aria-labelledby="bloque-leche">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h2 id="bloque-leche" class="text-base font-semibold">Leche y lecheros</h2>
            <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" [attr.aria-expanded]="verLecheros()" (click)="verLecheros.set(!verLecheros())">
              {{ verLecheros() ? 'Ocultar lecheros' : 'Ver por lechero' }}
            </button>
          </div>
          <ul class="divide-y divide-border text-sm">
            @for (f of leche(); track f.etiqueta) {
              <li class="flex items-center justify-between gap-3 py-2" [class.rounded-md]="f.destacada" [class.bg-primary/10]="f.destacada" [class.px-2]="f.destacada" [class.font-semibold]="f.destacada">
                <span>{{ f.etiqueta }} <app-ayuda [texto]="f.ayuda" /></span>
                @if (f.dinero) {
                  <app-monto [valor]="+f.valor" [destacado]="!!f.destacada" />
                } @else {
                  <span class="tabular-nums">{{ f.valor }}</span>
                }
              </li>
            }
          </ul>
        </section>
      </div>

      @if (verLecheros()) {
        <section class="mt-6" aria-labelledby="por-lechero">
          <h2 id="por-lechero" class="mb-3 text-base font-semibold">Por lechero · {{ etiqueta() }}</h2>
          <app-server-data-table
            titulo="Leche por lechero"
            [columns]="columnas"
            [page]="lecheros.datos()"
            [rowId]="filaId"
            [cargando]="lecheros.cargando()"
            [error]="lecheros.error()"
            [sort]="null"
            vacioTitulo="No hubo entregas en esta quincena"
            (pageChange)="lecheros.irAPagina($event)"
            (sizeChange)="lecheros.cambiarTamano($event)"
            (reintentar)="lecheros.recargar()"
          >
            <ng-template appDataTableCell="litros_a_pagar" [cellRows]="lecheros.datos()?.items" let-l><span class="tabular-nums">{{ numero(l.litros_a_pagar) }} L</span></ng-template>
            <ng-template appDataTableCell="precio_promedio" [cellRows]="lecheros.datos()?.items" let-l><span class="tabular-nums">{{ cop(l.precio_promedio) }}</span></ng-template>
            <ng-template appDataTableCell="valor_leche" [cellRows]="lecheros.datos()?.items" let-l><app-monto [valor]="l.valor_leche" /></ng-template>
            <ng-template appDataTableCell="valor_pagado" [cellRows]="lecheros.datos()?.items" let-l><app-monto [valor]="l.valor_pagado" /></ng-template>
            <ng-template appDataTableCell="saldo" [cellRows]="lecheros.datos()?.items" let-l><app-monto [valor]="l.saldo" [destacado]="l.saldo > 0" /></ng-template>
            <ng-template appDataTableCell="acciones" [cellRows]="lecheros.datos()?.items" let-l>
              <button *hasRole="'ADMIN'" type="button" class="sila-btn sila-btn-primary sila-btn-sm" [disabled]="p.estado === 'CERRADA' || l.saldo <= 0" (click)="pagando.set(l)">
                Pagar<span class="sr-only"> a {{ l.proveedor }}</span>
              </button>
            </ng-template>
          </app-server-data-table>
        </section>
      }

      <section class="mt-6" aria-labelledby="bloque-resultado">
        <h2 id="bloque-resultado" class="mb-3 text-base font-semibold">Resultado y caja</h2>
        <div class="grid gap-6 lg:grid-cols-2">
          <article class="sila-card border-l-4 border-l-primary p-5" aria-labelledby="res-titulo" data-testid="tarjeta-resultado">
            <h3 id="res-titulo" class="text-sm font-semibold">Resultado (lo que ganó la quincena)
              <app-ayuda texto="Lo que la quincena ganó, se haya cobrado o pagado ya o no. No es plata en la mano." /></h3>
            <p class="my-2 text-3xl font-bold" data-testid="valor-resultado"><app-monto [valor]="p.resultado_estimado" [destacado]="true" /></p>
            <p class="text-xs text-muted-foreground">Ventas sin IVA − Costo de producción − Gastos − Cartera castigada</p>
            <dl class="mt-3 space-y-1 text-sm">
              <div class="flex justify-between"><dt>Ventas sin IVA</dt><dd><app-monto [valor]="p.ingresos_ventas" /></dd></div>
              <div class="flex justify-between"><dt>− Costo de producción</dt><dd><app-monto [valor]="p.costo_produccion" /></dd></div>
              <div class="flex justify-between"><dt>− Gastos</dt><dd><app-monto [valor]="p.gastos_operativos" /></dd></div>
              <div class="flex justify-between"><dt>− Cartera castigada</dt><dd><app-monto [valor]="p.cartera_castigada" /></dd></div>
            </dl>
          </article>
          <article class="sila-card border-l-4 border-l-chart-2 p-5" aria-labelledby="caja-titulo" data-testid="tarjeta-caja">
            <h3 id="caja-titulo" class="text-sm font-semibold">Caja (plata que entró y salió)
              <app-ayuda texto="Lo que realmente se cobró menos lo que realmente se pagó durante la quincena: a lecheros, en compras de insumos y en gastos." /></h3>
            <p class="my-2 text-3xl font-bold" data-testid="valor-caja"><app-monto [valor]="p.caja_neta" [destacado]="true" /></p>
            <p class="text-xs text-muted-foreground">Cobrado − Pagos a lecheros − Compras de insumos − Gastos</p>
            <dl class="mt-3 space-y-1 text-sm">
              <div class="flex justify-between"><dt>Cobrado</dt><dd><app-monto [valor]="p.total_cobrado" /></dd></div>
              <div class="flex justify-between"><dt>− Pagos a lecheros <app-ayuda texto="Pagos hechos durante la quincena, de la leche de cualquier quincena." /></dt><dd><app-monto [valor]="p.pagos_proveedores_caja" /></dd></div>
              <div class="flex justify-between"><dt>− Compras de insumos <app-ayuda texto="Compras vigentes de azúcar, envases y demás insumos hechas en la quincena. Se asume que se pagan al comprar." /></dt><dd><app-monto [valor]="p.compras_insumos" /></dd></div>
              <div class="flex justify-between"><dt>− Gastos</dt><dd><app-monto [valor]="p.gastos_operativos" /></dd></div>
            </dl>
          </article>
        </div>
        <p class="mt-3 text-xs text-muted-foreground" data-testid="nota-resultado">
          El costo de la leche entra en el resultado cuando se produce; lo que se debe a los lecheros se ve aparte. Estas dos cifras miran cosas distintas: no se suman.
        </p>
      </section>
    } @else {
      <p class="text-sm text-muted-foreground" aria-busy="true">Cargando las cuentas…</p>
    }

    <app-pago-lechero-dialog
      [proveedor]="pagando() ? { id_proveedor: pagando()!.id_proveedor, nombre: pagando()!.proveedor } : null"
      [periodoInicial]="id()"
      (registrado)="alPagar($event)"
      (cerrado)="pagando.set(null)"
    />
  `,
})
export class CuentasQuincenaPageComponent {
  private readonly repo = inject(PERIODOS_REPOSITORY);
  private readonly acopio = inject(ACOPIO_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly toast = inject(ToastService);

  private readonly route = inject(ActivatedRoute);
  /** Route parameter `:id`. */
  protected readonly id = toSignal(this.route.paramMap.pipe(map((p) => Number(p.get('id')))), { initialValue: Number(this.route.snapshot.paramMap.get('id')) });

  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;

  protected readonly periodo = rxResource({ params: () => this.id(), stream: ({ params }) => this.repo.obtener(params) });
  protected readonly errorTexto = computed(() => (this.periodo.error() ? this.errores.describe(this.periodo.error()).mensaje : ''));
  protected readonly etiqueta = computed(() => {
    const p = this.periodo.hasValue() ? this.periodo.value() : null;
    return p ? `${etiquetaQuincena(p.mes, p.quincena)} de ${p.anio}` : '';
  });
  protected readonly subtitulo = computed(() => (this.etiqueta() ? `${this.etiqueta()}: lo vendido, lo cobrado, lo que se debe a los lecheros y cómo quedó la quincena.` : 'Lo vendido, lo cobrado, lo que se debe a los lecheros y cómo quedó la quincena.'));

  protected readonly verLecheros = signal(false);
  protected readonly pagando = signal<PagoLechero | null>(null);

  protected readonly ventas = computed<Fila[]>(() => {
    const p = this.periodo.hasValue() ? this.periodo.value() : null;
    if (!p) return [];
    return [
      { etiqueta: 'Total vendido (con IVA)', valor: p.total_vendido, dinero: true, destacada: true, ayuda: 'Todas las ventas de la quincena con IVA, sin contar las anuladas.' },
      { etiqueta: 'De contado', valor: p.ventas_contado, dinero: true, detalle: true, ayuda: 'Ventas que se pagaron en el momento.' },
      { etiqueta: 'A crédito', valor: p.ventas_credito, dinero: true, detalle: true, ayuda: 'Ventas que quedaron como deuda del cliente.' },
      { etiqueta: 'Cobrado en la quincena', valor: p.total_cobrado, dinero: true, destacada: true, ayuda: 'Plata que realmente entró: pagos de contado más abonos de cartera recibidos en estas fechas.' },
      { etiqueta: 'Contado cobrado', valor: p.cobrado_contado, dinero: true, detalle: true, ayuda: 'Pagos recibidos de ventas de contado de esta quincena.' },
      { etiqueta: 'Abonos de cartera', valor: p.cobrado_abonos, dinero: true, detalle: true, ayuda: 'Abonos recibidos en esta quincena, aunque sean de ventas de otra.' },
      { etiqueta: 'Cartera pendiente de esta quincena', valor: p.cartera_pendiente, dinero: true, ayuda: 'Lo que los clientes aún deben de las ventas a crédito de esta quincena.' },
      { etiqueta: 'Cartera castigada', valor: p.cartera_castigada, dinero: true, ayuda: 'Deuda dada de baja como incobrable. Resta en el resultado.' },
    ];
  });

  protected readonly leche = computed<Fila[]>(() => {
    const p = this.periodo.hasValue() ? this.periodo.value() : null;
    if (!p) return [];
    return [
      { etiqueta: 'Litros recibidos', valor: `${formatoNumero(p.leche_litros)} L`, dinero: false, ayuda: 'Litros de leche aprobada recibida en la quincena.' },
      { etiqueta: 'Litros rechazados', valor: `${formatoNumero(p.leche_litros_rechazados)} L`, dinero: false, ayuda: 'Leche que no cumplió la calidad: se registró pero no se paga.' },
      { etiqueta: 'Leche comprada', valor: p.leche_comprada, dinero: true, ayuda: 'Valor de la leche aprobada: litros por el precio del día de cada entrega.' },
      { etiqueta: 'Pagada', valor: p.leche_pagada, dinero: true, ayuda: 'Pagos vigentes a lecheros que liquidan la leche de ESTA quincena.' },
      { etiqueta: 'Por pagar', valor: p.leche_por_pagar, dinero: true, destacada: true, ayuda: 'Leche comprada menos pagada: lo que aún se debe a los lecheros por esta quincena.' },
    ];
  });

  protected readonly lecheros = crearListado({
    filtros: () => ({ id_periodo: this.id() }),
    cargar: (query) => this.acopio.pagoLecheros(query),
    // The contract lists no sort for this endpoint: none is sent.
    sort: '',
    habilitado: () => this.verLecheros(),
  });

  protected readonly columnas: DataTableColumn<PagoLechero>[] = [
    { key: 'proveedor', label: 'Lechero', sortable: false, value: (l) => l.proveedor },
    { key: 'litros_a_pagar', label: 'Litros', sortable: false, align: 'end', value: (l) => l.litros_a_pagar },
    { key: 'precio_promedio', label: 'Precio prom.', sortable: false, align: 'end', value: (l) => l.precio_promedio },
    { key: 'valor_leche', label: 'Valor', sortable: false, align: 'end', value: (l) => l.valor_leche },
    { key: 'valor_pagado', label: 'Pagado', sortable: false, align: 'end', value: (l) => l.valor_pagado },
    { key: 'saldo', label: 'Saldo', sortable: false, align: 'end', value: (l) => l.saldo },
    { key: 'acciones', label: 'Acciones', sortable: false, value: () => '' },
  ];
  protected readonly filaId = (l: PagoLechero) => `${l.id_periodo}-${l.id_proveedor}`;

  protected alPagar(pago: PagoProveedor): void {
    this.pagando.set(null);
    this.periodo.reload();
    this.lecheros.recargar();
    this.toast.exito(`Pago de ${formatoCop(pago.monto)} a ${pago.proveedor} registrado.`);
  }
}
