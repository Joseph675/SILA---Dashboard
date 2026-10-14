import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ClientesTabComponent } from './clientes/clientes-tab.component';
import { ProductosTabComponent } from './productos/productos-tab.component';
import { ProveedoresTabComponent } from './proveedores/proveedores-tab.component';

type Pestana = 'clientes' | 'proveedores' | 'productos';

const PESTANAS: readonly { id: Pestana; etiqueta: string; icono: IconName }[] = [
  { id: 'clientes', etiqueta: 'Clientes', icono: 'lucideUsers' },
  { id: 'proveedores', etiqueta: 'Proveedores', icono: 'lucideTruck' },
  { id: 'productos', etiqueta: 'Productos', icono: 'lucidePackage' },
];

/** Catálogos: one screen, three tabs. The active tab lives in `?pestana=` so it survives reloads and links. */
@Component({
  selector: 'app-catalogos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClientesTabComponent, IconComponent, PageHeaderComponent, ProductosTabComponent, ProveedoresTabComponent],
  template: `
    <app-page-header title="Catálogos" description="Clientes, proveedores y productos del sistema." />

    <div role="tablist" aria-label="Catálogos" class="mb-6 flex w-full snap-x gap-1 overflow-x-auto overscroll-x-contain rounded-lg bg-muted p-1 sm:inline-flex sm:w-auto sm:max-w-full">
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
        @case ('clientes') {
          <app-clientes-tab />
        }
        @case ('proveedores') {
          <app-proveedores-tab />
        }
        @case ('productos') {
          <app-productos-tab />
        }
      }
    </section>
  `,
})
export class CatalogosPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly tabs = viewChildren<ElementRef<HTMLButtonElement>>('tab');

  protected readonly pestanas = PESTANAS;

  private readonly parametro = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('pestana'))));
  protected readonly activa = computed<Pestana>(() => PESTANAS.find((p) => p.id === this.parametro())?.id ?? 'clientes');

  protected seleccionar(id: Pestana): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { pestana: id }, replaceUrl: true });
  }

  /** WAI-ARIA tabs pattern: arrows, Home and End move between tabs. */
  protected navegar(evento: KeyboardEvent, indice: number): void {
    const total = PESTANAS.length;
    const destino: Record<string, number> = {
      ArrowRight: (indice + 1) % total,
      ArrowLeft: (indice - 1 + total) % total,
      Home: 0,
      End: total - 1,
    };
    const siguiente = destino[evento.key];
    if (siguiente === undefined) return;
    evento.preventDefault();
    this.seleccionar(PESTANAS[siguiente].id);
    this.tabs()[siguiente]?.nativeElement.focus();
  }
}
