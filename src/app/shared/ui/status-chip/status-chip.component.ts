import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

/**
 * exito: PAGADA, ACEPTADA, APROBADO, AL_DIA, ACTIVO
 * info / alerta: PENDIENTE, EN_PROCESO, VIGENTE
 * peligro: ANULADA, RECHAZADA, EN_MORA, EXCEDIDO, VENCIDO
 * castigado: CASTIGADA
 * neutro: anything informative (INACTIVO, a type label...)
 */
export type ChipTono = 'exito' | 'info' | 'alerta' | 'peligro' | 'castigado' | 'neutro';

const ESTILOS: Record<ChipTono, { clase: string; icono: IconName }> = {
  exito: { clase: 'bg-success/15 [&_app-icon]:text-success', icono: 'lucideCircleCheck' },
  info: { clase: 'bg-primary/15 [&_app-icon]:text-primary', icono: 'lucideInfo' },
  alerta: { clase: 'bg-warning/20 [&_app-icon]:text-warning', icono: 'lucideCircleAlert' },
  peligro: { clase: 'bg-destructive/15 [&_app-icon]:text-destructive', icono: 'lucideCircleX' },
  castigado: { clase: 'bg-foreground/80 text-background', icono: 'lucideBan' },
  neutro: { clase: 'bg-secondary', icono: 'lucideMinusCircle' },
};

/**
 * State chip: always icon + text, so meaning never depends on color alone.
 * Text stays in the foreground color to keep AA contrast in both themes;
 * only the tint and the icon carry the state color.
 */
@Component({
  selector: 'app-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <span class="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium" [class]="estilo().clase">
      <app-icon [name]="estilo().icono" class="size-3.5" aria-hidden="true" />
      {{ texto() }}
    </span>
  `,
})
export class StatusChipComponent {
  readonly texto = input.required<string>();
  readonly tono = input<ChipTono>('neutro');

  protected readonly estilo = computed(() => ESTILOS[this.tono()]);
}
