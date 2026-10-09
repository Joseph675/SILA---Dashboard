import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { Pestana, PestanasComponent } from '../../shared/ui/pestanas/pestanas.component';
import { AbonosTabComponent } from './abonos-tab.component';
import { ClientesCarteraTabComponent } from './clientes-cartera-tab.component';
import type { ClienteCartera } from './models/cartera.models';

const PESTANAS: readonly Pestana[] = [
  { id: 'clientes', etiqueta: 'Clientes con deuda', icono: 'lucideWallet' },
  { id: 'abonos', etiqueta: 'Abonos', icono: 'lucideReceipt' },
];

/** Cartera: what clients owe and the payments received. The tab (and a client filter for the payments) live in the query string. */
@Component({
  selector: 'app-cartera-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AbonosTabComponent, ClientesCarteraTabComponent, PageHeaderComponent, PestanasComponent],
  template: `
    <app-page-header title="Cartera" description="Lo que los clientes deben por ventas a crédito, los abonos recibidos y, si eres administrador, el castigo de cartera incobrable." />

    <app-pestanas [pestanas]="pestanas" [activa]="activa()" etiqueta="Cartera" (seleccionada)="seleccionar($event)" />

    <section role="tabpanel" [id]="'panel-' + activa()" [attr.aria-labelledby]="'tab-' + activa()">
      @switch (activa()) {
        @case ('clientes') {
          <app-clientes-cartera-tab (verAbonos)="irAAbonos($event)" />
        }
        @case ('abonos') {
          <app-abonos-tab [idClienteFijo]="idCliente()" [nombreClienteFijo]="nombreCliente()" (quitarCliente)="quitarCliente()" />
        }
      }
    </section>
  `,
})
export class CarteraPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly pestanas = PESTANAS;
  private readonly params = toSignal(this.route.queryParamMap.pipe(map((p) => ({ pestana: p.get('pestana'), id: p.get('id_cliente'), cliente: p.get('cliente') }))), {
    initialValue: { pestana: null, id: null, cliente: null },
  });
  protected readonly activa = computed(() => PESTANAS.find((p) => p.id === this.params().pestana)?.id ?? 'clientes');
  protected readonly idCliente = computed(() => {
    const n = Number(this.params().id);
    return Number.isInteger(n) && n > 0 ? n : null;
  });
  protected readonly nombreCliente = computed(() => this.params().cliente ?? '');

  protected seleccionar(id: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { pestana: id }, replaceUrl: true });
  }

  protected irAAbonos(c: ClienteCartera): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { pestana: 'abonos', id_cliente: c.id_cliente, cliente: c.cliente } });
  }

  protected quitarCliente(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { pestana: 'abonos' }, replaceUrl: true });
  }
}
