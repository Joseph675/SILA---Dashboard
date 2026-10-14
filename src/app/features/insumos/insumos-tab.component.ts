import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiErrorService } from '../../core/api/api-error';
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
import { formatoCop, formatoNumero } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { textoConEspera } from '../../shared/utils/texto-debounce';
import { INSUMOS_REPOSITORY } from './data/insumos.provider';
import { InsumoDialogComponent } from './insumo-dialog.component';
import type { Insumo } from './models/insumos.models';

@Component({
  selector: 'app-insumos-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, DataTableCellDirective, FiltrosPlegablesComponent, HasRoleDirective, IconComponent, InsumoDialogComponent, ServerDataTableComponent, StatusChipComponent],
  template: `
    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Insumos activos</p>
        <p class="mt-1 text-2xl font-bold tabular-nums">{{ resumen.hasValue() ? numero(resumen.value().total_insumos) : '—' }}</p>
      </div>
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Bajo el mínimo</p>
        <p class="mt-1 text-2xl font-bold tabular-nums" [class.text-destructive]="resumen.hasValue() && resumen.value().bajo_minimo > 0" data-testid="bajo-minimo">{{ resumen.hasValue() ? numero(resumen.value().bajo_minimo) : '—' }}</p>
      </div>
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Valor del inventario de insumos</p>
        <p class="mt-1 text-2xl font-bold tabular-nums">{{ resumen.hasValue() ? cop(resumen.value().valor_total) : '—' }}</p>
        <p class="mt-0.5 text-xs text-muted-foreground">A costo promedio.</p>
      </div>
    </div>
    @if (resumen.error()) {
      <p class="-mt-3 mb-4 text-sm text-destructive" role="alert">No se pudo cargar el resumen. <button type="button" class="underline" (click)="resumen.reload()">Reintentar</button></p>
    }

    <app-filtros-plegables clases="mb-4 flex flex-wrap items-end gap-3">
      <div class="w-full sm:w-64">
        <label for="insumos-texto" class="mb-1 block text-xs font-medium text-muted-foreground">Código o nombre</label>
        <input id="insumos-texto" type="search" class="sila-input" placeholder="Buscar…" maxlength="100" [value]="texto.crudo()" (input)="texto.crudo.set($any($event.target).value)" />
      </div>
      <div>
        <label for="insumos-activo" class="mb-1 block text-xs font-medium text-muted-foreground">Estado</label>
        <select id="insumos-activo" class="sila-select w-40" (change)="activo.set($any($event.target).value)">
          <option value="ACTIVOS" [selected]="activo() === 'ACTIVOS'">Activos</option>
          <option value="INACTIVOS" [selected]="activo() === 'INACTIVOS'">Inactivos</option>
          <option value="TODOS" [selected]="activo() === 'TODOS'">Todos</option>
        </select>
      </div>
      <label class="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" class="size-4" [checked]="soloBajoMinimo()" (change)="soloBajoMinimo.set($any($event.target).checked)" />
        Solo bajo el mínimo
      </label>
      <button *hasRole="'ADMIN'" type="button" data-accion class="sila-btn sila-btn-primary ms-auto" (click)="abrirNuevo()">
        <app-icon name="lucidePlus" class="size-4" aria-hidden="true" />
        Nuevo insumo
      </button>
    </app-filtros-plegables>

    <app-server-data-table
      titulo="Insumos"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="insumoId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="listado.sort()"
      vacioTitulo="No hay insumos que coincidan"
      vacioAyuda="Cambia los filtros o crea un insumo nuevo."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (sortChange)="listado.sort.set($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="codigo" [cellRows]="listado.datos()?.items" let-i><span class="font-mono text-xs">{{ i.codigo }}</span></ng-template>
      <ng-template appDataTableCell="stock_actual" [cellRows]="listado.datos()?.items" let-i>
        <span class="inline-flex flex-wrap items-center justify-end gap-2">
          <span class="whitespace-nowrap font-medium tabular-nums" [class.text-destructive]="i.bajo_minimo">{{ numero(i.stock_actual) }} {{ i.unidad_medida }}</span>
          @if (i.bajo_minimo) {
            <app-status-chip texto="Bajo el mínimo" tono="peligro" />
          }
        </span>
      </ng-template>
      <ng-template appDataTableCell="stock_minimo" [cellRows]="listado.datos()?.items" let-i><span class="tabular-nums">{{ numero(i.stock_minimo) }} {{ i.unidad_medida }}</span></ng-template>
      <ng-template appDataTableCell="costo_promedio" [cellRows]="listado.datos()?.items" let-i><span class="tabular-nums">{{ cop(i.costo_promedio) }}</span></ng-template>
      <ng-template appDataTableCell="valor_inventario" [cellRows]="listado.datos()?.items" let-i><span class="tabular-nums">{{ cop(i.valor_inventario) }}</span></ng-template>
      <ng-template appDataTableCell="activo" [cellRows]="listado.datos()?.items" let-i>
        <app-status-chip [texto]="i.activo ? 'Activo' : 'Inactivo'" [tono]="i.activo ? 'exito' : 'neutro'" />
      </ng-template>
      <ng-template appDataTableCell="acciones" [cellRows]="listado.datos()?.items" let-i>
        <div *hasRole="'ADMIN'" class="flex justify-end gap-1">
          <button type="button" class="sila-btn sila-btn-ghost sila-btn-sm" (click)="editando.set(i)">
            <app-icon name="lucidePencil" class="size-3.5" aria-hidden="true" />
            Editar<span class="sr-only"> {{ i.nombre }}</span>
          </button>
          <button type="button" class="sila-btn sila-btn-ghost sila-btn-sm" (click)="cambiandoEstado.set(i)">
            <app-icon name="lucidePower" class="size-3.5" aria-hidden="true" />
            {{ i.activo ? 'Desactivar' : 'Activar' }}<span class="sr-only"> {{ i.nombre }}</span>
          </button>
        </div>
      </ng-template>
    </app-server-data-table>

    <app-insumo-dialog [abierto]="dialogo() || editando() !== null" [insumo]="editando()" (guardado)="alGuardar($event)" (cerrar)="dialogo.set(false); editando.set(null)" />

    <app-confirm-dialog
      [open]="cambiandoEstado() !== null"
      [titulo]="cambiandoEstado()?.activo ? 'Desactivar insumo' : 'Activar insumo'"
      [mensaje]="cambiandoEstado()?.activo ? '«' + cambiandoEstado()!.nombre + '» dejará de ofrecerse en compras, ajustes y recetas nuevas. No se puede desactivar si la receta de un producto activo lo usa.' : 'Volverá a ofrecerse en compras, ajustes y recetas.'"
      [textoConfirmar]="cambiandoEstado()?.activo ? 'Desactivar' : 'Activar'"
      [peligro]="!!cambiandoEstado()?.activo"
      [ocupado]="procesando()"
      (confirmar)="confirmarEstado()"
      (cancelar)="cambiandoEstado.set(null)"
    />
  `,
})
export class InsumosTabComponent {
  private readonly repo = inject(INSUMOS_REPOSITORY);
  private readonly toast = inject(ToastService);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;

