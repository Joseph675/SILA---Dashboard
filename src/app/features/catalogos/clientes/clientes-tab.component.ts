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
import { formatoCop } from '../../../shared/utils/formato-co';
import { CATALOGOS_REPOSITORY } from '../data/catalogos.provider';
import { Cliente, FiltroActivo, activoDesdeFiltro } from '../models/catalogos.models';
import { ClienteFormDialogComponent } from './cliente-form-dialog.component';

@Component({
  selector: 'app-clientes-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ClienteFormDialogComponent,
    ConfirmDialogComponent,
    DataTableCellDirective,
    HasRoleDirective,
    IconComponent,
    ServerDataTableComponent,
    StatusChipComponent,
  ],
  templateUrl: './clientes-tab.component.html',
})
export class ClientesTabComponent {
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
    cargar: (query) => this.repo.listarClientes(query),
    sort: 'nombre,asc',
  });

  protected readonly columnas: DataTableColumn<Cliente>[] = [
    { key: 'numero_documento', label: 'Documento', value: (c) => c.numero_documento },
    { key: 'nombre', label: 'Nombre', value: (c) => c.nombre },
    { key: 'email', label: 'Correo', value: (c) => c.email },
    { key: 'telefono', label: 'Teléfono', sortable: false, value: (c) => c.telefono },
    { key: 'direccion', label: 'Dirección', sortable: false, value: (c) => c.direccion },
    { key: 'limite_credito', label: 'Límite de crédito', align: 'end', value: (c) => c.limite_credito },
    { key: 'saldo_deudor', label: 'Saldo deudor', align: 'end', value: (c) => c.saldo_deudor },
    { key: 'activo', label: 'Estado', value: (c) => (c.activo ? 1 : 0) },
    { key: 'acciones', label: 'Acciones', sortable: false, align: 'end', value: () => '' },
  ];

  protected readonly clienteId = (c: Cliente) => c.id_cliente;
  protected readonly cop = formatoCop;

  /** `undefined` = closed, `null` = new client. */
  protected readonly editando = signal<Cliente | null | undefined>(undefined);
  protected readonly cambiandoEstado = signal<Cliente | null>(null);
  protected readonly procesandoEstado = signal(false);

  protected cambiarFiltro(valor: string): void {
    this.filtroActivo.set(valor as FiltroActivo);
  }

  protected alGuardar(cliente: Cliente): void {
    const nuevo = this.editando() === null;
    this.editando.set(undefined);
    this.toast.exito(nuevo ? `Cliente "${cliente.nombre}" creado.` : `Cliente "${cliente.nombre}" actualizado.`);
    this.listado.recargar();
  }

  protected confirmarEstado(): void {
    const cliente = this.cambiandoEstado();
    if (!cliente || this.procesandoEstado()) return;
    this.procesandoEstado.set(true);
    this.repo
      .cambiarEstadoCliente(cliente.id_cliente, !cliente.activo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizado) => {
          this.procesandoEstado.set(false);
          this.cambiandoEstado.set(null);
          this.toast.exito(`Cliente "${actualizado.nombre}" ${actualizado.activo ? 'activado' : 'desactivado'}.`);
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
