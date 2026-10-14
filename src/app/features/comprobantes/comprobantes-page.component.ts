import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { FiltrosPlegablesComponent } from '../../shared/ui/filtros-plegables/filtros-plegables.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { formatoCop, formatoFecha, formatoNumero } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { textoConEspera } from '../../shared/utils/texto-debounce';
import { FiltroFechasComponent } from '../auditoria/filtro-fechas.component';
import { cargarQuincenas } from '../periodos/quincenas';
import { ComprobanteDetalleDialogComponent } from './comprobante-detalle-dialog.component';
import {
  ESTADOS_COMPROBANTE,
  SENTIDOS_COMPROBANTE,
  TIPOS_COMPROBANTE,
  chipEstadoComprobante,
  claveDocumento,
  etiquetaMetodoComprobante,
  etiquetaTipoComprobante,
  leerDocumento,
  montoConSigno,
  numeroLegible,
} from './comprobantes.format';
import { COMPROBANTES_REPOSITORY } from './data/comprobantes.provider';
import type { Comprobante, ComprobantesQuery, EstadoComprobante, SentidoComprobante, TipoComprobante } from './models/comprobantes.models';

/** Valid value of a URL parameter, or `undefined` (a hand-edited URL never reaches the API with a bad value). */
function opcion<T extends string>(valor: string | null, validos: readonly { valor: T }[]): T | undefined {
  return validos.find((v) => v.valor === valor)?.valor;
}

/**
 * Comprobantes: every money movement in one read-only list (internal document, NOT an electronic invoice).
 * The filters and the open detail live in the URL (`?tipo=&sentido=&estado=&periodo=&desde=&hasta=&q=&ver=VENTA-123`),
 * so a link from another screen (or a reload) lands on the same view.
 */
