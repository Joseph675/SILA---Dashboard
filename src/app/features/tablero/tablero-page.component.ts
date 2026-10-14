import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { tap } from 'rxjs';
import { ApiErrorService } from '../../core/api/api-error';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { formatoFecha, formatoNumero } from '../../shared/utils/formato-co';
import type { Notificacion } from '../notificaciones/models/notificaciones.models';
import { NotificacionFilaComponent } from '../notificaciones/notificacion-fila.component';
import { destinoDe } from '../notificaciones/notificaciones.logica';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { TABLERO_REPOSITORY } from './data/tablero.provider';
import type { Tablero } from './models/tablero.models';
import { claseNeto, fechaLarga, formatoPesos, horaCo, tituloQuincena } from './tablero.format';
import { TableroBloqueComponent } from './tablero-bloque.component';
import { TableroTarjetaComponent } from './tablero-tarjeta.component';
import { VentasSemanaChartComponent } from './ventas-semana-chart.component';

/** The figures are a snapshot: asked on entering and every 2 minutes while the screen is visible (never more often). */
export const INTERVALO_TABLERO_MS = 2 * 60 * 1000;

/**
 * Tablero (start screen): everything comes from ONE read-only call, `GET /tablero`. ADMIN and OPERATIVO see the same figures.
 * A failed refresh keeps the last figures on screen and says so.
 */
