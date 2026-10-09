import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { formatoCop, formatoFecha } from '../../shared/utils/formato-co';
import { CARTERA_REPOSITORY } from './data/cartera.provider';
import type { ClienteCartera } from './models/cartera.models';

/** The sales a client still owes, oldest first (the order in which a payment is applied). */
@Component({
  selector: 'app-ventas-pendientes-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent],
  template: `
    <app-dialog [open]="cliente() !== null" [title]="'Ventas pendientes' + (cliente() ? ' · ' + cliente()!.cliente : '')" [wide]="true" (closed)="cerrado.emit()">
      @if (pendientes.error()) {
        <p class="py-4 text-center text-sm text-destructive" role="alert">No se pudieron cargar las ventas pendientes.</p>
      } @else if (pendientes.hasValue()) {
        @if (pendientes.value().length === 0) {
          <p class="py-4 text-center text-sm text-muted-foreground">Este cliente no tiene ventas pendientes.</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <caption class="sr-only">Ventas pendientes, de la más antigua a la más nueva</caption>
              <thead class="text-xs text-muted-foreground">
                <tr>
                  <th scope="col" class="py-1 pe-2 font-medium">Venta</th>
                  <th scope="col" class="px-2 py-1 font-medium">Fecha</th>
                  <th scope="col" class="px-2 py-1 font-medium">Vence</th>
                  <th scope="col" class="px-2 py-1 text-end font-medium">Total</th>
                  <th scope="col" class="px-2 py-1 text-end font-medium">Saldo</th>
                  <th scope="col" class="py-1 ps-2 text-end font-medium">Mora</th>
                </tr>
              </thead>
              <tbody>
                @for (v of pendientes.value(); track v.id_venta) {
                  <tr class="border-t border-border">
                    <td class="py-1.5 pe-2 font-mono text-xs">N.º {{ v.id_venta }}</td>
                    <td class="px-2 py-1.5">{{ fecha(v.fecha_venta) }}</td>
                    <td class="px-2 py-1.5">{{ fecha(v.fecha_vencimiento) }}</td>
                    <td class="px-2 py-1.5 text-end tabular-nums">{{ cop(v.total_venta) }}</td>
                    <td class="px-2 py-1.5 text-end font-medium tabular-nums">{{ cop(v.saldo_pendiente) }}</td>
                    <td class="py-1.5 ps-2 text-end" [class.text-destructive]="v.dias_mora > 0">{{ v.dias_mora > 0 ? v.dias_mora + ' días' : 'Al día' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      } @else {
        <p class="py-4 text-center text-sm text-muted-foreground" aria-busy="true">Cargando…</p>
      }
      <button dialogFooter type="button" class="sila-btn sila-btn-primary" (click)="cerrado.emit()">Cerrar</button>
    </app-dialog>
  `,
})
export class VentasPendientesDialogComponent {
  private readonly repo = inject(CARTERA_REPOSITORY);

  readonly cliente = input<ClienteCartera | null>(null);
  readonly cerrado = output<void>();

  protected readonly cop = formatoCop;
  protected readonly fecha = formatoFecha;
  protected readonly pendientes = rxResource({
    params: () => this.cliente()?.id_cliente,
    stream: ({ params }) => this.repo.ventasPendientes(params),
  });
}
