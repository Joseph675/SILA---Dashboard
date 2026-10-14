import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { claveDocumento, etiquetaTipoComprobante } from './comprobantes.format';
import type { TipoComprobante } from './models/comprobantes.models';

/** «Ver comprobante»: opens the voucher detail on `/comprobantes`. For an ABONO the `id` is the receipt (`id_recibo`). */
@Component({
  selector: 'app-ver-comprobante',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  template: `
    <a class="sila-btn sila-btn-outline sila-btn-sm" routerLink="/comprobantes" [queryParams]="{ ver: clave() }" data-testid="ver-comprobante">
      <app-icon name="lucideFileText" class="size-4" aria-hidden="true" />
      Ver comprobante<span class="sr-only"> ({{ etiqueta() }} N.º {{ id() }})</span>
    </a>
  `,
})
export class VerComprobanteComponent {
  readonly tipo = input.required<TipoComprobante>();
  readonly id = input.required<number>();

  protected readonly clave = computed(() => claveDocumento(this.tipo(), this.id()));
  protected readonly etiqueta = computed(() => etiquetaTipoComprobante(this.tipo()));
}
