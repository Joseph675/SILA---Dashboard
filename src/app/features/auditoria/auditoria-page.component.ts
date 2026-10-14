import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { AccesosTabComponent } from './accesos-tab.component';
import { CambiosTabComponent } from './cambios-tab.component';
import { ErroresTabComponent } from './errores-tab.component';

type Pestana = 'accesos' | 'cambios' | 'errores';

const PESTANAS: readonly { id: Pestana; etiqueta: string; icono: IconName }[] = [
  { id: 'accesos', etiqueta: 'Accesos', icono: 'lucideKeyRound' },
  { id: 'cambios', etiqueta: 'Cambios', icono: 'lucideHistory' },
  { id: 'errores', etiqueta: 'Errores', icono: 'lucideTriangleAlert' },
];

/** Auditoría y accesos (ADMIN): read-only logs in three tabs. The tab lives in `?pestana=` so it survives reloads and links. */
@Component({
  selector: 'app-auditoria-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccesosTabComponent, CambiosTabComponent, ErroresTabComponent, IconComponent, PageHeaderComponent],
  template: `
    <app-page-header title="Auditoría y accesos" description="Quién entró, qué cambió y qué falló. Solo lectura: las bitácoras no se modifican ni se borran." />

    <div role="tablist" aria-label="Auditoría" class="mb-6 flex w-full snap-x gap-1 overflow-x-auto overscroll-x-contain rounded-lg bg-muted p-1 sm:inline-flex sm:w-auto sm:max-w-full">
      @for (pestana of pestanas; track pestana.id; let i = $index) {
        <button
          #tab
          type="button"
          role="tab"
          class="sila-tab shrink-0 snap-start focus-visible:outline-2 focus-visible:outline-ring"
          [class.sila-tab-active]="activa() === pestana.id"
          [id]="'tab-' + pestana.id"
          [attr.aria-selected]="activa() === pestana.id"
          [attr.aria-controls]="'panel-' + pestana.id"
          [tabIndex]="activa() === pestana.id ? 0 : -1"
          (click)="seleccionar(pestana.id)"
          (keydown)="navegar($event, i)"
        >
          <app-icon [name]="pestana.icono" class="size-4" aria-hidden="true" />
          {{ pestana.etiqueta }}
        </button>
      }
    </div>

    <section role="tabpanel" [id]="'panel-' + activa()" [attr.aria-labelledby]="'tab-' + activa()">
      @switch (activa()) {
        @case ('accesos') {
          <app-accesos-tab />
        }
        @case ('cambios') {
          <app-cambios-tab />
        }
        @case ('errores') {
          <app-errores-tab />
        }
      }
    </section>
  `,
})
export class AuditoriaPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly tabs = viewChildren<ElementRef<HTMLButtonElement>>('tab');

  protected readonly pestanas = PESTANAS;

  private readonly parametro = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('pestana'))));
  protected readonly activa = computed<Pestana>(() => PESTANAS.find((p) => p.id === this.parametro())?.id ?? 'accesos');

  protected seleccionar(id: Pestana): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { pestana: id }, replaceUrl: true });
  }

  /** WAI-ARIA tabs pattern: arrows, Home and End move between tabs. */
  protected navegar(evento: KeyboardEvent, indice: number): void {
    const total = PESTANAS.length;
    const destino: Record<string, number> = { ArrowRight: (indice + 1) % total, ArrowLeft: (indice - 1 + total) % total, Home: 0, End: total - 1 };
    const siguiente = destino[evento.key];
    if (siguiente === undefined) return;
    evento.preventDefault();
    this.seleccionar(PESTANAS[siguiente].id);
    this.tabs()[siguiente]?.nativeElement.focus();
  }
}
