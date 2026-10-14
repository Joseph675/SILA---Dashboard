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
import { crearListado } from '../../../shared/utils/listado';
import { CATALOGOS_REPOSITORY } from '../data/catalogos.provider';
import { FiltroActivo, Proveedor, TipoProveedor, activoDesdeFiltro } from '../models/catalogos.models';
import { ProveedorFormDialogComponent } from './proveedor-form-dialog.component';

@Component({
  selector: 'app-proveedores-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    DataTableCellDirective,
    HasRoleDirective,
    IconComponent,
    ProveedorFormDialogComponent,
    ServerDataTableComponent,
    StatusChipComponent,
  ],
  templateUrl: './proveedores-tab.component.html',
})
export class ProveedoresTabComponent {
  private readonly repo = inject(CATALOGOS_REPOSITORY);
  private readonly toast = inject(ToastService);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly texto = signal('');
  protected readonly filtroActivo = signal<FiltroActivo>('TODOS');
  protected readonly filtroTipo = signal<TipoProveedor | 'TODOS'>('TODOS');
  private readonly textoBusqueda = toSignal(
    toObservable(this.texto).pipe(
      debounceTime(300),
      map((texto) => texto.trim()),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  protected readonly listado = crearListado({
    filtros: () => ({
      texto: this.textoBusqueda() || undefined,
      activo: activoDesdeFiltro(this.filtroActivo()),
      tipo_proveedor: this.filtroTipo() === 'TODOS' ? undefined : (this.filtroTipo() as TipoProveedor),
    }),
    cargar: (query) => this.repo.listarProveedores(query),
    sort: 'nombre,asc',
  });

  protected readonly columnas: DataTableColumn<Proveedor>[] = [
    { key: 'numero_documento', label: 'Documento', value: (p) => p.numero_documento },
    { key: 'nombre', label: 'Nombre', rol: 'titulo', value: (p) => p.nombre },
    { key: 'telefono', label: 'Teléfono', sortable: false, value: (p) => p.telefono },
    { key: 'tipo_proveedor', label: 'Tipo', value: (p) => p.tipo_proveedor },
    { key: 'activo', label: 'Estado', value: (p) => (p.activo ? 1 : 0) },
    { key: 'acciones', label: 'Acciones', sortable: false, align: 'end', value: () => '' },
  ];

  protected readonly proveedorId = (p: Proveedor) => p.id_proveedor;

  /** `undefined` = closed, `null` = new supplier. */
  protected readonly editando = signal<Proveedor | null | undefined>(undefined);
  protected readonly cambiandoEstado = signal<Proveedor | null>(null);
  protected readonly procesandoEstado = signal(false);

  protected cambiarFiltroActivo(valor: string): void {
    this.filtroActivo.set(valor as FiltroActivo);
  }

  protected cambiarFiltroTipo(valor: string): void {
    this.filtroTipo.set(valor as TipoProveedor | 'TODOS');
  }

  protected alGuardar(proveedor: Proveedor): void {
    const nuevo = this.editando() === null;
    this.editando.set(undefined);
    this.toast.exito(nuevo ? `Proveedor "${proveedor.nombre}" creado.` : `Proveedor "${proveedor.nombre}" actualizado.`);
    this.listado.recargar();
  }

  protected confirmarEstado(): void {
    const proveedor = this.cambiandoEstado();
    if (!proveedor || this.procesandoEstado()) return;
    this.procesandoEstado.set(true);
    this.repo
      .cambiarEstadoProveedor(proveedor.id_proveedor, !proveedor.activo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizado) => {
          this.procesandoEstado.set(false);
          this.cambiandoEstado.set(null);
          this.toast.exito(`Proveedor "${actualizado.nombre}" ${actualizado.activo ? 'activado' : 'desactivado'}.`);
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
