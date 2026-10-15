import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { tap } from 'rxjs';
import { ApiErrorService } from '../../core/api/api-error';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { EsMovilService } from '../../shared/services/es-movil.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { MontoComponent } from '../../shared/ui/monto/monto.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { hoyColombia } from '../../shared/utils/fecha-co';
import { formatoCop, formatoFecha, formatoNumero } from '../../shared/utils/formato-co';
import { GASTOS_REPOSITORY } from '../gastos/data/gastos.provider';
import { PERIODOS_REPOSITORY } from '../periodos/data/periodos.provider';
import type { Periodo } from '../periodos/models/periodos.models';
import { etiquetaQuincena } from '../periodos/periodos.format';
import { horaCo } from '../tablero/tablero.format';
import { ResultadoAnioChartComponent } from './resultado-anio-chart.component';
import { anioPorDefecto, cascadaCaja, cascadaResultado, esAtenuada, etiquetaCorta, quincenaPorDefecto, totalesAnio, vecina } from './resultado-quincena.logica';

/** A resource that has not answered yet. After the first answer it is never "pending" again (it "reloads"). */
function pendiente(estado: string): boolean {
  return estado === 'loading' || estado === 'idle';
}

/**
 * «Resultado por quincena» (Finanzas): read only, the same for ADMIN and OPERATIVO. Everything comes from `GET /periodos`
 * (each quincena already carries its result and its accounts) and from the expenses by category. The two views are never
 * mixed: RESULT (what the quincena earned) and CASH (what came in and went out); what is owed / still to collect is apart.
 */
