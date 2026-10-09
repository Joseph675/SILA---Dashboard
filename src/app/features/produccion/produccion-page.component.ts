import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { Pestana, PestanasComponent } from '../../shared/ui/pestanas/pestanas.component';
import { AjustesTabComponent } from './ajustes-tab.component';
import { LotesTabComponent } from './lotes-tab.component';

const PESTANAS: readonly Pestana[] = [
  { id: 'lotes', etiqueta: 'Lotes', icono: 'lucideFactory' },
  { id: 'ajustes', etiqueta: 'Ajustes', icono: 'lucideSlidersHorizontal' },
];

/** Producción: lotes made from milk and manual stock adjustments. The tab lives in `?pestana=`. */
@Component({
  selector: 'app-produccion-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AjustesTabComponent, LotesTabComponent, PageHeaderComponent, PestanasComponent],
  template: `
    <app-page-header title="Producción" description="Lotes fabricados con leche (suman al stock del producto) y ajustes manuales de inventario." />

    <app-pestanas [pestanas]="pestanas" [activa]="activa()" etiqueta="Producción" (seleccionada)="seleccionar($event)" />

    <section role="tabpanel" [id]="'panel-' + activa()" [attr.aria-labelledby]="'tab-' + activa()">
      @switch (activa()) {
        @case ('lotes') {
          <app-lotes-tab />
        }
        @case ('ajustes') {
          <app-ajustes-tab />
        }
      }
    </section>
  `,
})
export class ProduccionPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly pestanas = PESTANAS;
  private readonly parametro = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('pestana'))));
  protected readonly activa = computed(() => PESTANAS.find((p) => p.id === this.parametro())?.id ?? 'lotes');

  protected seleccionar(id: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { pestana: id }, replaceUrl: true });
  }
}
