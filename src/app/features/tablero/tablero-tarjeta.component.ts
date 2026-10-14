import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';

/** A big figure of the Tablero: title, value (a negative one is shown in red by the `clase`) and extra lines. */
@Component({
  selector: 'app-tablero-tarjeta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="sila-card h-full min-w-0 p-4 sm:p-5">
      <div class="flex items-start justify-between gap-2">
        <p class="text-sm text-muted-foreground">{{ titulo() }}</p>
        @if (icono()) {
          <app-icon [name]="icono()!" class="size-4 text-muted-foreground" aria-hidden="true" />
        }
      </div>
      <p class="mt-1 break-words text-2xl font-bold tabular-nums" [class]="clase()" data-testid="valor-tarjeta">{{ valor() }}</p>
      <div class="mt-1 space-y-0.5 text-xs text-muted-foreground"><ng-content /></div>
    </div>
  `,
})
export class TableroTarjetaComponent {
  readonly titulo = input.required<string>();
  readonly valor = input.required<string>();
  readonly icono = input<IconName | null>(null);
  /** Extra classes of the value (e.g. `text-destructive`). */
  readonly clase = input('');
}
