import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';

export interface EnlaceBloque {
  etiqueta: string;
  ruta: string;
  queryParams?: Record<string, string>;
}

/** A block of figures (Cartera, Inventario, Lecheros) with a link to its module. The rows are projected. */
@Component({
  selector: 'app-tablero-bloque',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  template: `
    <section class="sila-card flex h-full min-w-0 flex-col p-4 sm:p-5" [attr.aria-label]="titulo()">
      <div class="mb-3 flex items-center gap-2">
        <app-icon [name]="icono()" class="size-4 text-muted-foreground" aria-hidden="true" />
        <h3 class="text-sm font-semibold">{{ titulo() }}</h3>
      </div>
      <dl class="flex-1 space-y-2 text-sm"><ng-content /></dl>
      <div class="mt-4 flex flex-wrap gap-x-4 gap-y-1">
        @for (e of enlaces(); track e.ruta + e.etiqueta) {
          <a [routerLink]="e.ruta" [queryParams]="e.queryParams" class="inline-flex min-h-8 items-center max-lg:min-h-11 gap-1 text-xs font-medium text-primary hover:underline" data-testid="enlace-bloque">
            {{ e.etiqueta }}
            <app-icon name="lucideArrowUpRight" class="size-3.5" aria-hidden="true" />
          </a>
        }
      </div>
    </section>
  `,
})
export class TableroBloqueComponent {
  readonly titulo = input.required<string>();
  readonly icono = input.required<IconName>();
  readonly enlaces = input<readonly EnlaceBloque[]>([]);
}
