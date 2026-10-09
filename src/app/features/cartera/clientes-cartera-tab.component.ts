import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoCop, formatoNumero } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { textoConEspera } from '../../shared/utils/texto-debounce';
import { AbonoDialogComponent } from './abono-dialog.component';
import { CastigoDialogComponent } from './castigo-dialog.component';
import { ESTADOS_CREDITO, chipEstadoCredito } from './cartera.format';
import { CARTERA_REPOSITORY } from './data/cartera.provider';
import type { CastigoResultado, ClienteCartera, EstadoCredito } from './models/cartera.models';
import { VentasPendientesDialogComponent } from './ventas-pendientes-dialog.component';

@Component({
  selector: 'app-clientes-cartera-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AbonoDialogComponent, CastigoDialogComponent, DataTableCellDirective, HasRoleDirective, ServerDataTableComponent, StatusChipComponent, VentasPendientesDialogComponent],
  template: `
    <div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Total por cobrar</p>
        <p class="mt-1 text-2xl font-bold tabular-nums">{{ resumen.hasValue() ? cop(resumen.value().total_cartera) : '—' }}</p>
      </div>
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Clientes con deuda</p>
        <p class="mt-1 text-2xl font-bold tabular-nums">{{ resumen.hasValue() ? numero(resumen.value().clientes_con_deuda) : '—' }}</p>
      </div>
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Clientes en mora</p>
        <p class="mt-1 text-2xl font-bold tabular-nums" [class.text-destructive]="resumen.hasValue() && resumen.value().clientes_en_mora > 0">{{ resumen.hasValue() ? numero(resumen.value().clientes_en_mora) : '—' }}</p>
      </div>
      <div class="sila-card p-4">
        <p class="text-sm text-muted-foreground">Cartera vencida</p>
        <p class="mt-1 text-2xl font-bold tabular-nums" [class.text-destructive]="resumen.hasValue() && resumen.value().cartera_vencida > 0">{{ resumen.hasValue() ? cop(resumen.value().cartera_vencida) : '—' }}</p>
      </div>
    </div>
    @if (resumen.error()) {
      <p class="-mt-3 mb-4 text-sm text-destructive" role="alert">No se pudo cargar el resumen. <button type="button" class="underline" (click)="resumen.reload()">Reintentar</button></p>
    }

    <div class="mb-4 flex flex-wrap items-end gap-3">
      <div class="w-full sm:w-64">
        <label for="cartera-texto" class="mb-1 block text-xs font-medium text-muted-foreground">Cliente</label>
        <input id="cartera-texto" type="search" class="sila-input" placeholder="Buscar por nombre…" maxlength="100" [value]="texto.crudo()" (input)="texto.crudo.set($any($event.target).value)" />
      </div>
      <div>
        <label for="cartera-estado" class="mb-1 block text-xs font-medium text-muted-foreground">Estado de crédito</label>
        <select id="cartera-estado" class="sila-select w-40" (change)="estado.set($any($event.target).value)">
          <option value="" [selected]="estado() === ''">Todos</option>
          @for (e of estados; track e) {
            <option [value]="e" [selected]="e === estado()">{{ chip(e).texto }}</option>
          }
        </select>
      </div>
      <div>
        <label for="cartera-mora" class="mb-1 block text-xs font-medium text-muted-foreground">Mora mínima (días)</label>
        <input id="cartera-mora" type="number" min="0" step="1" class="sila-input w-32" [value]="mora()" (input)="mora.set($any($event.target).value)" />
      </div>
      <label class="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" class="size-4" [checked]="soloConDeuda()" (change)="soloConDeuda.set($any($event.target).checked)" />
        Solo con deuda
      </label>
    </div>

    <app-server-data-table
      titulo="Clientes con deuda"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="clienteId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="listado.sort()"
      vacioTitulo="No hay clientes que coincidan"
      vacioAyuda="Cambia los filtros o quita «Solo con deuda»."
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (sortChange)="listado.sort.set($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="limite_credito" [cellRows]="listado.datos()?.items" let-c><span class="tabular-nums">{{ cop(c.limite_credito) }}</span></ng-template>
      <ng-template appDataTableCell="saldo_deudor" [cellRows]="listado.datos()?.items" let-c><span class="font-medium tabular-nums">{{ cop(c.saldo_deudor) }}</span></ng-template>
      <ng-template appDataTableCell="cupo_disponible" [cellRows]="listado.datos()?.items" let-c><span class="tabular-nums">{{ cop(c.cupo_disponible) }}</span></ng-template>
      <ng-template appDataTableCell="dias_mora" [cellRows]="listado.datos()?.items" let-c>
        <span class="tabular-nums" [class.text-destructive]="c.dias_mora > 0">{{ c.dias_mora > 0 ? c.dias_mora + ' días' : '—' }}</span>
      </ng-template>
      <ng-template appDataTableCell="estado_credito" [cellRows]="listado.datos()?.items" let-c>
        <app-status-chip [texto]="chip(c.estado_credito).texto" [tono]="chip(c.estado_credito).tono" />
      </ng-template>
      <ng-template appDataTableCell="acciones" [cellRows]="listado.datos()?.items" let-c>
        <div class="flex flex-wrap gap-1.5">
          <button type="button" class="sila-btn sila-btn-primary sila-btn-sm" [disabled]="c.saldo_deudor <= 0" (click)="abonando.set(c)">Registrar abono<span class="sr-only"> de {{ c.cliente }}</span></button>
          <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="viendo.set(c)">Ver ventas<span class="sr-only"> de {{ c.cliente }}</span></button>
          <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="verAbonos.emit(c)">Historial de abonos<span class="sr-only"> de {{ c.cliente }}</span></button>
          <button *hasRole="'ADMIN'" type="button" class="sila-btn sila-btn-outline sila-btn-sm text-destructive" [disabled]="c.saldo_deudor <= 0" (click)="castigando.set(c)">Castigar cartera<span class="sr-only"> de {{ c.cliente }}</span></button>
        </div>
      </ng-template>
    </app-server-data-table>

    <app-abono-dialog [cliente]="abonando()" (registrado)="recargar()" (cerrado)="abonando.set(null)" />
    <app-ventas-pendientes-dialog [cliente]="viendo()" (cerrado)="viendo.set(null)" />
    <app-castigo-dialog [cliente]="castigando()" (castigado)="alCastigar($event)" (cerrado)="castigando.set(null)" />
  `,
})
export class ClientesCarteraTabComponent {
  private readonly repo = inject(CARTERA_REPOSITORY);
  private readonly toast = inject(ToastService);

