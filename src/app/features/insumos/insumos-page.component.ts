import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { Pestana, PestanasComponent } from '../../shared/ui/pestanas/pestanas.component';
import { AjustesInsumoTabComponent } from './ajustes-insumo-tab.component';
import { ComprasTabComponent } from './compras-tab.component';
import { InsumosTabComponent } from './insumos-tab.component';

const PESTANAS: readonly Pestana[] = [
  { id: 'insumos', etiqueta: 'Insumos', icono: 'lucidePackage' },
  { id: 'compras', etiqueta: 'Compras', icono: 'lucideShoppingCart' },
  { id: 'ajustes', etiqueta: 'Ajustes', icono: 'lucideSlidersHorizontal' },
];

/** Insumos (azúcar, envases…): stock y costo promedio, compras y ajustes. La pestaña vive en `?pestana=`. */
@Component({
  selector: 'app-insumos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AjustesInsumoTabComponent, ComprasTabComponent, InsumosTabComponent, PageHeaderComponent, PestanasComponent],
  template: `
    <app-page-header title="Insumos" description="Lo que se compra para fabricar (azúcar, envases…): su stock, su costo promedio y lo que se gasta en cada lote." />

    <app-pestanas [pestanas]="pestanas" [activa]="activa()" etiqueta="Insumos" (seleccionada)="seleccionar($event)" />

    <section role="tabpanel" [id]="'panel-' + activa()" [attr.aria-labelledby]="'tab-' + activa()">
      @switch (activa()) {
        @case ('insumos') {
          <app-insumos-tab />
        }
        @case ('compras') {
          <app-compras-tab />
        }
        @case ('ajustes') {
          <app-ajustes-insumo-tab />
        }
      }
    </section>
  `,
})
export class InsumosPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly pestanas = PESTANAS;
  private readonly parametro = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('pestana'))));
  protected readonly activa = computed(() => PESTANAS.find((p) => p.id === this.parametro())?.id ?? 'insumos');

  protected seleccionar(id: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { pestana: id }, replaceUrl: true });
  }
}
