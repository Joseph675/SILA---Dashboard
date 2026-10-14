import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * The filter bar of a list. From `md` up it is always open, exactly as before. On a phone it folds behind a
 * «Filtros» button; the elements marked `data-accion` (e.g. «Nueva recepción») stay visible and full width.
 * The content stays in the DOM while folded, so filters keep their state.
 */
@Component({
  selector: 'app-filtros-plegables',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'block' },
  template: `
    <button type="button" class="sila-btn sila-btn-outline mb-3 w-full justify-between md:hidden" [attr.aria-expanded]="abierto()" (click)="abierto.set(!abierto())">
      <span class="inline-flex items-center gap-2">
        <app-icon name="lucideSlidersHorizontal" class="size-4" aria-hidden="true" />
        Filtros
      </span>
      <app-icon [name]="abierto() ? 'lucideChevronUp' : 'lucideChevronDown'" class="size-4" aria-hidden="true" />
    </button>
    <div [class]="clases() + (abierto() ? ' max-md:[&>[data-accion]]:w-full' : ' max-md:[&>*:not([data-accion])]:hidden max-md:[&>[data-accion]]:w-full')" data-filtros>
      <ng-content />
    </div>
  `,
})
export class FiltrosPlegablesComponent {
  /** Classes of the bar itself (spacing and layout), the ones the page used before. */
  readonly clases = input('mb-4 flex flex-wrap items-end gap-3');
  protected readonly abierto = signal(false);
}