@Component({
  selector: 'app-comprobantes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ComprobanteDetalleDialogComponent, DataTableCellDirective, FiltroFechasComponent, FiltrosPlegablesComponent, PageHeaderComponent, ServerDataTableComponent, StatusChipComponent],
  template: `
    <app-page-header title="Comprobantes" description="Todos los movimientos de plata: ventas, abonos, pagos a lecheros, compras de insumos y gastos. Son documentos internos, no facturas electrónicas." />

    <section class="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="Resumen" data-testid="resumen-comprobantes" aria-live="polite">
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Ingresos</p>
        <p class="mt-1 text-xl font-bold tabular-nums sm:text-2xl text-success" data-testid="resumen-ingresos">{{ resumen.hasValue() ? cop(resumen.value().ingresos) : '—' }}</p>
      </div>
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Egresos</p>
        <p class="mt-1 text-xl font-bold tabular-nums sm:text-2xl text-destructive" data-testid="resumen-egresos">{{ resumen.hasValue() ? cop(resumen.value().egresos) : '—' }}</p>
      </div>
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Neto</p>
        <p class="mt-1 text-xl font-bold tabular-nums sm:text-2xl" data-testid="resumen-neto">{{ resumen.hasValue() ? cop(resumen.value().neto) : '—' }}</p>
      </div>
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Comprobantes</p>
        <p class="mt-1 text-xl font-bold tabular-nums sm:text-2xl" data-testid="resumen-cantidad">{{ resumen.hasValue() ? numero(resumen.value().cantidad) : '—' }}</p>
      </div>
      <p class="col-span-2 text-xs text-muted-foreground xl:col-span-4">
        Con los filtros de abajo. Solo suman los comprobantes vigentes (los anulados no cuentan, aunque filtres por «Anulados»), y la venta a crédito no entra a caja hasta que se abona.
      </p>
    </section>
    @if (resumen.error()) {
      <p class="-mt-3 mb-4 text-sm text-destructive" role="alert">No se pudo calcular el resumen. <button type="button" class="underline" (click)="resumen.reload()">Reintentar</button></p>
    }

    <app-filtros-plegables clases="mb-4 flex flex-wrap items-end gap-3">
      <div>
        <label for="comp-tipo" class="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
        <select id="comp-tipo" class="sila-select w-48" (change)="fijar({ tipo: $any($event.target).value || null })">
          <option value="" [selected]="!tipo()">Todos</option>
          @for (t of tipos; track t.valor) {
            <option [value]="t.valor" [selected]="t.valor === tipo()">{{ t.etiqueta }}</option>
          }
        </select>
      </div>
      <div>
        <label for="comp-sentido" class="mb-1 block text-xs font-medium text-muted-foreground">Sentido</label>
        <select id="comp-sentido" class="sila-select w-36" (change)="fijar({ sentido: $any($event.target).value || null })">
          <option value="" [selected]="!sentido()">Todos</option>
          @for (s of sentidos; track s.valor) {
            <option [value]="s.valor" [selected]="s.valor === sentido()">{{ s.etiqueta }}</option>
          }
        </select>
      </div>
      <div>
        <label for="comp-estado" class="mb-1 block text-xs font-medium text-muted-foreground">Estado</label>
        <select id="comp-estado" class="sila-select w-36" (change)="fijar({ estado: $any($event.target).value || null })">
          <option value="" [selected]="!estado()">Todos</option>
          @for (e of estados; track e.valor) {
            <option [value]="e.valor" [selected]="e.valor === estado()">{{ e.etiqueta }}</option>
          }
        </select>
      </div>
      <div>
        <label for="comp-quincena" class="mb-1 block text-xs font-medium text-muted-foreground">Quincena</label>
        <select id="comp-quincena" class="sila-select w-64" (change)="fijar({ periodo: $any($event.target).value || null })">
          <option value="" [selected]="periodo() === undefined">Todas las quincenas</option>
          @for (q of quincenas.opciones(); track q.id_periodo) {
            <option [value]="q.id_periodo" [selected]="q.id_periodo === periodo()">{{ q.etiqueta }}</option>
          }
        </select>
      </div>
      <div class="w-full sm:w-64">
        <label for="comp-texto" class="mb-1 block text-xs font-medium text-muted-foreground">Buscar</label>
        <input id="comp-texto" type="search" class="sila-input" placeholder="Número, tercero, descripción…" maxlength="100" [value]="texto.crudo()" (input)="texto.crudo.set($any($event.target).value)" />
      </div>
      <app-filtro-fechas idBase="comp" [desde]="desde()" [hasta]="hasta()" (desdeChange)="fijar({ desde: $event || null })" (hastaChange)="fijar({ hasta: $event || null })" />
    </app-filtros-plegables>

    <app-server-data-table
      titulo="Comprobantes"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="comprobanteId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="listado.sort()"
      vacioTitulo="No hay comprobantes que coincidan"
      vacioAyuda="Cambia los filtros."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (sortChange)="listado.sort.set($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="numero" [cellRows]="listado.datos()?.items" let-c>
        <button type="button" class="font-mono text-xs font-semibold underline-offset-2 hover:underline" [class.line-through]="c.estado === 'ANULADO'" data-testid="abrir-comprobante" (click)="abrir(c)">
          {{ numeroLegible(c.numero) }}<span class="sr-only"> (ver detalle)</span>
        </button>
      </ng-template>
      <ng-template appDataTableCell="fecha" [cellRows]="listado.datos()?.items" let-c><span class="whitespace-nowrap" [class.line-through]="c.estado === 'ANULADO'">{{ fecha(c.fecha) }}</span></ng-template>
      <ng-template appDataTableCell="tercero" [cellRows]="listado.datos()?.items" let-c><span [class.line-through]="c.estado === 'ANULADO'">{{ c.tercero || '—' }}</span></ng-template>
      <ng-template appDataTableCell="descripcion" [cellRows]="listado.datos()?.items" let-c><span class="block max-w-72 truncate" [attr.title]="c.descripcion" [class.line-through]="c.estado === 'ANULADO'">{{ c.descripcion || '—' }}</span></ng-template>
      <ng-template appDataTableCell="metodo_pago" [cellRows]="listado.datos()?.items" let-c>{{ metodo(c.metodo_pago) }}</ng-template>
      <ng-template appDataTableCell="monto" [cellRows]="listado.datos()?.items" let-c>
        @let m = signo(c);
        <span class="whitespace-nowrap font-medium tabular-nums" [class]="m.clase" [class.line-through]="c.estado === 'ANULADO'" data-testid="monto-comprobante">{{ m.texto }}</span>
        @if (!c.afecta_caja) {
          <span class="block text-xs text-muted-foreground">A crédito</span>
        }
      </ng-template>
      <ng-template appDataTableCell="estado" [cellRows]="listado.datos()?.items" let-c>
        @let chip = chipEstado(c.estado);
        <span [attr.title]="c.estado === 'ANULADO' ? 'Motivo: ' + c.motivo_anulacion : null">
          <app-status-chip [texto]="chip.texto" [tono]="chip.tono" />
          @if (c.estado === 'ANULADO' && c.motivo_anulacion) {
            <span class="sr-only">Motivo: {{ c.motivo_anulacion }}</span>
          }
        </span>
      </ng-template>
      <ng-template appDataTableCell="acciones" [cellRows]="listado.datos()?.items" let-c>
        <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="abrir(c)">Ver<span class="sr-only"> el comprobante {{ numeroLegible(c.numero) }}</span></button>
      </ng-template>
    </app-server-data-table>

    <app-comprobante-detalle-dialog [documento]="documento()" (cerrar)="fijar({ ver: null }, false)" />
  `,
})
export class ComprobantesPageComponent {
  private readonly repo = inject(COMPROBANTES_REPOSITORY);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly tipos = TIPOS_COMPROBANTE;
  protected readonly sentidos = SENTIDOS_COMPROBANTE;
  protected readonly estados = ESTADOS_COMPROBANTE;
  protected readonly quincenas = cargarQuincenas();
  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;
  protected readonly fecha = formatoFecha;
  protected readonly metodo = etiquetaMetodoComprobante;
  protected readonly signo = montoConSigno;
  protected readonly numeroLegible = numeroLegible;
  protected readonly chipEstado = chipEstadoComprobante;

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly tipo = computed<TipoComprobante | undefined>(() => opcion(this.params().get('tipo'), TIPOS_COMPROBANTE));
  protected readonly sentido = computed<SentidoComprobante | undefined>(() => opcion(this.params().get('sentido'), SENTIDOS_COMPROBANTE));
  protected readonly estado = computed<EstadoComprobante | undefined>(() => opcion(this.params().get('estado'), ESTADOS_COMPROBANTE));
  protected readonly periodo = computed(() => {
    const n = Number(this.params().get('periodo'));
    return Number.isInteger(n) && n > 0 ? n : undefined;
  });
  protected readonly desde = computed(() => this.params().get('desde') ?? '');
  protected readonly hasta = computed(() => this.params().get('hasta') ?? '');
  protected readonly documento = computed(() => leerDocumento(this.params().get('ver')));

