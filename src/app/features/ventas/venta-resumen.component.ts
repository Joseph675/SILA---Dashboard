import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { EsMovilService } from '../../shared/services/es-movil.service';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { formatoCop, formatoFecha, formatoFechaHora, formatoNumero } from '../../shared/utils/formato-co';
import type { VentaDetalle } from './models/ventas.models';
import { chipEstadoPago, etiquetaMetodo, etiquetaTipoVenta } from './ventas.format';

/**
 * A sale exactly as the SERVER has it: header, lines, payments and (credit) due date and balance.
 * Printed as the ticket (the wrapper carries `.zona-impresion-ticket`).
 */
@Component({
  selector: 'app-venta-resumen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatusChipComponent],
  template: `
    <div class="zona-impresion-ticket space-y-4 text-sm">
      <div class="hidden print:block">
        <p class="text-base font-bold">Llanolat · SILA</p>
      </div>
      @let v = detalle().venta;
      <dl class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <div>
          <dt class="text-xs text-muted-foreground">Venta N.º</dt>
          <dd class="font-semibold" data-testid="numero-venta">{{ v.id_venta }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Fecha</dt>
          <!-- fecha_venta is already Colombia time, no zone: shown as it comes -->
          <dd>{{ fechaVenta() }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Cliente</dt>
          <dd>{{ v.cliente }} · {{ v.numero_documento }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Tipo y estado</dt>
          <dd class="flex flex-wrap items-center gap-2">
            {{ tipo(v.tipo_venta) }}
            <app-status-chip [texto]="chip().texto" [tono]="chip().tono" />
          </dd>
        </div>
        @if (v.fecha_vencimiento) {
          <div>
            <dt class="text-xs text-muted-foreground">Vence</dt>
            <dd>{{ fecha(v.fecha_vencimiento) }}</dd>
          </div>
        }
        @if (v.tipo_venta === 'CREDITO') {
          <div>
            <dt class="text-xs text-muted-foreground">Saldo pendiente</dt>
            <dd class="font-semibold">{{ cop(v.saldo_pendiente) }}</dd>
          </div>
        }
        <div class="text-xs text-muted-foreground sm:col-span-2">Registrada por {{ v.usuario_registro }} · {{ fechaHora(v.fecha_registro) }}</div>
      </dl>

      @if (v.estado_pago === 'ANULADA' && v.motivo_anulacion) {
        <p class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2" role="status"><strong>Venta anulada.</strong> Motivo: {{ v.motivo_anulacion }}</p>
      }

      @if (movil()) {
        <ul class="divide-y divide-border" aria-label="Líneas de la venta">
          @for (l of detalle().lineas; track l.id_detalle) {
            <li class="min-w-0 space-y-1 py-2">
              <p class="break-words font-medium">
                {{ l.producto }}
                @if (l.precio_pactado) {
                  <span class="ms-1 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-medium">Precio pactado</span>
                }
              </p>
              <p class="text-xs text-muted-foreground">
                {{ numero(l.cantidad) }} {{ l.unidad_medida }} × {{ cop(l.precio_unitario) }}
                @if (l.precio_pactado) { · Lista: {{ cop(l.precio_lista) }} }
                · IVA {{ cop(l.valor_iva) }} ({{ numero(l.tarifa_iva) }} %)
              </p>
              <p class="text-end font-medium tabular-nums">{{ cop(l.total_linea) }}</p>
            </li>
          }
        </ul>
      } @else {
      <div class="relative overflow-x-auto">
        <table class="w-full text-left">
          <caption class="sr-only">Líneas de la venta</caption>
          <thead class="text-xs text-muted-foreground">
            <tr>
              <th scope="col" class="py-1 pe-2 font-medium">Producto</th>
              <th scope="col" class="px-2 py-1 text-end font-medium">Cant.</th>
              <th scope="col" class="px-2 py-1 text-end font-medium">Precio</th>
              <th scope="col" class="px-2 py-1 text-end font-medium">IVA</th>
              <th scope="col" class="py-1 ps-2 text-end font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            @for (l of detalle().lineas; track l.id_detalle) {
              <tr class="border-t border-border align-top">
                <td class="py-1.5 pe-2">
                  {{ l.producto }}
                  @if (l.precio_pactado) {
                    <span class="ms-1 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-medium" [attr.title]="'Precio de lista: ' + cop(l.precio_lista)">Precio pactado</span>
                    <span class="block text-xs text-muted-foreground">Lista: {{ cop(l.precio_lista) }}</span>
                  }
                </td>
                <td class="px-2 py-1.5 text-end tabular-nums">{{ numero(l.cantidad) }} {{ l.unidad_medida }}</td>
                <td class="px-2 py-1.5 text-end tabular-nums">{{ cop(l.precio_unitario) }}</td>
                <td class="px-2 py-1.5 text-end tabular-nums">{{ cop(l.valor_iva) }} <span class="text-xs text-muted-foreground">({{ numero(l.tarifa_iva) }} %)</span></td>
                <td class="py-1.5 ps-2 text-end tabular-nums">{{ cop(l.total_linea) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      }

      <dl class="ms-auto max-w-xs space-y-1">
        <div class="flex justify-between"><dt>Subtotal</dt><dd class="tabular-nums">{{ cop(v.subtotal_venta) }}</dd></div>
        <div class="flex justify-between"><dt>IVA</dt><dd class="tabular-nums">{{ cop(v.total_iva) }}</dd></div>
        <div class="flex justify-between border-t border-border pt-1 text-base font-bold"><dt>Total</dt><dd class="tabular-nums" data-testid="total-servidor">{{ cop(v.total_venta) }}</dd></div>
      </dl>

      @if (detalle().pagos.length > 0) {
        <div>
          <h3 class="mb-1 text-xs font-medium text-muted-foreground">Pagos</h3>
          <ul class="space-y-0.5">
            @for (p of detalle().pagos; track p.id_pago) {
              <li class="flex justify-between gap-4">
                <span>{{ metodo(p.metodo_pago) }}@if (p.referencia_pago) { <span class="text-muted-foreground"> · Ref. {{ p.referencia_pago }}</span> }</span>
                <span class="tabular-nums">{{ cop(p.monto) }}</span>
              </li>
            }
          </ul>
        </div>
      }
    </div>
  `,
})
export class VentaResumenComponent {
  readonly detalle = input.required<VentaDetalle>();
  protected readonly movil = inject(EsMovilService).movil;

  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;
  protected readonly fecha = formatoFecha;
  protected readonly fechaHora = formatoFechaHora;
  protected readonly tipo = etiquetaTipoVenta;
  protected readonly metodo = etiquetaMetodo;
  protected readonly chip = computed(() => chipEstadoPago(this.detalle().venta.estado_pago));

  /** `2026-10-09T15:42:10` (Colombia) -> `09/10/2026 15:42`, without converting any zone. */
  protected readonly fechaVenta = computed(() => {
    const iso = this.detalle().venta.fecha_venta;
    return `${formatoFecha(iso)} ${iso.slice(11, 16)}`;
  });
}
