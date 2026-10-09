import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';
import { RouterLink } from '@angular/router';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { MontoComponent } from '../../shared/ui/monto/monto.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoCop, formatoFecha } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { CrearAnioDialogComponent } from './crear-anio-dialog.component';
import { PERIODOS_REPOSITORY } from './data/periodos.provider';
import type { EstadoPeriodo, Periodo } from './models/periodos.models';
import { etiquetaQuincena } from './periodos.format';

type FiltroEstado = 'TODOS' | EstadoPeriodo;

/** Reopening needs a reason of 10 to 200 characters (it goes to the audit log). */
const MOTIVO_REABRIR = { min: 10, max: 200 };

/** A resource that has not answered yet. After the first answer it is never "loading" again (it "reloads"). */
function pendiente(estado: string): boolean {
  return estado === 'loading' || estado === 'idle';
}

@Component({
  selector: 'app-periodos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    CrearAnioDialogComponent,
    DataTableCellDirective,
    HasRoleDirective,
    IconComponent,
    MontoComponent,
    RouterLink,
    PageHeaderComponent,
    ServerDataTableComponent,
    StatusChipComponent,
  ],
  templateUrl: './periodos-page.component.html',
})
export class PeriodosPageComponent {
  private readonly repo = inject(PERIODOS_REPOSITORY);
  private readonly toast = inject(ToastService);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  // ---------- Years and the current quincena ----------

  protected readonly anios = rxResource({ stream: () => this.repo.anios() });
  /** Fails with 20007 when today has no quincena; that is a normal case here, not a page error. */
  private readonly actual = rxResource({ stream: () => this.repo.actual() });

  protected readonly listaAnios = computed(() => (this.anios.hasValue() ? this.anios.value() : []));
  private readonly actualId = computed(() => (this.actual.hasValue() ? this.actual.value().id_periodo : null));
  private readonly anioActual = computed(() => (this.actual.hasValue() ? this.actual.value().anio : null));

  /** Both lookups answered, so the default year is known and the list can load once. */
  private readonly iniciado = computed(() => !pendiente(this.anios.status()) && !pendiente(this.actual.status()));

  protected readonly anioElegido = signal<number | null>(null);
  protected readonly anio = computed(() => {
    const elegido = this.anioElegido();
    if (elegido !== null) return elegido;
    const lista = this.listaAnios();
    if (lista.length === 0) return null;
    // SUPUESTO: año inicial = el de la quincena actual si existe; si no, el último año con quincenas.
    const hoy = this.anioActual();
    return hoy !== null && lista.includes(hoy) ? hoy : lista[lista.length - 1];
  });
  /** Years for the selector; always includes the selected one even while the list reloads. */
  protected readonly opcionesAnio = computed(() => {
    const anio = this.anio();
    const lista = this.listaAnios();
    return anio === null || lista.includes(anio) ? lista : [...lista, anio].sort((a, b) => a - b);
  });
  protected readonly sinAnios = computed(() => this.iniciado() && this.anios.hasValue() && this.listaAnios().length === 0);

  // ---------- List ----------

  protected readonly filtroEstado = signal<FiltroEstado>('TODOS');

  protected readonly listado = crearListado({
    filtros: () => ({
      anio: this.anio() ?? undefined,
      estado: this.filtroEstado() === 'TODOS' ? undefined : (this.filtroEstado() as EstadoPeriodo),
    }),
    cargar: (query) => this.repo.listar(query),
    sort: 'fecha_inicio,asc',
    // A year has 24 rows: one page is enough.
    tamanoInicial: 50,
    habilitado: () => this.iniciado() && this.anio() !== null,
  });

  protected readonly cargando = computed(() => !this.iniciado() || this.listado.cargando());
  protected readonly error = computed(() => {
    const falloAnios = this.anios.error();
    return falloAnios ? this.errores.describe(falloAnios).mensaje : this.listado.error();
  });

  /** SUPUESTO: CP-02. Las columnas «Leche por pagar» y «Caja neta» son opcionales y vienen activadas. */
  protected readonly masColumnas = signal(true);

  private readonly columnasBase: DataTableColumn<Periodo>[] = [
    // `key` is also the sort field sent to the API, so only API sort fields are sortable.
    { key: 'fecha_inicio', label: 'Quincena', value: (p) => etiquetaQuincena(p.mes, p.quincena) },
    { key: 'fechas', label: 'Fechas', sortable: false, value: (p) => `${formatoFecha(p.fecha_inicio)} – ${formatoFecha(p.fecha_fin)}` },
    { key: 'estado', label: 'Estado', value: (p) => p.estado },
    { key: 'ingresos_ventas', label: 'Ingresos', sortable: false, align: 'end', value: (p) => p.ingresos_ventas },
    { key: 'costo_produccion', label: 'Costo de producción', sortable: false, align: 'end', value: (p) => p.costo_produccion },
    { key: 'gastos_operativos', label: 'Gastos', sortable: false, align: 'end', value: (p) => p.gastos_operativos },
    { key: 'cartera_castigada', label: 'Cartera castigada', sortable: false, align: 'end', value: (p) => p.cartera_castigada },
    { key: 'resultado_estimado', label: 'Resultado estimado', align: 'end', value: (p) => p.resultado_estimado },
  ];
  private readonly columnasCuentas: DataTableColumn<Periodo>[] = [
    { key: 'leche_por_pagar', label: 'Leche por pagar', sortable: false, align: 'end', value: (p) => p.leche_por_pagar },
    { key: 'caja_neta', label: 'Caja neta', sortable: false, align: 'end', value: (p) => p.caja_neta },
  ];
  private readonly columnaAcciones: DataTableColumn<Periodo> = { key: 'acciones', label: 'Acciones', sortable: false, align: 'end', value: () => '' };
  protected readonly columnas = computed(() => [...this.columnasBase, ...(this.masColumnas() ? this.columnasCuentas : []), this.columnaAcciones]);