  protected readonly texto = textoConEspera(this.route.snapshot.queryParamMap.get('q') ?? '');

  constructor() {
    // The (debounced) search box is written to the URL; every other filter is written by `fijar` directly.
    effect(() => {
      const q = this.texto.valor();
      if ((this.route.snapshot.queryParamMap.get('q') ?? '') !== q) this.fijar({ q: q || null });
    });
  }

  /** The SAME filters feed the list and the summary (which ignores `estado`). */
  private readonly filtros = computed<ComprobantesQuery>(() => ({
    tipo: this.tipo(),
    sentido: this.sentido(),
    estado: this.estado(),
    id_periodo: this.periodo(),
    texto: (this.params().get('q') ?? '').trim() || undefined,
    desde: this.desde() || undefined,
    hasta: this.hasta() || undefined,
  }));

  protected readonly resumen = rxResource({
    params: () => {
      const { estado: _estado, ...resto } = this.filtros();
      return resto;
    },
    stream: ({ params }) => this.repo.resumen(params),
  });

  protected readonly listado = crearListado({
    filtros: () => this.filtros(),
    cargar: (query) => this.repo.listar(query),
    sort: 'fecha,desc',
  });

  // Sort fields of the contract: fecha, monto, tipo, numero, tercero, estado, sentido.
  protected readonly columnas: DataTableColumn<Comprobante>[] = [
    { key: 'numero', label: 'Comprobante', rol: 'titulo', value: (c) => c.numero },
    { key: 'fecha', label: 'Fecha', value: (c) => c.fecha },
    { key: 'tercero', label: 'Tercero', value: (c) => c.tercero ?? '' },
    { key: 'descripcion', label: 'Descripción', sortable: false, ocultarEnMovil: true, value: (c) => c.descripcion ?? '' },
    { key: 'metodo_pago', label: 'Método de pago', sortable: false, ocultarEnMovil: true, value: (c) => etiquetaMetodoComprobante(c.metodo_pago) },
    { key: 'monto', label: 'Monto', align: 'end', value: (c) => c.monto },
    { key: 'estado', label: 'Estado', value: (c) => c.estado },
    { key: 'acciones', label: 'Acciones', sortable: false, rol: 'acciones', value: () => '' },
  ];
  protected readonly comprobanteId = (c: Comprobante) => `${c.tipo}-${c.id_documento}`;
  protected readonly etiquetaTipo = etiquetaTipoComprobante;

  /** `null` removes a parameter. Filters replace the history entry; opening a detail adds one (Back closes it). */
  protected fijar(cambios: Record<string, string | null>, reemplazar = true): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: cambios, queryParamsHandling: 'merge', replaceUrl: reemplazar });
  }

  protected abrir(c: Comprobante): void {
    this.fijar({ ver: claveDocumento(c.tipo, c.id_documento) }, false);
  }
}
