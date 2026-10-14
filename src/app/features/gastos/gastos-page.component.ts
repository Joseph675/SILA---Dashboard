import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { Pestana, PestanasComponent } from '../../shared/ui/pestanas/pestanas.component';
import { GastosTabComponent } from './gastos-tab.component';
import { PorCategoriaTabComponent } from './por-categoria-tab.component';

const PESTANAS: readonly Pestana[] = [
  { id: 'gastos', etiqueta: 'Gastos', icono: 'lucideBanknote' },
  { id: 'categorias', etiqueta: 'Por categoría', icono: 'lucideChartColumn' },
];

/** Gastos operativos: se registran, no se editan ni se borran (un administrador los anula). La pestaña vive en `?pestana=`. */
@Component({
  selector: 'app-gastos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GastosTabComponent, PageHeaderComponent, PestanasComponent, PorCategoriaTabComponent],
  template: `
    <app-page-header title="Gastos" description="Los gastos de la operación por quincena. No se editan ni se borran: si te equivocas, un administrador anula el gasto y registras el correcto." />

    <app-pestanas [pestanas]="pestanas" [activa]="activa()" etiqueta="Gastos" (seleccionada)="seleccionar($event)" />

    <section role="tabpanel" [id]="'panel-' + activa()" [attr.aria-labelledby]="'tab-' + activa()">
      @switch (activa()) {
        @case ('gastos') {
          <app-gastos-tab />
        }
        @case ('categorias') {
          <app-por-categoria-tab />
        }
      }
    </section>
  `,
})
export class GastosPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly pestanas = PESTANAS;
  private readonly parametro = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('pestana'))));
  protected readonly activa = computed(() => PESTANAS.find((p) => p.id === this.parametro())?.id ?? 'gastos');

  protected seleccionar(id: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { pestana: id }, replaceUrl: true });
  }
}
