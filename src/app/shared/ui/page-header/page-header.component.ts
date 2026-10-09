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
      <div class="space-y-1">
        <nav class="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <a routerLink="/dashboard" class="transition-colors hover:text-foreground">Dashboard</a>
          <app-icon name="lucideChevronRight" class="size-3.5" />
          <span class="font-medium text-foreground">{{ title() }}</span>
        </nav>
        <h1 class="text-2xl font-bold tracking-tight">{{ title() }}</h1>
        <p class="text-sm text-muted-foreground">{{ description() }}</p>
      </div>
      <ng-content />
    </div>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input('');
}