@Component({
  selector: 'app-tablero-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HasRoleDirective, IconComponent, NotificacionFilaComponent, PageHeaderComponent, RouterLink, StatusChipComponent, TableroBloqueComponent, TableroTarjetaComponent, VentasSemanaChartComponent],
  template: `
    <app-page-header title="Tablero" [description]="descripcion()">
      <div class="flex flex-col items-start gap-1 sm:items-end">
        <button type="button" class="sila-btn sila-btn-outline" data-testid="actualizar" [disabled]="recurso.isLoading()" (click)="recargar()">
          <app-icon name="lucideRefreshCw" class="size-4" [class.animate-spin]="recurso.isLoading()" aria-hidden="true" />
          Actualizar
        </button>
        @if (ultima(); as hora) {
          <span class="text-xs text-muted-foreground" data-testid="hora-actualizacion" aria-live="polite">Actualizado a las {{ hora }}</span>
        }
      </div>
    </app-page-header>

    @if (recurso.error() && !datos()) {
      <div role="alert" class="sila-card p-6 text-center" data-testid="error-tablero">
        <p class="mb-1 font-medium">No se pudo cargar el tablero.</p>
        <p class="mb-3 text-sm text-muted-foreground">{{ mensajeError() }}</p>
        <button type="button" class="sila-btn sila-btn-outline" (click)="recargar()">Reintentar</button>
      </div>
    } @else if (datos(); as t) {
      @if (recurso.error()) {
        <p class="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm" role="status" data-testid="aviso-desactualizado">
          No se pudo actualizar: se muestran las cifras de las {{ ultima() }}.
          <button type="button" class="font-medium underline" (click)="recargar()">Reintentar</button>
        </p>
      }

      <!-- HOY -->
      <section class="mb-8" aria-labelledby="tb-hoy">
        <h2 id="tb-hoy" class="mb-3 text-base font-semibold">Hoy</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <app-tablero-tarjeta titulo="Ventas de hoy" [valor]="pesos(t.hoy.ventas_total)" icono="lucideReceipt">
            <p data-testid="ventas-cantidad">{{ numero(t.hoy.ventas_cantidad) }} {{ t.hoy.ventas_cantidad === 1 ? 'venta' : 'ventas' }}</p>
            <p>Contado {{ pesos(t.hoy.ventas_contado) }} · Crédito {{ pesos(t.hoy.ventas_credito) }}</p>
          </app-tablero-tarjeta>
          <app-tablero-tarjeta titulo="Caja de hoy" [valor]="pesos(t.hoy.caja_neta)" [clase]="neto(t.hoy.caja_neta)" icono="lucideWallet" data-testid="tarjeta-caja">
            <p>Ingresos {{ pesos(t.hoy.caja_ingresos) }}</p>
            <p>Egresos {{ pesos(t.hoy.caja_egresos) }}</p>
          </app-tablero-tarjeta>
          <app-tablero-tarjeta titulo="Leche recibida" [valor]="numero(t.hoy.litros_recibidos) + ' L'" icono="lucideMilk">
            <p>Litros aprobados</p>
            <p data-testid="litros-rechazados">Rechazados: {{ numero(t.hoy.litros_rechazados) }} L</p>
          </app-tablero-tarjeta>
          <app-tablero-tarjeta titulo="Lotes producidos" [valor]="numero(t.hoy.lotes_producidos)" icono="lucideFactory">
            <p>Producción de hoy</p>
          </app-tablero-tarjeta>
        </div>
      </section>

      <!-- QUINCENA ACTUAL -->
      <section class="mb-8" aria-labelledby="tb-quincena">
        @if (t.quincena; as q) {
          <div class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id="tb-quincena" class="text-base font-semibold" data-testid="titulo-quincena">{{ tituloQ(q.mes, q.quincena, q.anio) }}</h2>
            <app-status-chip [texto]="q.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'" [tono]="q.estado === 'ABIERTA' ? 'exito' : 'neutro'" />
            <span class="text-xs text-muted-foreground">{{ fecha(q.fecha_inicio) }} – {{ fecha(q.fecha_fin) }}</span>
            <a *hasRole="'ADMIN'" [routerLink]="['/periodos', q.id_periodo]" class="inline-flex min-h-8 items-center text-xs font-medium text-primary hover:underline max-lg:min-h-11">Ver cuentas de la quincena</a>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <app-tablero-tarjeta titulo="Resultado estimado" [valor]="pesos(q.resultado_estimado)" [clase]="neto(q.resultado_estimado)" icono="lucideChartColumn" data-testid="tarjeta-resultado">
              <p>Estimado de la quincena</p>
            </app-tablero-tarjeta>
            <app-tablero-tarjeta titulo="Caja neta" [valor]="pesos(q.caja_neta)" [clase]="neto(q.caja_neta)" icono="lucideBanknote">
              <p>De toda la quincena</p>
            </app-tablero-tarjeta>
            <app-tablero-tarjeta titulo="Vendido / cobrado" [valor]="pesos(q.total_vendido)" icono="lucideReceipt">
              <p>Cobrado {{ pesos(q.total_cobrado) }}</p>
            </app-tablero-tarjeta>
            <app-tablero-tarjeta titulo="Leche por pagar" [valor]="pesos(q.leche_por_pagar)" icono="lucideMilk">
              <p>{{ numero(q.leche_litros) }} L recibidos</p>
            </app-tablero-tarjeta>
          </div>
        } @else {
          <h2 id="tb-quincena" class="mb-3 text-base font-semibold">Quincena actual</h2>
          <div class="sila-card flex flex-wrap items-center gap-x-3 gap-y-1 border-warning/40 p-4 text-sm" role="status" data-testid="sin-quincena">
            <app-icon name="lucideCircleAlert" class="size-4 text-warning" aria-hidden="true" />
            <span class="font-medium">No hay quincena creada para hoy.</span>
            <a *hasRole="'ADMIN'" routerLink="/periodos" class="inline-flex min-h-8 items-center font-medium text-primary hover:underline max-lg:min-h-11" data-testid="ir-periodos">Crear períodos</a>
          </div>
        }
      </section>

      <!-- VENTAS DE LOS ÚLTIMOS 7 DÍAS -->
      <section class="mb-8" aria-labelledby="tb-semana">
        <h2 id="tb-semana" class="mb-3 text-base font-semibold">Ventas de los últimos 7 días</h2>
        <div class="sila-card p-3 sm:p-4">
          <app-ventas-semana-chart [semana]="t.ventas_semana" />
        </div>
      </section>

      <!-- CARTERA · INVENTARIO · LECHEROS -->
      <section class="mb-8" aria-label="Cartera, inventario y lecheros">
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <app-tablero-bloque titulo="Cartera" icono="lucideWallet" [enlaces]="enlacesCartera">
            <div class="flex items-baseline justify-between gap-3"><dt class="text-muted-foreground">Saldo total</dt><dd class="font-semibold tabular-nums" data-testid="cartera-saldo">{{ pesos(t.cartera.saldo_total) }}</dd></div>
            <div class="flex items-baseline justify-between gap-3"><dt class="text-muted-foreground">Vencido</dt><dd class="font-medium tabular-nums" [class.text-destructive]="t.cartera.saldo_vencido > 0">{{ pesos(t.cartera.saldo_vencido) }}</dd></div>
            <div class="flex items-baseline justify-between gap-3"><dt class="text-muted-foreground">Clientes con saldo</dt><dd class="font-medium tabular-nums">{{ numero(t.cartera.clientes_con_saldo) }}</dd></div>
            <div class="flex items-baseline justify-between gap-3"><dt class="text-muted-foreground">Clientes en mora</dt><dd class="font-medium tabular-nums" [class.text-destructive]="t.cartera.clientes_en_mora > 0">{{ numero(t.cartera.clientes_en_mora) }}</dd></div>
          </app-tablero-bloque>

          <app-tablero-bloque titulo="Inventario" icono="lucideWarehouse" [enlaces]="enlacesInventario">
            <div class="flex items-baseline justify-between gap-3"><dt class="text-muted-foreground">Valor de productos</dt><dd class="font-semibold tabular-nums">{{ pesos(t.inventario.valor_productos) }}</dd></div>
            <div class="flex items-baseline justify-between gap-3"><dt class="text-muted-foreground">Valor de insumos</dt><dd class="font-semibold tabular-nums">{{ pesos(t.inventario.valor_insumos) }}</dd></div>
            <div class="flex items-baseline justify-between gap-3"><dt class="text-muted-foreground">Productos bajo mínimo</dt><dd class="font-medium tabular-nums" [class.text-warning]="t.inventario.productos_bajo_minimo > 0">{{ numero(t.inventario.productos_bajo_minimo) }}</dd></div>
            <div class="flex items-baseline justify-between gap-3"><dt class="text-muted-foreground">Productos agotados</dt><dd class="font-medium tabular-nums" [class.text-destructive]="t.inventario.productos_agotados > 0">{{ numero(t.inventario.productos_agotados) }}</dd></div>
            <div class="flex items-baseline justify-between gap-3"><dt class="text-muted-foreground">Insumos bajo mínimo</dt><dd class="font-medium tabular-nums" [class.text-warning]="t.inventario.insumos_bajo_minimo > 0">{{ numero(t.inventario.insumos_bajo_minimo) }}</dd></div>
            <div class="flex items-baseline justify-between gap-3"><dt class="text-muted-foreground">Lotes por vencer (7 días)</dt><dd class="font-medium tabular-nums" [class.text-warning]="t.inventario.lotes_por_vencer > 0">{{ numero(t.inventario.lotes_por_vencer) }}</dd></div>
          </app-tablero-bloque>

          <app-tablero-bloque titulo="Lecheros" icono="lucideMilk" [enlaces]="enlacesLecheros">
            <div class="flex items-baseline justify-between gap-3"><dt class="text-muted-foreground">Saldo por pagar</dt><dd class="font-semibold tabular-nums" data-testid="lecheros-saldo">{{ pesos(t.lecheros.saldo_por_pagar) }}</dd></div>
            <div class="flex items-baseline justify-between gap-3"><dt class="text-muted-foreground">Proveedores con saldo</dt><dd class="font-medium tabular-nums">{{ numero(t.lecheros.proveedores_con_saldo) }}</dd></div>
          </app-tablero-bloque>
        </div>
      </section>

      <!-- ALERTAS -->
      <section class="mb-4" aria-labelledby="tb-alertas">
        <div class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id="tb-alertas" class="text-base font-semibold">Alertas</h2>
          @if (t.alertas.criticas > 0) {
            <app-status-chip [texto]="t.alertas.criticas + (t.alertas.criticas === 1 ? ' crítica' : ' críticas')" tono="peligro" />
          }
        </div>
        <div class="sila-card p-2" data-testid="alertas-tablero">
          @for (n of t.alertas.principales; track n.clave) {
            <app-notificacion-fila [notificacion]="n" [leida]="notificaciones.esLeida(n)" (abrir)="ir($event)" />
          } @empty {
            <p class="px-3 py-6 text-center text-sm text-muted-foreground" data-testid="sin-alertas">Todo en orden: no hay alertas.</p>
          }
          @if (t.alertas.total > 0) {
            <div class="border-t border-border p-2">
              <a routerLink="/notificaciones" class="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-primary hover:underline max-lg:min-h-11" data-testid="ver-todas">
                Ver todas ({{ numero(t.alertas.total) }})
                <app-icon name="lucideArrowUpRight" class="size-3.5" aria-hidden="true" />
              </a>
            </div>
          }
        </div>
      </section>
    } @else {
      <p class="text-sm text-muted-foreground" aria-busy="true" data-testid="cargando-tablero">Cargando…</p>
    }
  `,
})
export class TableroPageComponent {
  private readonly repo = inject(TABLERO_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly router = inject(Router);
  protected readonly notificaciones = inject(NotificacionesService);

  protected readonly pesos = formatoPesos;
  protected readonly numero = formatoNumero;
  protected readonly fecha = formatoFecha;
  protected readonly neto = claseNeto;
  protected readonly tituloQ = tituloQuincena;

  protected readonly enlacesCartera = [{ etiqueta: 'Ver cartera', ruta: '/cartera' }];
  protected readonly enlacesInventario = [
    { etiqueta: 'Ver inventario', ruta: '/inventario' },
    { etiqueta: 'Ver insumos', ruta: '/insumos' },
  ];
  protected readonly enlacesLecheros = [{ etiqueta: 'Ver recepción y pagos', ruta: '/acopio', queryParams: { pestana: 'lecheros' } }];

  private readonly cargadoEn = signal<Date | null>(null);
  /** «Updated at» is stamped when the figures ARRIVE (not from the resource status, which a synchronous answer would skip). */
  protected readonly recurso = rxResource({ stream: () => this.repo.obtener().pipe(tap(() => this.cargadoEn.set(new Date()))) });
  /** The last figures that arrived: a failed refresh does not blank the screen. */
  protected readonly datos = linkedSignal<Tablero | undefined, Tablero | undefined>({
    source: () => (this.recurso.hasValue() ? this.recurso.value() : undefined),
    computation: (nuevo, anterior) => nuevo ?? anterior?.value,
  });

  protected readonly ultima = computed(() => {
    const f = this.cargadoEn();
    return f ? horaCo(f) : null;
  });
  protected readonly descripcion = computed(() => {
    const t = this.datos();
    return t ? `Hoy es ${fechaLarga(t.fecha)}.` : 'Resumen del día, la quincena, la cartera y el inventario.';
  });
  protected readonly mensajeError = computed(() => (this.recurso.error() ? this.errores.describe(this.recurso.error()).mensaje : ''));

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Every 2 minutes, only while the screen is visible; coming back to it after a while refreshes at once.
    const intervalo = setInterval(() => {
      if (!document.hidden) this.recargar();
    }, INTERVALO_TABLERO_MS);
    const alVolver = () => {
      const f = this.cargadoEn();
      if (!document.hidden && f && Date.now() - f.getTime() >= INTERVALO_TABLERO_MS) this.recargar();
    };
    document.addEventListener('visibilitychange', alVolver);
    destroyRef.onDestroy(() => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
    });
  }

  protected recargar(): void {
    if (!this.recurso.isLoading()) this.recurso.reload();
  }

  protected ir(n: Notificacion): void {
    const { ruta, queryParams } = destinoDe(n);
    void this.router.navigate(ruta, { queryParams });
  }
}
