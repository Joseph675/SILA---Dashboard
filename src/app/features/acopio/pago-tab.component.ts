import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { SelectorBuscableComponent } from '../../shared/ui/selector-buscable/selector-buscable.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { formatoCop, formatoNumero } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { PERIODOS_REPOSITORY } from '../periodos/data/periodos.provider';
import { etiquetaQuincena } from '../periodos/periodos.format';
import { ACOPIO_REPOSITORY } from './data/acopio.provider';
import type { PagoLechero } from './models/acopio.models';
import { cargarProveedoresLecheros } from './proveedores-lecheros';

/** A resource that has not answered yet. After the first answer it is never "loading" again (it "reloads"). */
function pendiente(estado: string): boolean {
  return estado === 'loading' || estado === 'idle';
}

@Component({
  selector: 'app-pago-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableCellDirective, SelectorBuscableComponent, ServerDataTableComponent],
  template: `
    <div class="mb-3 flex flex-wrap items-end gap-3">
      <div>
        <label for="pago-periodo" class="mb-1 block text-xs font-medium text-muted-foreground">Quincena</label>
        <select id="pago-periodo" class="sila-select w-64" (change)="cambiarPeriodo($any($event.target).value)">
          <option value="" [selected]="periodo() === null">Todas las quincenas</option>
          @for (p of periodos(); track p.id_periodo) {
            <option [value]="p.id_periodo" [selected]="p.id_periodo === periodo()">{{ p.etiqueta }}</option>
          }
        </select>
      </div>
      <div class="w-full sm:w-64">
        <label for="pago-proveedor" class="mb-1 block text-xs font-medium text-muted-foreground">Proveedor</label>
        <app-selector-buscable idCampo="pago-proveedor" [opciones]="proveedores.opciones()" [(valor)]="proveedor" etiquetaVacia="Todos los proveedores" placeholder="Buscar proveedor…" />
      </div>
    </div>
    <p class="mb-3 text-sm text-muted-foreground">Lo rechazado no se paga: los litros rechazados se muestran aparte y no entran en «litros a pagar».</p>

    <app-server-data-table
      titulo="Pago a lecheros"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="filaId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="null"
      vacioTitulo="No hay entregas para ese filtro"
      vacioAyuda="Prueba con otra quincena u otro proveedor."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="quincena" [cellRows]="listado.datos()?.items" let-p>
        <span class="whitespace-nowrap">{{ p.anio }} · {{ quincena(p.mes, p.quincena) }}</span>
      </ng-template>
      <ng-template appDataTableCell="litros_a_pagar" [cellRows]="listado.datos()?.items" let-p>
        <span class="font-medium tabular-nums">{{ numero(p.litros_a_pagar) }} L</span>
      </ng-template>
      <ng-template appDataTableCell="litros_rechazados" [cellRows]="listado.datos()?.items" let-p>
        <span class="tabular-nums" [class.text-destructive]="p.litros_rechazados > 0">{{ numero(p.litros_rechazados) }} L</span>
      </ng-template>
      <ng-template appDataTableCell="precio_promedio" [cellRows]="listado.datos()?.items" let-p><span class="tabular-nums">{{ cop(p.precio_promedio) }}</span></ng-template>
      <ng-template appDataTableCell="valor_leche" [cellRows]="listado.datos()?.items" let-p><span class="tabular-nums">{{ cop(p.valor_leche) }}</span></ng-template>
      <ng-template appDataTableCell="valor_pagado" [cellRows]="listado.datos()?.items" let-p><span class="tabular-nums">{{ cop(p.valor_pagado) }}</span></ng-template>
      <ng-template appDataTableCell="saldo" [cellRows]="listado.datos()?.items" let-p>
        <span class="font-medium tabular-nums" [class.text-destructive]="p.saldo < 0">{{ cop(p.saldo) }}</span>
      </ng-template>
    </app-server-data-table>

    @if (listado.datos(); as pagina) {
      @if (pagina.items.length > 0) {
        <p class="mt-3 rounded-md bg-muted px-4 py-2 text-sm" data-testid="totales-pago">
          <strong>Total de las filas de esta página</strong> (calculado en pantalla, no viene del servidor): {{ numero(totales().pagar) }} L a pagar ·
          {{ numero(totales().rechazados) }} L rechazados
          @if (pagina.total > pagina.items.length) {
            · hay más filas en otras páginas
          }
        </p>
      }
    }
  `,
})
export class PagoTabComponent {
  private readonly repo = inject(ACOPIO_REPOSITORY);
  private readonly periodosRepo = inject(PERIODOS_REPOSITORY);

