import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/** A small «?» that explains a concept: tooltip on hover or keyboard focus (title) and read by screen readers. */
@Component({
  selector: 'app-ayuda',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <span class="inline-flex cursor-help align-middle text-muted-foreground" tabindex="0" role="img" [attr.title]="texto()" [attr.aria-label]="'Ayuda: ' + texto()">
      <app-icon name="lucideCircleHelp" class="size-3.5" aria-hidden="true" />
    </span>
  `,
})
export class AyudaComponent {
  readonly texto = input.required<string>();
}
