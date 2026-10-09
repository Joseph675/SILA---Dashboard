import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { Pestana, PestanasComponent } from '../../shared/ui/pestanas/pestanas.component';
import { CalidadTabComponent } from './calidad-tab.component';
import { LecherosTabComponent } from './lecheros-tab.component';
import { PagoTabComponent } from './pago-tab.component';
import { PreciosTabComponent } from './precios-tab.component';
import { RecepcionesTabComponent } from './recepciones-tab.component';

const PESTANAS: readonly Pestana[] = [
  { id: 'recepciones', etiqueta: 'Recepciones', icono: 'lucideMilk' },
  { id: 'calidad', etiqueta: 'Calidad por proveedor', icono: 'lucideShieldCheck' },
  { id: 'pago', etiqueta: 'Pago a lecheros', icono: 'lucideWallet' },
  { id: 'lecheros', etiqueta: 'Cuánto le debo', icono: 'lucideBanknote' },
  { id: 'precios', etiqueta: 'Precios', icono: 'lucideTags' },
];

/** Recepción de leche: deliveries, quality per provider and what is owed to each. The tab lives in `?pestana=`. */
@Component({
  selector: 'app-acopio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalidadTabComponent, LecherosTabComponent, PageHeaderComponent, PagoTabComponent, PreciosTabComponent, PestanasComponent, RecepcionesTabComponent],
  template: `
    <app-page-header title="Recepción de leche" description="Entregas de los proveedores lecheros, su control de calidad y los litros que se pagan por quincena." />

    <app-pestanas [pestanas]="pestanas" [activa]="activa()" etiqueta="Recepción de leche" (seleccionada)="seleccionar($event)" />

    <section role="tabpanel" [id]="'panel-' + activa()" [attr.aria-labelledby]="'tab-' + activa()">
      @switch (activa()) {
        @case ('recepciones') {
          <app-recepciones-tab />
        }
        @case ('calidad') {
          <app-calidad-tab />
        }
        @case ('pago') {
          <app-pago-tab />
        }
        @case ('lecheros') {
          <app-lecheros-tab />
        }
        @case ('precios') {
          <app-precios-tab />
        }
      }
    </section>
  `,
})
export class AcopioPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly pestanas = PESTANAS;
  private readonly parametro = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('pestana'))));
  protected readonly activa = computed(() => PESTANAS.find((p) => p.id === this.parametro())?.id ?? 'recepciones');

  protected seleccionar(id: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { pestana: id }, replaceUrl: true });
  }
}
