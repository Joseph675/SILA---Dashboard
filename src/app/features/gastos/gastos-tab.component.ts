import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiErrorService } from '../../core/api/api-error';
import { ClaveIdempotente } from '../../core/api/idempotencia';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { FiltrosPlegablesComponent } from '../../shared/ui/filtros-plegables/filtros-plegables.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { formatoCop, formatoFecha, formatoFechaHora, formatoNumero } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { textoConEspera } from '../../shared/utils/texto-debounce';
import { FiltroFechasComponent } from '../auditoria/filtro-fechas.component';
import { cargarQuincenas } from '../periodos/quincenas';
import { etiquetaQuincena } from '../periodos/periodos.format';
import { GASTOS_REPOSITORY } from './data/gastos.provider';
import { GastoDialogComponent } from './gasto-dialog.component';
import type { EstadoGasto, Gasto } from './models/gastos.models';

@Component({
  selector: 'app-gastos-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, DataTableCellDirective, FiltroFechasComponent, FiltrosPlegablesComponent, GastoDialogComponent, HasRoleDirective, IconComponent, ServerDataTableComponent, StatusChipComponent],
  template: `
    <div class="sila-card mb-6 flex flex-wrap items-center justify-between gap-4 p-4" data-testid="resumen-gastos" aria-live="polite">
      <div>
        <p class="text-sm text-muted-foreground">Total de gastos (con los filtros de abajo)</p>
        <p class="mt-1 text-2xl font-bold tabular-nums" data-testid="total-gastos">{{ resumen.hasValue() ? cop(resumen.value().total) : '—' }}</p>
      </div>
      <div class="text-sm text-muted-foreground">
        <p data-testid="cantidad-gastos">{{ resumen.hasValue() ? numero(resumen.value().cantidad) : '—' }} {{ resumen.hasValue() && resumen.value().cantidad === 1 ? 'gasto vigente' : 'gastos vigentes' }}</p>
        <p class="text-xs">Los anulados no suman.</p>
      </div>
    </div>
    @if (resumen.error()) {
      <p class="-mt-3 mb-4 text-sm text-destructive" role="alert">No se pudo calcular el total. <button type="button" class="underline" (click)="resumen.reload()">Reintentar</button></p>
    }

    <app-filtros-plegables clases="mb-4 flex flex-wrap items-end gap-3">
      <div>
        <label for="gastos-quincena" class="mb-1 block text-xs font-medium text-muted-foreground">Quincena</label>
        <select id="gastos-quincena" class="sila-select w-64" (change)="cambiarPeriodo($any($event.target).value)">
          <option value="" [selected]="periodo() === null">Todas las quincenas</option>
          @for (q of quincenas.opciones(); track q.id_periodo) {
            <option [value]="q.id_periodo" [selected]="q.id_periodo === periodo()">{{ q.etiqueta }}</option>
          }
        </select>
      </div>
      <div>
        <label for="gastos-categoria" class="mb-1 block text-xs font-medium text-muted-foreground">Categoría</label>
        <select id="gastos-categoria" class="sila-select w-48" (change)="categoria.set($any($event.target).value)">
          <option value="" [selected]="categoria() === ''">Todas</option>
          @for (c of todasLasCategorias(); track c.id_categoria) {
            <option [value]="c.id_categoria" [selected]="'' + c.id_categoria === categoria()">{{ c.nombre }}{{ c.activo ? '' : ' (inactiva)' }}</option>
          }
        </select>
      </div>
      <div class="w-full sm:w-56">
        <label for="gastos-texto" class="mb-1 block text-xs font-medium text-muted-foreground">Concepto</label>
        <input id="gastos-texto" type="search" class="sila-input" placeholder="Buscar…" maxlength="100" [value]="texto.crudo()" (input)="texto.crudo.set($any($event.target).value)" />
      </div>
      <div>
        <label for="gastos-estado" class="mb-1 block text-xs font-medium text-muted-foreground">Estado</label>
        <select id="gastos-estado" class="sila-select w-36" (change)="estado.set($any($event.target).value)">
          <option value="" [selected]="estado() === ''">Todos</option>
          <option value="VIGENTE" [selected]="estado() === 'VIGENTE'">Vigentes</option>
          <option value="ANULADO" [selected]="estado() === 'ANULADO'">Anulados</option>
        </select>
      </div>
      <app-filtro-fechas idBase="gastos" [desde]="desde()" [hasta]="hasta()" (desdeChange)="desde.set($event)" (hastaChange)="hasta.set($event)" />
      <button type="button" data-accion class="sila-btn sila-btn-primary ms-auto" (click)="dialogo.set(true)">
        <app-icon name="lucidePlus" class="size-4" aria-hidden="true" />
        Registrar gasto
      </button>
    </app-filtros-plegables>

    <app-server-data-table
      titulo="Gastos"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="gastoId"
      [cargando]="listado.cargando() || !quincenas.iniciado()"
      [error]="listado.error()"
      [sort]="listado.sort()"
      vacioTitulo="No hay gastos que coincidan"
      vacioAyuda="Cambia los filtros o registra un gasto."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (sortChange)="listado.sort.set($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="fecha_gasto" [cellRows]="listado.datos()?.items" let-g><span class="whitespace-nowrap" [class.line-through]="g.estado === 'ANULADO'">{{ fecha(g.fecha_gasto) }}</span></ng-template>
      <ng-template appDataTableCell="concepto" [cellRows]="listado.datos()?.items" let-g><span [class.line-through]="g.estado === 'ANULADO'">{{ g.concepto }}</span></ng-template>
      <ng-template appDataTableCell="monto" [cellRows]="listado.datos()?.items" let-g><span class="font-medium tabular-nums" [class.line-through]="g.estado === 'ANULADO'">{{ cop(g.monto) }}</span></ng-template>
      <ng-template appDataTableCell="quincena" [cellRows]="listado.datos()?.items" let-g><span class="whitespace-nowrap">{{ g.anio }} · {{ etiquetaQuincena(g.mes, g.quincena) }}</span></ng-template>
      <ng-template appDataTableCell="estado" [cellRows]="listado.datos()?.items" let-g>
        @if (g.estado === 'ANULADO') {
          <app-status-chip texto="Anulado" tono="peligro" />
          <span class="mt-1 block max-w-64 text-xs text-muted-foreground" data-testid="detalle-anulacion">
            Motivo: {{ g.motivo_anulacion }} · {{ g.usuario_anulacion }} · {{ fechaHora(g.fecha_anulacion) }}
          </span>
        } @else {
          <app-status-chip texto="Vigente" tono="exito" />
        }
      </ng-template>
      <ng-template appDataTableCell="acciones" [cellRows]="listado.datos()?.items" let-g>
        @if (g.estado === 'VIGENTE') {
          <button *hasRole="'ADMIN'" type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="anulando.set(g)">Anular<span class="sr-only"> el gasto «{{ g.concepto }}»</span></button>
        }
      </ng-template>
    </app-server-data-table>

    <app-gasto-dialog [abierto]="dialogo()" [categorias]="categoriasActivas()" (registrado)="alRegistrar($event)" (cerrar)="dialogo.set(false)" />

    <app-confirm-dialog
      [open]="anulando() !== null"
      titulo="Anular gasto"
      [mensaje]="'Se anulará «' + (anulando()?.concepto ?? '') + '» por ' + (anulando() ? cop(anulando()!.monto) : '') + ': deja de sumar en los totales y en el resultado de la quincena. Queda en la lista, tachado, con su motivo. No se puede deshacer.'"
      textoConfirmar="Anular gasto"
      [peligro]="true"
      [motivo]="regla"
      [ocupado]="procesando()"
      (confirmar)="anular($event)"
      (cancelar)="anulando.set(null)"
    />
  `,
})
export class GastosTabComponent {
  private readonly repo = inject(GASTOS_REPOSITORY);
  private readonly toast = inject(ToastService);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly quincenas = cargarQuincenas();
  protected readonly regla = { min: 10, max: 255 };
  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;
  protected readonly fecha = formatoFecha;
  protected readonly fechaHora = formatoFechaHora;
  protected readonly etiquetaQuincena = etiquetaQuincena;

