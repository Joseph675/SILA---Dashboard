import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type * as lucide from '@ng-icons/lucide';

/**
 * Every Lucide icon shipped by `@ng-icons/lucide` (~1,990 of them), by its
 * `lucide<PascalName>` identifier — e.g. `'lucideHandshake'`. This is a
 * type-only import, so naming an icon costs nothing at runtime; the SVG data
 * itself is fetched by the loader registered in `app.config.ts`.
 */
export type IconName = keyof typeof lucide;

/**
 * Single wrapper around `<ng-icon>` so the app keeps one icon API:
 * `<app-icon name="lucideSearch" class="h-4 w-4" />`.
 *
 * Sizing and colour come from the classes on the host (`h-4 w-4`,
 * `text-muted-foreground`, ...) — the icon stretches to fill the host box.
 * Lucide icons are stroked outlines with `fill="none"`; `filled` paints the
 * glyph in the current colour instead (a starred item, for example).
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  template: `<ng-icon [name]="name()" />`,
  styles: `
    /* Layered so Tailwind display utilities (hidden, block, ...) can still override it. */
    @layer components {
      :host {
        display: inline-flex;
        flex-shrink: 0;
      }
    }
    /* Unlayered on purpose: it has to beat ng-icon's own :host width/height
       so the size classes on the wrapper decide how big the glyph is. */
    :host ng-icon {
      width: 100%;
      height: 100%;
    }
    :host([data-filled]) ::ng-deep svg {
      fill: currentColor;
    }
  `,
  host: { '[attr.data-filled]': 'filled() ? "" : null' },
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly filled = input(false, { transform: booleanAttribute });
}