  protected readonly periodoId = (p: Periodo) => p.id_periodo;
  protected readonly cop = formatoCop;
  protected readonly fecha = formatoFecha;
  protected readonly quincena = (p: Periodo) => etiquetaQuincena(p.mes, p.quincena);
  protected readonly esActual = (p: Periodo) => p.id_periodo === this.actualId();

  // ---------- Actions ----------

  protected readonly motivoReabrir = MOTIVO_REABRIR;
  protected readonly dialogoAnio = signal(false);
  protected readonly cerrando = signal<Periodo | null>(null);
  protected readonly reabriendo = signal<Periodo | null>(null);
  /** One request at a time: disables every confirm button while it runs. */
  protected readonly procesando = signal(false);

  protected readonly anioSugerido = computed(() => {
    const lista = this.listaAnios();
    // SUPUESTO: año sugerido = último año existente + 1 (o el año actual si no hay ninguno), sin pasar de 2100.
    return lista.length > 0 ? Math.min(Math.max(...lista) + 1, 2100) : new Date().getFullYear();
  });

  protected readonly mensajeCerrar = computed(() => {
    const periodo = this.cerrando();
    return periodo
      ? `Vas a cerrar ${this.quincena(periodo)} de ${periodo.anio}. Mientras esté cerrada no se podrán registrar ventas, recepciones, gastos ni otros movimientos con fecha dentro de esta quincena. Podrás reabrirla indicando un motivo.`
      : '';
  });
  protected readonly mensajeReabrir = computed(() => {
    const periodo = this.reabriendo();
    return periodo
      ? `Vas a reabrir ${this.quincena(periodo)} de ${periodo.anio}. Quedará registrado quién la reabrió y por qué.`
      : '';
  });

  protected cambiarAnio(valor: string): void {
    this.anioElegido.set(Number(valor));
  }

  protected cambiarEstado(valor: string): void {
    this.filtroEstado.set(valor as FiltroEstado);
  }

  protected reintentar(): void {
    if (this.anios.error()) {
      this.anios.reload();
      this.actual.reload();
    } else {
      this.listado.recargar();
    }
  }

  protected confirmarCrearAnio(anio: number): void {
    if (this.procesando()) return;
    this.procesando.set(true);
    this.repo
      .crearAnio(anio)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.procesando.set(false);
          this.dialogoAnio.set(false);
          if (resultado.creados > 0) {
            this.toast.exito(`Se crearon ${resultado.creados} quincenas de ${resultado.anio}.`);
            this.anioElegido.set(resultado.anio);
          } else {
            // SUPUESTO: no hay toast "informativo"; se usa el de éxito, que es el no bloqueante que existe.
            this.toast.exito(`Las quincenas de ${resultado.anio} ya existían.`);
          }
          this.anios.reload();
          this.actual.reload();
          this.listado.recargar();
        },
        error: (error: unknown) => {
          this.procesando.set(false);
          this.mostrarError(error);
        },
      });
  }

  protected confirmarCerrar(): void {
    const periodo = this.cerrando();
    if (!periodo || this.procesando()) return;
    this.ejecutar(this.repo.cerrar(periodo.id_periodo), this.cerrando, `${this.quincena(periodo)} de ${periodo.anio} cerrada.`);
  }

  protected confirmarReabrir(motivo: string): void {
    const periodo = this.reabriendo();
    if (!periodo || this.procesando()) return;
    this.ejecutar(this.repo.reabrir(periodo.id_periodo, motivo), this.reabriendo, `${this.quincena(periodo)} de ${periodo.anio} reabierta.`);
  }

  private ejecutar(peticion: ReturnType<typeof this.repo.cerrar>, dialogo: { set(valor: Periodo | null): void }, exito: string): void {
    this.procesando.set(true);
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.procesando.set(false);
        dialogo.set(null);
        this.toast.exito(exito);
        this.listado.recargar();
      },
      error: (error: unknown) => {
        this.procesando.set(false);
        dialogo.set(null);
        this.mostrarError(error);
        // 20010: someone else already changed it; show what is there now.
        const causa = causaDe(error);
        if (isApiError(causa) && causa.code === 20010) {
          this.listado.recargar();
        }
      },
    });
  }

  private mostrarError(error: unknown): void {
    const { mensaje, supportRef } = this.errores.describe(error);
    this.toast.error(mensaje, supportRef);
  }
}
