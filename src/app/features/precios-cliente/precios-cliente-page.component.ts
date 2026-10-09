import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiErrorService } from '../../core/api/api-error';
import type { Cliente } from '../catalogos/models/catalogos.models';
import { ClienteSelectorComponent } from '../../shared/ui/cliente-selector/cliente-selector.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { formatoCop } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { cargarProductosActivos } from '../produccion/productos-activos';
import { PRECIOS_CLIENTE_REPOSITORY } from './data/precios-cliente.provider';
import type { PrecioCliente } from './models/precios-cliente.models';
import { PrecioDialogComponent } from './precio-dialog.component';

@Component({
  selector: 'app-precios-cliente-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClienteSelectorComponent, ConfirmDialogComponent, DataTableCellDirective, IconComponent, PageHeaderComponent, PrecioDialogComponent, ServerDataTableComponent, StatusChipComponent],
  template: `
    <app-page-header title="Precios por cliente" description="Acuerdos de precio fijo de un producto con un cliente. Se aplican solos en el punto de venta.">
      <button type="button" class="sila-btn sila-btn-primary shrink-0" [disabled]="!cliente()" (click)="abrirNuevo()">
        <app-icon name="lucidePlus" class="size-4" aria-hidden="true" />
        Nuevo acuerdo
      </button>
    </app-page-header>

    <div class="mb-4 flex flex-wrap items-end gap-4">
      <div class="w-full sm:w-96">
        <label for="precios-cliente" class="mb-1 block text-xs font-medium text-muted-foreground">Cliente</label>
        <app-cliente-selector idCampo="precios-cliente" [etiquetaVacia]="null" (clienteElegido)="cliente.set($event)" />
      </div>
      <label class="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" class="size-4" [checked]="verDesactivados()" (change)="verDesactivados.set($any($event.target).checked)" />
        Ver también los desactivados
      </label>
    </div>
    <p class="mb-4 text-xs text-muted-foreground">Si el precio de lista cambia después, el precio pactado no se mueve hasta que lo renegocies.</p>

    @if (!cliente()) {
      <p class="sila-card p-8 text-center text-sm text-muted-foreground">Elige un cliente para ver sus precios pactados.</p>
    } @else {
      <app-server-data-table
        titulo="Precios pactados"
        [columns]="columnas"
        [page]="listado.datos()"
        [rowId]="precioId"
        [cargando]="listado.cargando()"
        [error]="listado.error()"
        [sort]="listado.sort()"
        vacioTitulo="Este cliente no tiene precios pactados"
        vacioAyuda="Crea un acuerdo con «Nuevo acuerdo»: mientras no exista, se le cobra el precio de lista."
        (pageChange)="listado.irAPagina($event)"
        (sizeChange)="listado.cambiarTamano($event)"
        (sortChange)="listado.sort.set($event)"
        (reintentar)="listado.recargar()"
      >
        <ng-template appDataTableCell="precio_base" [cellRows]="listado.datos()?.items" let-p><span class="tabular-nums">{{ cop(p.precio_base) }}</span></ng-template>
        <ng-template appDataTableCell="precio" [cellRows]="listado.datos()?.items" let-p><span class="font-medium tabular-nums">{{ cop(p.precio) }}</span></ng-template>
        <ng-template appDataTableCell="diferencia" [cellRows]="listado.datos()?.items" let-p>
          <span class="whitespace-nowrap tabular-nums" [class.text-destructive]="p.diferencia > 0" [class.text-success]="p.diferencia < 0">
            {{ p.diferencia > 0 ? '▲ +' : p.diferencia < 0 ? '▼ −' : '' }}{{ cop(abs(p.diferencia)) }}
          </span>
        </ng-template>
        <ng-template appDataTableCell="activo" [cellRows]="listado.datos()?.items" let-p>
          <app-status-chip [texto]="p.activo ? 'Activo' : 'Desactivado'" [tono]="p.activo ? 'exito' : 'neutro'" />
        </ng-template>
        <ng-template appDataTableCell="acciones" [cellRows]="listado.datos()?.items" let-p>
          <div class="flex gap-2">
            <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="editando.set(p)">Editar<span class="sr-only"> el precio de {{ p.producto }}</span></button>
            @if (p.activo) {
              <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="desactivando.set(p)">Desactivar<span class="sr-only"> el acuerdo de {{ p.producto }}</span></button>
            }
          </div>
        </ng-template>
      </app-server-data-table>
    }

    @if (cliente(); as c) {
      <app-precio-dialog
        [abierto]="dialogoNuevo() || editando() !== null"
        [idCliente]="c.id_cliente"
        [nombreCliente]="c.nombre"
        [productos]="productos.productos()"
        [existente]="editando()"
        (guardado)="alGuardar($event)"
        (cerrar)="dialogoNuevo.set(false); editando.set(null)"
      />
    }

    <app-confirm-dialog
      [open]="desactivando() !== null"
      titulo="Desactivar acuerdo"
      [mensaje]="'A ' + (cliente()?.nombre ?? 'este cliente') + ' se le volverá a cobrar el precio de lista de «' + (desactivando()?.producto ?? '') + '». Para reactivarlo hay que fijar el precio otra vez.'"
      textoConfirmar="Desactivar"
      [peligro]="true"
      [ocupado]="ocupado()"
      (confirmar)="desactivar()"
      (cancelar)="desactivando.set(null)"
    />
  `,
})
export class PreciosClientePageComponent {
  private readonly repo = inject(PRECIOS_CLIENTE_REPOSITORY);
  private readonly toast = inject(ToastService);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly productos = cargarProductosActivos();
  protected readonly cop = formatoCop;