  protected readonly resumen = rxResource({ stream: () => this.repo.resumen() });

  protected readonly texto = textoConEspera();
  protected readonly activo = signal<'ACTIVOS' | 'INACTIVOS' | 'TODOS'>('ACTIVOS');
  protected readonly soloBajoMinimo = signal(false);
  protected readonly dialogo = signal(false);
  protected readonly editando = signal<Insumo | null>(null);
  protected readonly cambiandoEstado = signal<Insumo | null>(null);
  protected readonly procesando = signal(false);

  protected readonly listado = crearListado({
    filtros: () => ({
      texto: this.texto.valor() || undefined,
      activo: this.activo() === 'TODOS' ? undefined : this.activo() === 'ACTIVOS',
      bajo_minimo: this.soloBajoMinimo() || undefined,
    }),
    cargar: (query) => this.repo.listar(query),
    sort: 'nombre,asc',
  });

  // Sort fields of the contract: codigo, nombre, stock_actual, costo_promedio, valor_inventario.
  protected readonly columnas: DataTableColumn<Insumo>[] = [
    { key: 'codigo', label: 'Código', value: (i) => i.codigo },
    { key: 'nombre', label: 'Nombre', rol: 'titulo', value: (i) => i.nombre },
    { key: 'unidad_medida', label: 'Unidad', sortable: false, ocultarEnMovil: true, value: (i) => i.unidad_medida },
    { key: 'stock_actual', label: 'Stock', align: 'end', value: (i) => i.stock_actual },
    { key: 'stock_minimo', label: 'Mínimo', align: 'end', sortable: false, value: (i) => i.stock_minimo },
    { key: 'costo_promedio', label: 'Costo promedio', align: 'end', value: (i) => i.costo_promedio },
    { key: 'valor_inventario', label: 'Valor', align: 'end', value: (i) => i.valor_inventario },
    { key: 'activo', label: 'Estado', sortable: false, value: (i) => (i.activo ? 'Activo' : 'Inactivo') },
    { key: 'acciones', label: 'Acciones', sortable: false, align: 'end', value: () => '' },
  ];
  protected readonly insumoId = (i: Insumo) => i.id_insumo;

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.dialogo.set(true);
  }

  protected alGuardar(insumo: Insumo): void {
    const nuevo = !this.editando();
    this.dialogo.set(false);
    this.editando.set(null);
    this.listado.recargar();
    this.resumen.reload();
    this.toast.exito(`Insumo «${insumo.nombre}» ${nuevo ? 'creado' : 'actualizado'}.`);
  }

  protected confirmarEstado(): void {
    const i = this.cambiandoEstado();
    if (!i || this.procesando()) return;
    this.procesando.set(true);
    this.repo
      .cambiarEstado(i.id_insumo, !i.activo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.procesando.set(false);
          this.cambiandoEstado.set(null);
          this.listado.recargar();
          this.resumen.reload();
          this.toast.exito(`Insumo «${r.nombre}» ${r.activo ? 'activado' : 'desactivado'}.`);
        },
        error: (fallo: unknown) => {
          this.procesando.set(false);
          this.cambiandoEstado.set(null);
          // 409 / 20006: it is in the recipe of an active product; the server's message names it.
          this.toast.error(mensajeDeFallo(this.errores, fallo, [20006, 20007]));
        },
      });
  }
}
