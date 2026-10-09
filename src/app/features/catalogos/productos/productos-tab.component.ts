import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { ApiErrorService } from '../../../core/api/api-error';
import { HasRoleDirective } from '../../../core/auth/has-role.directive';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { DataTableCellDirective } from '../../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../../shared/ui/data-table/data-table.models';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ServerDataTableComponent } from '../../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { formatoCop, formatoNumero } from '../../../shared/utils/formato-co';
import { crearListado } from '../../../shared/utils/listado';
import { CATALOGOS_REPOSITORY } from '../data/catalogos.provider';
import { FiltroActivo, Producto, activoDesdeFiltro } from '../models/catalogos.models';
import { ModoProducto, ProductoFormDialogComponent } from './producto-form-dialog.component';

const MENSAJES_GUARDADO: Record<ModoProducto, string> = {
  crear: 'creado',
  editar: 'actualizado',
  precio: 'con precio actualizado',
};

@Component({
  selector: 'app-productos-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    DataTableCellDirective,
    HasRoleDirective,
    IconComponent,
    ProductoFormDialogComponent,
    ServerDataTableComponent,
    StatusChipComponent,
  ],
  templateUrl: './productos-tab.component.html',
})
export class ProductosTabComponent {
  private readonly repo = inject(CATALOGOS_REPOSITORY);
  private readonly toast = inject(ToastService);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly texto = signal('');
  protected readonly filtroActivo = signal<FiltroActivo>('TODOS');
  private readonly textoBusqueda = toSignal(
    toObservable(this.texto).pipe(
      debounceTime(300),
      map((texto) => texto.trim()),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  protected readonly listado = crearListado({
    filtros: () => ({ texto: this.textoBusqueda() || undefined, activo: activoDesdeFiltro(this.filtroActivo()) }),
    cargar: (query) => this.repo.listarProductos(query),
    sort: 'nombre,asc',
  });

  protected readonly columnas: DataTableColumn<Producto>[] = [
    { key: 'codigo_sku', label: 'SKU', value: (p) => p.codigo_sku },
    { key: 'nombre', label: 'Nombre', value: (p) => p.nombre },
    { key: 'unidad_medida', label: 'Unidad', value: (p) => p.unidad_medida },
    { key: 'precio_base', label: 'Precio base', align: 'end', value: (p) => p.precio_base },
    { key: 'tarifa_iva', label: 'IVA', align: 'end', value: (p) => p.tarifa_iva },
    { key: 'stock', label: 'Stock', align: 'end', value: (p) => p.stock },
    { key: 'activo', label: 'Estado', value: (p) => (p.activo ? 1 : 0) },
    { key: 'acciones', label: 'Acciones', sortable: false, align: 'end', value: () => '' },
  ];

  protected readonly productoId = (p: Producto) => p.id_producto;
  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;

  protected readonly dialogo = signal<{ modo: ModoProducto; producto: Producto | null } | null>(null);
  protected readonly cambiandoEstado = signal<Producto | null>(null);
  protected readonly procesandoEstado = signal(false);

  protected cambiarFiltro(valor: string): void {
    this.filtroActivo.set(valor as FiltroActivo);
  }

  protected abrir(modo: ModoProducto, producto: Producto | null = null): void {
    this.dialogo.set({ modo, producto });
  }

  protected alGuardar(producto: Producto): void {
    const modo = this.dialogo()?.modo ?? 'editar';
    this.dialogo.set(null);
    this.toast.exito(`Producto "${producto.nombre}" ${MENSAJES_GUARDADO[modo]}.`);
    this.listado.recargar();
  }

  protected confirmarEstado(): void {
    const producto = this.cambiandoEstado();
    if (!producto || this.procesandoEstado()) return;
    this.procesandoEstado.set(true);
    this.repo
      .cambiarEstadoProducto(producto.id_producto, !producto.activo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizado) => {
          this.procesandoEstado.set(false);
          this.cambiandoEstado.set(null);
          this.toast.exito(`Producto "${actualizado.nombre}" ${actualizado.activo ? 'activado' : 'desactivado'}.`);
          this.listado.recargar();
        },
        error: (error: unknown) => {
          this.procesandoEstado.set(false);
          this.cambiandoEstado.set(null);
          const { mensaje, supportRef } = this.errores.describe(error);
          this.toast.error(mensaje, supportRef);
        },
      });
  }
}