  protected readonly proveedores = cargarProveedoresLecheros();

  private readonly lista = rxResource({ stream: () => this.periodosRepo.listar({ page: 0, size: 50, sort: 'fecha_inicio,desc' }) });
  /** Fails with 20007 when today has no quincena; that is normal here: the filter just starts on "todas". */
  private readonly actual = rxResource({ stream: () => this.periodosRepo.actual() });

  /** Both lookups answered, so the default quincena is known and the list loads once. */
  private readonly iniciado = computed(() => !pendiente(this.lista.status()) && !pendiente(this.actual.status()));

  /** `undefined` = the person has not chosen yet (the current quincena applies). */
  private readonly elegido = signal<number | null | undefined>(undefined);
  protected readonly periodo = computed(() => {
    const elegido = this.elegido();
    if (elegido !== undefined) return elegido;
    // SUPUESTO: AP-06. La quincena actual viene preseleccionada; si hoy no tiene quincena, se muestran todas.
    return this.actual.hasValue() ? this.actual.value().id_periodo : null;
  });
  protected readonly proveedor = signal<number | null>(null);

  protected readonly periodos = computed(() =>
    (this.lista.hasValue() ? this.lista.value().items : []).map((p) => ({
      id_periodo: p.id_periodo,
      etiqueta: `${p.anio} · ${etiquetaQuincena(p.mes, p.quincena)}`,
    })),
  );

  protected readonly numero = formatoNumero;
  protected readonly cop = formatoCop;
  protected readonly quincena = etiquetaQuincena;

  protected readonly listado = crearListado({
    filtros: () => ({ id_periodo: this.periodo() ?? undefined, id_proveedor: this.proveedor() ?? undefined }),
    cargar: (query) => this.repo.pagoLecheros(query),
    // The API defines no sort for this endpoint, so none is sent.
    sort: '',
    habilitado: () => this.iniciado(),
  });

  protected readonly columnas: DataTableColumn<PagoLechero>[] = [
    { key: 'quincena', label: 'Quincena', sortable: false, value: (p) => `${p.anio} ${p.mes} ${p.quincena}` },
    { key: 'proveedor', label: 'Proveedor', sortable: false, value: (p) => p.proveedor },
    { key: 'litros_a_pagar', label: 'Litros a pagar', align: 'end', sortable: false, value: (p) => p.litros_a_pagar },
    { key: 'litros_rechazados', label: 'Litros rechazados', align: 'end', sortable: false, value: (p) => p.litros_rechazados },
    { key: 'precio_promedio', label: 'Precio prom.', align: 'end', sortable: false, value: (p) => p.precio_promedio },
    { key: 'valor_leche', label: 'Valor', align: 'end', sortable: false, value: (p) => p.valor_leche },
    { key: 'valor_pagado', label: 'Pagado', align: 'end', sortable: false, value: (p) => p.valor_pagado },
    { key: 'saldo', label: 'Saldo', align: 'end', sortable: false, value: (p) => p.saldo },
  ];
  protected readonly filaId = (p: PagoLechero) => `${p.id_periodo}-${p.id_proveedor}`;

  protected readonly totales = computed(() => {
    const filas = this.listado.datos()?.items ?? [];
    return {
      pagar: filas.reduce((suma, f) => suma + f.litros_a_pagar, 0),
      rechazados: filas.reduce((suma, f) => suma + f.litros_rechazados, 0),
    };
  });

  protected cambiarPeriodo(valor: string): void {
    this.elegido.set(valor === '' ? null : Number(valor));
  }
}