  private readonly catsTodas = rxResource({ stream: () => this.repo.categorias(false) });
  private readonly catsActivas = rxResource({ stream: () => this.repo.categorias(true) });
  protected readonly todasLasCategorias = computed(() => (this.catsTodas.hasValue() ? this.catsTodas.value() : []));
  protected readonly categoriasActivas = computed(() => (this.catsActivas.hasValue() ? this.catsActivas.value() : []));

  /** `undefined` = the person has not chosen yet (the current quincena applies; `null` = all). */
  private readonly elegido = signal<number | null | undefined>(undefined);
  /** SUPUESTO: GD-01. La quincena actual viene preseleccionada; si hoy no tiene quincena, se muestran todas. */
  protected readonly periodo = computed(() => {
    const elegido = this.elegido();
    return elegido !== undefined ? elegido : this.quincenas.actualId();
  });
  protected readonly categoria = signal('');
  protected readonly texto = textoConEspera();
  protected readonly estado = signal<'' | EstadoGasto>('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly dialogo = signal(false);
  protected readonly anulando = signal<Gasto | null>(null);
  protected readonly procesando = signal(false);
  private readonly clave = new ClaveIdempotente();

  /** The SAME filters feed the list and the summary card, so the total always describes what the table shows. */
  private readonly filtros = computed(() => ({
    id_periodo: this.periodo() ?? undefined,
    id_categoria: this.categoria() ? Number(this.categoria()) : undefined,
    texto: this.texto.valor() || undefined,
    estado: this.estado() || undefined,
    desde: this.desde() || undefined,
    hasta: this.hasta() || undefined,
  }));

  protected readonly resumen = rxResource({
    params: () => (this.quincenas.iniciado() ? this.filtros() : undefined),
    stream: ({ params }) => this.repo.resumen(params),
  });

  protected readonly listado = crearListado({
    filtros: () => this.filtros(),
    cargar: (query) => this.repo.listar(query),
    sort: 'fecha_gasto,desc',
    habilitado: () => this.quincenas.iniciado(),
  });

  // Sort fields of the contract: id_gasto, fecha_gasto, categoria, monto, concepto, fecha_registro.
  protected readonly columnas: DataTableColumn<Gasto>[] = [
    { key: 'fecha_gasto', label: 'Fecha', value: (g) => g.fecha_gasto },
    { key: 'categoria', label: 'Categoría', value: (g) => g.categoria },
    { key: 'concepto', label: 'Concepto', rol: 'titulo', value: (g) => g.concepto },
    { key: 'monto', label: 'Monto', align: 'end', value: (g) => g.monto },
    { key: 'quincena', label: 'Quincena', sortable: false, ocultarEnMovil: true, value: (g) => `${g.anio} ${g.mes} ${g.quincena}` },
    { key: 'usuario_registro', label: 'Registró', sortable: false, ocultarEnMovil: true, value: (g) => g.usuario_registro },
    { key: 'estado', label: 'Estado', sortable: false, value: (g) => g.estado },
    { key: 'acciones', label: 'Acciones', sortable: false, value: () => '' },
  ];
  protected readonly gastoId = (g: Gasto) => g.id_gasto;

  protected cambiarPeriodo(valor: string): void {
    this.elegido.set(valor === '' ? null : Number(valor));
  }

  protected alRegistrar(gasto: Gasto): void {
    this.dialogo.set(false);
    this.listado.recargar();
    this.resumen.reload();
    this.toast.exito(`Gasto registrado: ${formatoCop(gasto.monto)} en ${gasto.categoria}.`);
  }

  protected anular(motivo: string): void {
    const gasto = this.anulando();
    if (!gasto || this.procesando()) return;
    this.procesando.set(true);
    this.repo
      .anular(gasto.id_gasto, motivo, this.clave.para({ id: gasto.id_gasto, motivo }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.procesando.set(false);
          this.clave.exito();
          this.anulando.set(null);
          this.listado.recargar();
          this.resumen.reload();
          this.toast.exito('Gasto anulado.');
        },
        error: (fallo: unknown) => {
          this.procesando.set(false);
          this.clave.fallo(fallo);
          this.anulando.set(null);
          // 409 / 20004: its quincena is closed; 409 / 20010: it was already annulled. The server says which.
          this.toast.error(mensajeDeFallo(this.errores, fallo, [20004, 20006, 20007, 20010]));
          this.listado.recargar();
        },
      });
  }
}
