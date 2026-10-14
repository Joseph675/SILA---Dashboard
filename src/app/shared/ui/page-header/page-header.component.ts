import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

/**
 * Breadcrumb + title + description block shared by every inner page.
 * Projected content is placed on the end side (the page's primary action).
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  template: `
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0 space-y-1">
        <nav class="flex items-center gap-1.5 text-sm text-muted-foreground max-lg:-my-2" aria-label="Breadcrumb">
          <a routerLink="/tablero" class="transition-colors hover:text-foreground max-lg:inline-flex max-lg:min-h-11 max-lg:items-center">Dashboard</a>
          <app-icon name="lucideChevronRight" class="size-3.5" />
          <span class="font-medium text-foreground">{{ title() }}</span>
        </nav>
        <h1 class="text-xl font-bold tracking-tight sm:text-2xl">{{ title() }}</h1>
        <p class="text-sm text-muted-foreground">{{ description() }}</p>
      </div>
      <!-- The page's main action: full width on phones, natural width from sm up. -->
      <div class="flex flex-col gap-2 empty:hidden max-sm:[&>*]:w-full sm:flex-row">
        <ng-content />
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input('');
}