  /** The person wants the payments of this client (the page switches tabs). */
  readonly verAbonos = output<ClienteCartera>();

  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;
  protected readonly chip = chipEstadoCredito;
  protected readonly estados = ESTADOS_CREDITO;

  protected readonly resumen = rxResource({ stream: () => this.repo.resumen() });

  protected readonly texto = textoConEspera();
  protected readonly estado = signal<'' | EstadoCredito>('');
  protected readonly mora = signal('');
  protected readonly soloConDeuda = signal(true);

  protected readonly abonando = signal<ClienteCartera | null>(null);
  protected readonly viendo = signal<ClienteCartera | null>(null);
  protected readonly castigando = signal<ClienteCartera | null>(null);

  protected readonly listado = crearListado({
    filtros: () => ({
      texto: this.texto.valor() || undefined,
      estado_credito: this.estado() || undefined,
      solo_con_deuda: this.soloConDeuda(),
      mora_minima: this.mora().trim() !== '' && Number(this.mora()) >= 0 ? Number(this.mora()) : undefined,
    }),
    cargar: (query) => this.repo.clientes(query),
    sort: 'saldo_deudor,desc',
  });

  protected readonly columnas: DataTableColumn<ClienteCartera>[] = [
    { key: 'cliente', label: 'Cliente', value: (c) => c.cliente },
    { key: 'telefono', label: 'Teléfono', sortable: false, value: (c) => c.telefono ?? '—' },
    { key: 'limite_credito', label: 'Límite', align: 'end', value: (c) => c.limite_credito },
    { key: 'saldo_deudor', label: 'Deuda', align: 'end', value: (c) => c.saldo_deudor },
    { key: 'cupo_disponible', label: 'Cupo disponible', align: 'end', value: (c) => c.cupo_disponible },
    { key: 'dias_mora', label: 'Mora', align: 'end', value: (c) => c.dias_mora },
    { key: 'estado_credito', label: 'Estado', value: (c) => c.estado_credito },
    { key: 'acciones', label: 'Acciones', sortable: false, value: () => '' },
  ];
  protected readonly clienteId = (c: ClienteCartera) => c.id_cliente;

  protected recargar(): void {
    this.listado.recargar();
    this.resumen.reload();
  }

  protected alCastigar(resultado: CastigoResultado): void {
    const c = this.castigando();
    this.castigando.set(null);
    this.recargar();
    this.toast.exito(`Cartera castigada${c ? ` de ${c.cliente}` : ''}: ${formatoCop(resultado.monto_castigado)}.`);
  }
}
