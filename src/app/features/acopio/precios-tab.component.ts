import { FiltrosPlegablesComponent } from '../../shared/ui/filtros-plegables/filtros-plegables.component';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SelectorBuscableComponent } from '../../shared/ui/selector-buscable/selector-buscable.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoCop, formatoFecha } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { PARAMETROS_REPOSITORY } from '../parametros/data/parametros.provider';
import { ACOPIO_REPOSITORY } from './data/acopio.provider';
import type { PrecioProveedor } from './models/acopio.models';
import { PrecioLecheDialogComponent } from './precio-leche-dialog.component';
import { cargarProveedoresLecheros } from './proveedores-lecheros';

/** Price history per lechero; the one in force today is highlighted. Only an ADMIN can set a price. */
@Component({
  selector: 'app-precios-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FiltrosPlegablesComponent, DataTableCellDirective, HasRoleDirective, IconComponent, PrecioLecheDialogComponent, SelectorBuscableComponent, ServerDataTableComponent, StatusChipComponent],
  template: `
    <app-filtros-plegables clases="mb-3 flex flex-wrap items-end gap-3">
      <div class="w-full sm:w-64">
        <label for="precios-lechero" class="mb-1 block text-xs font-medium text-muted-foreground">Lechero</label>
        <app-selector-buscable idCampo="precios-lechero" [opciones]="proveedores.opciones()" [(valor)]="proveedor" etiquetaVacia="Todos los lecheros" placeholder="Buscar lechero…" />
      </div>
      <label class="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" class="size-4" [checked]="soloVigentes()" (change)="soloVigentes.set($any($event.target).checked)" />
        Solo los vigentes
      </label>
      <button *hasRole="'ADMIN'" type="button" data-accion class="sila-btn sila-btn-primary ms-auto" (click)="dialogo.set(true)">
        <app-icon name="lucidePlus" class="size-4" aria-hidden="true" />
        Fijar precio
      </button>
    </app-filtros-plegables>
    <p class="mb-3 rounded-md bg-muted px-4 py-2 text-sm" data-testid="precio-defecto">
      Los lecheros sin precio propio se pagan al <strong>precio por defecto</strong>: {{ porDefecto() === null ? '—' : cop(porDefecto()!) }} por litro (parámetro «Precio de la leche por defecto»).
      Un precio nuevo solo afecta las entregas nuevas; las ya registradas conservan el suyo.
    </p>

    <app-server-data-table
      titulo="Precios de la leche"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="precioId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="null"
      vacioTitulo="Aún no hay precios fijados"
      vacioAyuda="Mientras tanto, todos los lecheros se pagan al precio por defecto."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="precio_litro" [cellRows]="listado.datos()?.items" let-p><span class="font-medium tabular-nums">{{ cop(p.precio_litro) }}</span></ng-template>
      <ng-template appDataTableCell="vigente_desde" [cellRows]="listado.datos()?.items" let-p><span class="whitespace-nowrap">{{ fecha(p.vigente_desde) }}</span></ng-template>
      <ng-template appDataTableCell="vigente" [cellRows]="listado.datos()?.items" let-p>
        <app-status-chip [texto]="p.vigente ? 'Vigente' : 'Anterior'" [tono]="p.vigente ? 'exito' : 'neutro'" />
      </ng-template>
    </app-server-data-table>

    <app-precio-leche-dialog [abierto]="dialogo()" [proveedores]="proveedores.opciones()" (guardado)="alGuardar($event)" (cerrar)="dialogo.set(false)" />
  `,
})
export class PreciosTabComponent {
  private readonly repo = inject(ACOPIO_REPOSITORY);
  private readonly parametros = inject(PARAMETROS_REPOSITORY);
  private readonly toast = inject(ToastService);

  protected readonly proveedores = cargarProveedoresLecheros();
  protected readonly cop = formatoCop;
  protected readonly fecha = formatoFecha;

  protected readonly proveedor = signal<number | null>(null);
  protected readonly soloVigentes = signal(false);
  protected readonly dialogo = signal(false);

  private readonly parametrosRecurso = rxResource({ stream: () => this.parametros.listar() });
  protected readonly porDefecto = () => (this.parametrosRecurso.hasValue() ? (this.parametrosRecurso.value().find((p) => p.clave === 'PRECIO_LECHE_DEFAULT')?.valor ?? null) : null);

  protected readonly listado = crearListado({
    filtros: () => ({ id_proveedor: this.proveedor() ?? undefined, solo_vigentes: this.soloVigentes() || undefined }),
    cargar: (query) => this.repo.listarPrecios(query),
    // The contract lists no sort for this endpoint: none is sent.
    sort: '',
  });

  protected readonly columnas: DataTableColumn<PrecioProveedor>[] = [
    { key: 'proveedor', label: 'Lechero', sortable: false, value: (p) => p.proveedor },
    { key: 'precio_litro', label: 'Precio por litro', sortable: false, align: 'end', value: (p) => p.precio_litro },
    { key: 'vigente_desde', label: 'Rige desde', sortable: false, value: (p) => p.vigente_desde },
    { key: 'vigente', label: 'Estado', sortable: false, value: (p) => (p.vigente ? 'Vigente' : 'Anterior') },
  ];
  protected readonly precioId = (p: PrecioProveedor) => p.id_precio;

  protected alGuardar(precio: PrecioProveedor): void {
    this.dialogo.set(false);
    this.listado.recargar();
    this.toast.exito(`Precio de ${precio.proveedor} fijado en ${formatoCop(precio.precio_litro)} por litro.`);
  }
}