@Component({
  selector: 'app-resultado-quincena-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HasRoleDirective, IconComponent, MontoComponent, PageHeaderComponent, ResultadoAnioChartComponent, RouterLink, StatusChipComponent],
  template: `
    <app-page-header title="Resultado por quincena" description="Lo que ganó cada quincena y la plata que realmente entró y salió. Solo consulta.">
      <div class="flex flex-col items-start gap-1 sm:items-end">
        <button type="button" class="sila-btn sila-btn-outline" data-testid="actualizar" [disabled]="cargando()" (click)="recargar()">
          <app-icon name="lucideRefreshCw" class="size-4" [class.animate-spin]="cargando()" aria-hidden="true" />
          Actualizar
        </button>
        @if (ultima(); as hora) {
          <span class="text-xs text-muted-foreground" data-testid="hora-actualizacion" aria-live="polite">Actualizado a las {{ hora }}</span>
        }
      </div>
    </app-page-header>

    @if (anios.error() || (periodos.error() && !lista())) {
      <div role="alert" class="sila-card p-6 text-center" data-testid="error-resultado">
        <p class="mb-1 font-medium">No se pudieron cargar las quincenas.</p>
        <p class="mb-3 text-sm text-muted-foreground">{{ mensajeError() }}</p>
        <button type="button" class="sila-btn sila-btn-outline" (click)="recargar()">Reintentar</button>
      </div>
    } @else if (!iniciado()) {
      <p class="text-sm text-muted-foreground" aria-busy="true" data-testid="cargando-resultado">Cargando…</p>
    } @else if (anio() === null) {
      <div class="sila-card p-8 text-center text-sm" data-testid="sin-quincenas">
        <p class="mb-1 font-medium">Todavía no hay quincenas creadas.</p>
        <a *hasRole="'ADMIN'" routerLink="/periodos" class="text-primary hover:underline">Crear los períodos del año</a>
      </div>
    } @else {
      <!-- Year and quincena -->
      <div class="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label for="rq-anio" class="mb-1 block text-xs font-medium text-muted-foreground">Año</label>
          <select id="rq-anio" class="sila-select w-28" data-testid="selector-anio" (change)="elegirAnio($any($event.target).value)">
            @for (a of anios.value(); track a) {
              <option [value]="a" [selected]="a === anio()">{{ a }}</option>
            }
          </select>
        </div>
        <div class="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <button type="button" class="sila-btn sila-btn-outline sila-btn-sm shrink-0" data-testid="anterior" [disabled]="!anterior()" (click)="ir(anterior())">
            <app-icon name="lucideChevronLeft" class="size-4" aria-hidden="true" />
            <span class="sr-only sm:not-sr-only">Anterior</span><span class="sr-only sm:hidden">quincena anterior</span>
          </button>
          <p class="min-w-0 flex-1 text-center text-sm font-semibold sm:w-56 sm:flex-none" data-testid="quincena-seleccionada" aria-live="polite">
            @if (seleccionada(); as s) {
              {{ etiqueta(s.mes, s.quincena) }}
            }
          </p>
          <button type="button" class="sila-btn sila-btn-outline sila-btn-sm shrink-0" data-testid="siguiente" [disabled]="!siguiente()" (click)="ir(siguiente())">
            <span class="sr-only sm:not-sr-only">Siguiente</span><span class="sr-only sm:hidden">quincena siguiente</span>
            <app-icon name="lucideChevronRight" class="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      @if (!lista()) {
        <p class="text-sm text-muted-foreground" aria-busy="true">Cargando…</p>
      } @else if (seleccionada(); as p) {
        <div class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <app-status-chip [texto]="p.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'" [tono]="p.estado === 'ABIERTA' ? 'exito' : 'neutro'" />
          <span class="text-sm text-muted-foreground">{{ fecha(p.fecha_inicio) }} – {{ fecha(p.fecha_fin) }}</span>
          <a *hasRole="'ADMIN'" [routerLink]="['/periodos', p.id_periodo]" class="inline-flex min-h-8 items-center text-xs font-medium text-primary hover:underline max-lg:min-h-11">Ver cuentas de la quincena</a>
        </div>
        @if (p.estado === 'ABIERTA') {
          <p class="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm" role="status" data-testid="aviso-en-curso">Quincena en curso: las cifras pueden cambiar.</p>
        }

        <!-- Two views, never mixed -->
        <div class="mb-6 grid gap-6 lg:grid-cols-2">
          <article class="sila-card border-l-4 border-l-primary p-5" aria-labelledby="rq-res" data-testid="bloque-resultado">
            <h2 id="rq-res" class="text-base font-semibold">Resultado</h2>
            <p class="text-sm text-muted-foreground">Lo que la quincena ganó, se haya cobrado o no.</p>
            <p class="my-2 text-3xl font-bold" data-testid="valor-resultado"><app-monto [valor]="p.resultado_estimado" [destacado]="true" /></p>
            @if (p.resultado_estimado < 0) {
              <p class="mb-2 flex items-center gap-1.5 text-sm font-medium text-destructive" data-testid="negativo-resultado">
                <app-icon name="lucideTrendingDown" class="size-4" aria-hidden="true" />La quincena perdió plata.
              </p>
            }
            <ul class="divide-y divide-border text-sm" data-testid="lineas-resultado">
              @for (l of resultado().lineas; track l.clave) {
                <li class="flex items-center justify-between gap-3 py-1.5">
                  <span>{{ l.signo }} {{ l.etiqueta }}</span>
                  <span class="tabular-nums">{{ cop(l.valor) }}</span>
                </li>
              }
              <li class="flex items-center justify-between gap-3 py-2 font-semibold">
                <span>= Resultado</span>
                <app-monto [valor]="resultado().total" [destacado]="true" />
              </li>
            </ul>
            <p class="mt-3 text-xs text-muted-foreground">Estimación de gestión, no un estado contable.</p>
          </article>

          <article class="sila-card border-l-4 border-l-chart-2 p-5" aria-labelledby="rq-caja" data-testid="bloque-caja">
            <h2 id="rq-caja" class="text-base font-semibold">Caja</h2>
            <p class="text-sm text-muted-foreground">La plata que realmente entró y salió.</p>
            <p class="my-2 text-3xl font-bold" data-testid="valor-caja"><app-monto [valor]="p.caja_neta" [destacado]="true" /></p>
            @if (p.caja_neta < 0) {
              <p class="mb-2 flex items-center gap-1.5 text-sm font-medium text-destructive" data-testid="negativo-caja">
                <app-icon name="lucideTrendingDown" class="size-4" aria-hidden="true" />Salió más plata de la que entró.
              </p>
            }
            <ul class="divide-y divide-border text-sm" data-testid="lineas-caja">
              @for (l of caja().lineas; track l.clave) {
                <li class="flex items-center justify-between gap-3 py-1.5" [class.ps-5]="l.detalle" [class.text-muted-foreground]="l.detalle">
                  <span>{{ l.detalle ? '' : l.signo + ' ' }}{{ l.etiqueta }}</span>
                  <span class="tabular-nums">{{ cop(l.valor) }}</span>
                </li>
              }
              <li class="flex items-center justify-between gap-3 py-2 font-semibold">
                <span>= Caja neta</span>
                <app-monto [valor]="caja().total" [destacado]="true" />
              </li>
            </ul>
          </article>
        </div>

        <!-- Apart: what is owed and what is still to be collected -->
        <section class="sila-card mb-6 p-5" aria-labelledby="rq-debe" data-testid="bloque-deudas">
          <h2 id="rq-debe" class="mb-1 text-base font-semibold">Para saber cuánto se debe y cuánto falta cobrar</h2>
          <p class="mb-3 text-xs text-muted-foreground">Aparte: no suma a ninguno de los dos resultados. La leche comprada NO resta en el resultado: su costo entra por el costo de producción cuando se produce.</p>
          <dl class="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div class="flex justify-between gap-3"><dt class="text-muted-foreground">Leche comprada</dt><dd class="tabular-nums" data-testid="leche-comprada">{{ cop(p.leche_comprada) }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-muted-foreground">Leche pagada</dt><dd class="tabular-nums">{{ cop(p.leche_pagada) }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="font-medium">Leche por pagar</dt><dd class="font-semibold tabular-nums" data-testid="leche-por-pagar">{{ cop(p.leche_por_pagar) }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-muted-foreground">Litros recibidos (aprobados)</dt><dd class="tabular-nums">{{ numero(p.leche_litros) }} L</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-muted-foreground">Litros rechazados</dt><dd class="tabular-nums">{{ numero(p.leche_litros_rechazados) }} L</dd></div>
            <div class="flex justify-between gap-3"><dt class="font-medium">Cartera pendiente</dt><dd class="font-semibold tabular-nums" data-testid="cartera-pendiente">{{ cop(p.cartera_pendiente) }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-muted-foreground">Total vendido (con IVA)</dt><dd class="tabular-nums">{{ cop(p.total_vendido) }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-muted-foreground">IVA de las ventas</dt><dd class="tabular-nums">{{ cop(p.iva_ventas) }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-muted-foreground">Ventas de contado</dt><dd class="tabular-nums">{{ cop(p.ventas_contado) }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-muted-foreground">Ventas a crédito</dt><dd class="tabular-nums">{{ cop(p.ventas_credito) }}</dd></div>
          </dl>
        </section>

        <!-- Expenses by category -->
        <section class="sila-card mb-6 p-5" aria-labelledby="rq-gastos" data-testid="bloque-gastos">
          <h2 id="rq-gastos" class="mb-3 text-base font-semibold">Gastos por categoría · {{ etiqueta(p.mes, p.quincena) }}</h2>
          @if (gastos.error()) {
            <p role="alert" class="text-sm">No se pudieron cargar los gastos. <button type="button" class="underline" (click)="gastos.reload()">Reintentar</button></p>
          } @else if (gastos.hasValue()) {
            @if (gastos.value().length === 0) {
              <p class="text-sm text-muted-foreground" data-testid="sin-gastos">No hay gastos vigentes en esta quincena.</p>
            } @else {
              <ul class="divide-y divide-border text-sm" data-testid="lista-gastos">
                @for (g of gastos.value(); track g.categoria) {
                  <li class="flex items-center justify-between gap-3 py-1.5"><span>{{ g.categoria }}</span><span class="tabular-nums">{{ cop(g.total_gastos) }}</span></li>
                }
                <li class="flex items-center justify-between gap-3 py-2 font-semibold"><span>Total</span><span class="tabular-nums" data-testid="total-gastos">{{ cop(totalGastos()) }}</span></li>
              </ul>
              @if (!gastosCoinciden()) {
                <p class="mt-2 text-xs text-destructive" role="status" data-testid="gastos-no-coinciden">
                  Ojo: este total ({{ cop(totalGastos()) }}) no coincide con los gastos de la quincena ({{ cop(p.gastos_operativos) }}). Pulsa «Actualizar».
                </p>
              }
            }
          } @else {
            <p class="text-sm text-muted-foreground" aria-busy="true">Cargando…</p>
          }
        </section>
      }

      <!-- Evolution of the year -->
      <section class="mb-6" aria-labelledby="rq-anio-titulo">
        <h2 id="rq-anio-titulo" class="mb-1 text-base font-semibold">Evolución del año {{ anio() }}</h2>
        <p class="mb-3 text-xs text-muted-foreground">Toca una barra o una fila para ver esa quincena. Las quincenas que aún no empiezan salen atenuadas.</p>
        @if (lista(); as periodosAnio) {
          <div class="sila-card mb-6 p-3 sm:p-4">
            <app-resultado-anio-chart [periodos]="periodosAnio" [seleccionadaId]="seleccionada()?.id_periodo ?? null" [hoy]="hoy()" (seleccionar)="elegir($event)" />
            @if (movil()) {
              <p class="mt-2 text-center text-xs text-muted-foreground">Desliza la gráfica hacia los lados para verla completa.</p>
            }
          </div>

          <h3 class="mb-2 text-sm font-semibold">Tabla del año</h3>
          @if (movil()) {
            <ul class="space-y-2" aria-label="Quincenas del año" data-testid="tabla-anio">
              @for (p of periodosAnio; track p.id_periodo) {
                <li>
                  <button type="button" class="sila-card w-full p-3 text-start" [class.border-primary]="p.id_periodo === seleccionada()?.id_periodo" [class.bg-primary/10]="p.id_periodo === seleccionada()?.id_periodo" [class.opacity-60]="atenuada(p)" [attr.aria-current]="p.id_periodo === seleccionada()?.id_periodo ? 'true' : null" data-testid="fila-anio" (click)="elegir(p.id_periodo)">
                    <span class="flex items-center justify-between gap-2">
                      <span class="font-medium">{{ corta(p.mes, p.quincena) }}<span class="sr-only"> (quincena)</span></span>
                      <app-status-chip [texto]="p.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'" [tono]="p.estado === 'ABIERTA' ? 'exito' : 'neutro'" />
                    </span>
                    <span class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <span class="text-muted-foreground">Ingresos</span><span class="text-end tabular-nums">{{ cop(p.ingresos_ventas) }}</span>
                      <span class="text-muted-foreground">Resultado</span><app-monto class="text-end" [valor]="p.resultado_estimado" />
                      <span class="text-muted-foreground">Caja neta</span><app-monto class="text-end" [valor]="p.caja_neta" />
                      <span class="text-muted-foreground">Leche por pagar</span><span class="text-end tabular-nums">{{ cop(p.leche_por_pagar) }}</span>
                      <span class="text-muted-foreground">Cartera pendiente</span><span class="text-end tabular-nums">{{ cop(p.cartera_pendiente) }}</span>
                    </span>
                  </button>
                </li>
              }
              <li class="sila-card bg-muted/40 p-3 text-xs" data-testid="totales-anio">
                <p class="mb-1 text-sm font-semibold">Total del año ({{ totales().quincenas }} quincenas ya empezadas)</p>
                <span class="grid grid-cols-2 gap-x-3 gap-y-1">
                  <span class="text-muted-foreground">Ingresos</span><span class="text-end tabular-nums">{{ cop(totales().ingresos_ventas) }}</span>
                  <span class="text-muted-foreground">Resultado</span><app-monto class="text-end" [valor]="totales().resultado_estimado" />
                  <span class="text-muted-foreground">Caja neta</span><app-monto class="text-end" [valor]="totales().caja_neta" />
                  <span class="text-muted-foreground">Leche por pagar</span><span class="text-end tabular-nums">{{ cop(totales().leche_por_pagar) }}</span>
                  <span class="text-muted-foreground">Cartera pendiente</span><span class="text-end tabular-nums">{{ cop(totales().cartera_pendiente) }}</span>
                </span>
              </li>
            </ul>
          } @else {
            <div class="sila-card overflow-x-auto">
              <table class="w-full min-w-[720px] text-left text-sm" data-testid="tabla-anio">
                <caption class="sr-only">Quincenas del año {{ anio() }}: ingresos, resultado, caja neta, leche por pagar y cartera pendiente</caption>
                <thead class="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-3 py-2 font-medium">Quincena</th>
                    <th scope="col" class="px-3 py-2 font-medium">Estado</th>
                    <th scope="col" class="px-3 py-2 text-end font-medium">Ingresos</th>
                    <th scope="col" class="px-3 py-2 text-end font-medium">Resultado</th>
                    <th scope="col" class="px-3 py-2 text-end font-medium">Caja neta</th>
                    <th scope="col" class="px-3 py-2 text-end font-medium">Leche por pagar</th>
                    <th scope="col" class="px-3 py-2 text-end font-medium">Cartera pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of periodosAnio; track p.id_periodo) {
                    <tr class="border-b border-border last:border-0" [class.bg-primary/10]="p.id_periodo === seleccionada()?.id_periodo" [class.text-muted-foreground]="atenuada(p)" [attr.aria-current]="p.id_periodo === seleccionada()?.id_periodo ? 'true' : null" data-testid="fila-anio">
                      <th scope="row" class="px-3 py-1.5 font-medium">
                        <button type="button" class="min-h-8 underline-offset-2 hover:underline" data-testid="elegir-fila" (click)="elegir(p.id_periodo)">{{ corta(p.mes, p.quincena) }}<span class="sr-only"> (ver esta quincena)</span></button>
                      </th>
                      <td class="px-3 py-1.5"><app-status-chip [texto]="p.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'" [tono]="p.estado === 'ABIERTA' ? 'exito' : 'neutro'" /></td>
                      <td class="px-3 py-1.5 text-end tabular-nums">{{ cop(p.ingresos_ventas) }}</td>
                      <td class="px-3 py-1.5 text-end"><app-monto [valor]="p.resultado_estimado" /></td>
                      <td class="px-3 py-1.5 text-end"><app-monto [valor]="p.caja_neta" /></td>
                      <td class="px-3 py-1.5 text-end tabular-nums">{{ cop(p.leche_por_pagar) }}</td>
                      <td class="px-3 py-1.5 text-end tabular-nums">{{ cop(p.cartera_pendiente) }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot class="border-t-2 border-border bg-muted/40 font-semibold" data-testid="totales-anio">
                  <tr>
                    <th scope="row" colspan="2" class="px-3 py-2">Total del año <span class="font-normal text-muted-foreground">({{ totales().quincenas }} quincenas ya empezadas)</span></th>
                    <td class="px-3 py-2 text-end tabular-nums">{{ cop(totales().ingresos_ventas) }}</td>
                    <td class="px-3 py-2 text-end"><app-monto [valor]="totales().resultado_estimado" [destacado]="true" /></td>
                    <td class="px-3 py-2 text-end"><app-monto [valor]="totales().caja_neta" [destacado]="true" /></td>
                    <td class="px-3 py-2 text-end tabular-nums">{{ cop(totales().leche_por_pagar) }}</td>
                    <td class="px-3 py-2 text-end tabular-nums">{{ cop(totales().cartera_pendiente) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }
        }
      </section>
    }
  `,
})
export class ResultadoQuincenaPageComponent {
  private readonly repo = inject(PERIODOS_REPOSITORY);
  private readonly gastosRepo = inject(GASTOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  protected readonly movil = inject(EsMovilService).movil;

  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;
  protected readonly fecha = formatoFecha;
  protected readonly etiqueta = etiquetaQuincena;
  protected readonly corta = etiquetaCorta;

  /** Today in Colombia: decides which quincenas already started. Renewed on every refresh. */
  protected readonly hoy = signal(hoyColombia());
  private readonly cargadoEn = signal<Date | null>(null);
  protected readonly ultima = computed(() => {
    const f = this.cargadoEn();
    return f ? horaCo(f) : null;
  });

  protected readonly anios = rxResource({ stream: () => this.repo.anios() });
  /** `GET /periodos/actual` fails with 404 / 20007 when today has no quincena: that is normal here (it is not shown). */
  private readonly actual = rxResource({ stream: () => this.repo.actual() });
  protected readonly iniciado = computed(() => !pendiente(this.anios.status()) && !pendiente(this.actual.status()));
  private readonly periodoActual = computed(() => (this.actual.hasValue() ? this.actual.value() : null));

  private readonly anioElegido = signal<number | null>(null);
  protected readonly anio = computed(() => {
    if (!this.iniciado()) return null;
    const elegido = this.anioElegido();
    const anios = this.anios.hasValue() ? this.anios.value() : [];
    return elegido !== null && anios.includes(elegido) ? elegido : anioPorDefecto(anios, this.periodoActual());
  });

  protected readonly periodos = rxResource({
    params: () => this.anio() ?? undefined,
    stream: ({ params }) => this.repo.listar({ anio: params, page: 0, size: 50 }).pipe(tap(() => this.cargadoEn.set(new Date()))),
  });
  protected readonly lista = computed<readonly Periodo[] | null>(() => (this.periodos.hasValue() ? this.periodos.value().items : null));

  /** The one the person picked; it resets when the year changes. */
  private readonly elegida = linkedSignal<number | null, number | null>({ source: () => this.anio(), computation: () => null });
  protected readonly seleccionada = computed<Periodo | null>(() => {
    const lista = this.lista();
    if (!lista) return null;
    return lista.find((p) => p.id_periodo === this.elegida()) ?? quincenaPorDefecto(lista, this.periodoActual(), this.hoy());
  });
  protected readonly anterior = computed(() => vecina(this.lista() ?? [], this.seleccionada()?.id_periodo ?? null, -1));
  protected readonly siguiente = computed(() => vecina(this.lista() ?? [], this.seleccionada()?.id_periodo ?? null, 1));

  protected readonly resultado = computed(() => cascadaResultado(this.seleccionada()!));
  protected readonly caja = computed(() => cascadaCaja(this.seleccionada()!));
  protected readonly totales = computed(() => totalesAnio(this.lista() ?? [], this.hoy()));

  protected readonly gastos = rxResource({
    params: () => this.seleccionada()?.id_periodo,
    stream: ({ params }) => this.gastosRepo.porCategoria(params),
  });
  protected readonly totalGastos = computed(() => Math.round((this.gastos.hasValue() ? this.gastos.value() : []).reduce((s, g) => s + g.total_gastos, 0) * 100) / 100);
  /** The categories add up to the expenses of the quincena (a difference under 50 cents is rounding). */
  protected readonly gastosCoinciden = computed(() => Math.abs(this.totalGastos() - (this.seleccionada()?.gastos_operativos ?? 0)) < 0.5);

  protected readonly cargando = computed(() => this.anios.isLoading() || this.periodos.isLoading() || this.gastos.isLoading());
  protected readonly mensajeError = computed(() => {
    const e = this.anios.error() ?? this.periodos.error();
    return e ? this.errores.describe(e).mensaje : '';
  });

  protected atenuada(p: Periodo): boolean {
    return esAtenuada(p, this.hoy());
  }

  protected elegirAnio(valor: string): void {
    this.anioElegido.set(Number(valor));
  }

  protected elegir(id: number): void {
    this.elegida.set(id);
  }

  protected ir(p: Periodo | null): void {
    if (p) this.elegida.set(p.id_periodo);
  }

  /** No polling: only this button (and entering the screen) asks again. */
  protected recargar(): void {
    this.hoy.set(hoyColombia());
    this.anios.reload();
    this.actual.reload();
    this.periodos.reload();
    this.gastos.reload();
  }
}