  protected readonly cliente = signal<Cliente | null>(null);
  protected readonly verDesactivados = signal(false);
  protected readonly dialogoNuevo = signal(false);
  protected readonly editando = signal<PrecioCliente | null>(null);
  protected readonly desactivando = signal<PrecioCliente | null>(null);
  protected readonly ocupado = signal(false);

  protected readonly listado = crearListado({
    filtros: () => ({ id_cliente: this.cliente()?.id_cliente, activo: this.verDesactivados() ? undefined : true }),
    cargar: (query) => this.repo.listar(query),
    sort: 'producto,asc',
    habilitado: () => this.cliente() !== null,
  });

  // Only the sort fields the contract lists are sortable (cliente, producto, precio, diferencia).
  protected readonly columnas: DataTableColumn<PrecioCliente>[] = [
    { key: 'producto', label: 'Producto', value: (p) => p.producto },
    { key: 'precio_base', label: 'Precio de lista', align: 'end', sortable: false, value: (p) => p.precio_base },
    { key: 'precio', label: 'Precio pactado', align: 'end', value: (p) => p.precio },
    { key: 'diferencia', label: 'Diferencia', align: 'end', value: (p) => p.diferencia },
    { key: 'activo', label: 'Estado', sortable: false, value: (p) => (p.activo ? 'Activo' : 'Desactivado') },
    { key: 'acciones', label: 'Acciones', sortable: false, value: () => '' },
  ];
  protected readonly precioId = (p: PrecioCliente) => p.id_precio;

  protected abs(n: number): number {
    return Math.abs(n);
  }

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.dialogoNuevo.set(true);
  }

  protected alGuardar(precio: PrecioCliente): void {
    this.dialogoNuevo.set(false);
    this.editando.set(null);
    this.listado.recargar();
    this.toast.exito(`Precio de «${precio.producto}» fijado en ${formatoCop(precio.precio)}.`);
  }

  protected desactivar(): void {
    const p = this.desactivando();
    if (!p || this.ocupado()) return;
    this.ocupado.set(true);
    this.repo
      .desactivar(p.id_precio)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.ocupado.set(false);
          this.desactivando.set(null);
          this.listado.recargar();
          this.toast.exito(`Acuerdo de «${p.producto}» desactivado.`);
        },
        error: (fallo: unknown) => {
          this.ocupado.set(false);
          this.desactivando.set(null);
          this.toast.error(mensajeDeFallo(this.errores, fallo, [20006, 20007]));
        },
      });
  }
}
