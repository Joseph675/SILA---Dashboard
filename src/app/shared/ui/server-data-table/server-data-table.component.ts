import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, contentChildren, inject, input, output } from '@angular/core';
import { PAGE_SIZE_OPTIONS, Page } from '../../../core/api/page.models';
import { EsMovilService } from '../../services/es-movil.service';
import { DataTableCellDirective } from '../data-table/data-table-cell.directive';
import type { DataTableColumn } from '../data-table/data-table.models';
import { IconComponent } from '../icon/icon.component';

const FILAS_SKELETON = [0, 1, 2, 3, 4];

/**
 * Table over a server `Page<T>`: sorting and paging are requested from the
 * repository through outputs, never done here. Covers the loading
 * (skeleton), empty, error (retry) and data states.
 *
 * Custom cells reuse `appDataTableCell` templates, same as `app-data-table`.
 * Empty-state actions are projected with the `accionVacio` attribute.
 */
@Component({
  selector: 'app-server-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, NgTemplateOutlet],
  templateUrl: './server-data-table.component.html',
})
export class ServerDataTableComponent<T> {
  readonly columns = input.required<readonly DataTableColumn<T>[]>();
  readonly page = input<Page<T> | undefined>(undefined);
  readonly rowId = input.required<(row: T) => string | number>();
  readonly cargando = input(false);
  /** Message of the last load failure; shows the error state with a retry button. */
  readonly error = input<string | null>(null);
  /** Current `campo,dir` sort. */
  readonly sort = input<string | null>(null);
  readonly titulo = input.required<string>();
  readonly vacioTitulo = input('No hay registros');
  readonly vacioAyuda = input('');

  readonly pageChange = output<number>();
  readonly sizeChange = output<number>();
  readonly sortChange = output<string>();
  readonly reintentar = output<void>();

  private readonly cellTemplates = contentChildren(DataTableCellDirective);
  protected readonly movil = inject(EsMovilService).movil;

  // ---- Phone cards: heading column, detail columns (minus the hidden ones) and the actions column ----
  protected readonly colTitulo = computed(() => {
    const cols = this.columns();
    return cols.find((c) => c.rol === 'titulo') ?? cols.find((c) => c.rol !== 'acciones' && c.key !== 'acciones') ?? null;
  });
  protected readonly colAcciones = computed(() => this.columns().find((c) => c.rol === 'acciones' || c.key === 'acciones') ?? null);
  protected readonly colDetalle = computed(() => {
    const titulo = this.colTitulo();
    const acciones = this.colAcciones();
    return this.columns().filter((c) => c !== titulo && c !== acciones && !c.ocultarEnMovil);
  });
  protected readonly colOrdenables = computed(() => this.columns().filter((c) => c.sortable !== false && c.key !== 'acciones'));

  protected readonly tamanos = PAGE_SIZE_OPTIONS;
  protected readonly filasSkeleton = FILAS_SKELETON;

  protected readonly filas = computed(() => this.page()?.items ?? []);
  protected readonly total = computed(() => this.page()?.total ?? 0);
  protected readonly indice = computed(() => this.page()?.page ?? 0);
  protected readonly tamano = computed(() => this.page()?.size ?? PAGE_SIZE_OPTIONS[0]);
  protected readonly ultimaPagina = computed(() => Math.max(0, Math.ceil(this.total() / this.tamano()) - 1));
  protected readonly desde = computed(() => (this.total() === 0 ? 0 : this.indice() * this.tamano() + 1));
  protected readonly hasta = computed(() => Math.min(this.total(), (this.indice() + 1) * this.tamano()));
  /** First load: nothing to show yet, so the skeleton replaces the body. */
  protected readonly primeraCarga = computed(() => this.cargando() && !this.page());

  private readonly sortCampo = computed(() => this.sort()?.split(',')[0] ?? null);
  private readonly sortDir = computed(() => this.sort()?.split(',')[1] ?? 'asc');

  protected templateFor(column: DataTableColumn<T>) {
    return this.cellTemplates().find((cell) => cell.appDataTableCell() === column.key)?.template;
  }

  protected ariaSort(column: DataTableColumn<T>): 'ascending' | 'descending' | null {
    if (this.sortCampo() !== column.key) return null;
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  protected iconoOrden(column: DataTableColumn<T>) {
    if (this.sortCampo() !== column.key) return 'lucideChevronsUpDown' as const;
    return this.sortDir() === 'asc' ? ('lucideChevronUp' as const) : ('lucideChevronDown' as const);
  }

  /** Phone sort control: the chosen column keeps the current direction. */
  protected ordenarPor(key: string): void {
    this.sortChange.emit(`${key},${this.sortDir()}`);
  }

  protected invertirOrden(): void {
    this.sortChange.emit(`${this.sortCampo() ?? this.colOrdenables()[0]?.key},${this.sortDir() === 'asc' ? 'desc' : 'asc'}`);
  }

  protected campoOrden(): string {
    return this.sortCampo() ?? '';
  }

  protected direccionOrden(): string {
    return this.sortDir();
  }

  protected ordenar(column: DataTableColumn<T>): void {
    const dir = this.sortCampo() === column.key && this.sortDir() === 'asc' ? 'desc' : 'asc';
    this.sortChange.emit(`${column.key},${dir}`);
  }

  protected cambiarTamano(valor: string): void {
    this.sizeChange.emit(Number(valor));
  }
}
