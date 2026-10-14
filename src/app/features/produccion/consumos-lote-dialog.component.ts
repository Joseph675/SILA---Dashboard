import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { MontoComponent } from '../../shared/ui/monto/monto.component';
import { formatoCop, formatoNumero } from '../../shared/utils/formato-co';
import { INSUMOS_REPOSITORY } from '../insumos/data/insumos.provider';
import type { Lote } from './models/produccion.models';

/** How the cost of a lote is made up: the milk, and each insumo it consumed (cost frozen when it was produced). */
@Component({
  selector: 'app-consumos-lote-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, MontoComponent],
  template: `
    <app-dialog [open]="lote() !== null" [title]="'Costos del lote ' + (lote()?.codigo_lote ?? '')" [description]="lote()?.producto ?? ''" [wide]="true" (closed)="cerrar.emit()">
      @if (lote(); as l) {
        <dl class="mb-4 grid gap-2 rounded-md bg-muted px-4 py-3 text-sm sm:grid-cols-3" data-testid="costos-lote">
          <div><dt class="text-xs text-muted-foreground">Costo de la leche</dt><dd class="font-semibold"><app-monto [valor]="l.costo_leche" /></dd></div>
          <div><dt class="text-xs text-muted-foreground">Costo de los insumos</dt><dd class="font-semibold"><app-monto [valor]="l.costo_insumos" /></dd></div>
          <div><dt class="text-xs text-muted-foreground">Costo total</dt><dd class="font-semibold"><app-monto [valor]="l.costo_total" [destacado]="true" /></dd></div>
        </dl>
        <h3 class="mb-2 text-sm font-semibold">Insumos consumidos</h3>
        @if (consumos.error()) {
          <p class="text-sm text-destructive" role="alert">No se pudieron cargar los consumos. <button type="button" class="underline" (click)="consumos.reload()">Reintentar</button></p>
        } @else if (consumos.hasValue()) {
          @if (consumos.value().length === 0) {
            <p class="text-sm text-muted-foreground" data-testid="sin-consumos">Este lote no consumió insumos (su producto no tiene receta).</p>
          } @else {
            <ul class="divide-y divide-border" aria-label="Insumos consumidos" data-testid="consumos">
              @for (c of consumos.value(); track c.id_consumo) {
                <li class="min-w-0 space-y-0.5 py-2 text-sm">
                  <p class="flex flex-wrap items-center justify-between gap-2">
                    <span class="font-medium">{{ c.insumo }}</span>
                    <span class="tabular-nums">{{ numero(c.cantidad) }} {{ c.unidad_medida }}</span>
                  </p>
                  <p class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>A {{ cop(c.costo_unitario) }} / {{ c.unidad_medida }}</span>
                    <span class="tabular-nums">{{ cop(c.valor) }}</span>
                  </p>
                </li>
              }
            </ul>
          }
        } @else {
          <p class="text-sm text-muted-foreground" aria-busy="true">Cargando…</p>
        }
      }
      <button dialogFooter type="button" class="sila-btn sila-btn-primary" (click)="cerrar.emit()">Cerrar</button>
    </app-dialog>
  `,
})
export class ConsumosLoteDialogComponent {
  private readonly repo = inject(INSUMOS_REPOSITORY);

  readonly lote = input<Lote | null>(null);
  readonly cerrar = output<void>();

  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;
  protected readonly consumos = rxResource({ params: () => this.lote()?.id_lote, stream: ({ params }) => this.repo.consumosDeLote(params) });
}
