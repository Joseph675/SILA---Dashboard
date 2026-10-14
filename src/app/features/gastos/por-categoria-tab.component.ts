import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MontoComponent } from '../../shared/ui/monto/monto.component';
import { cargarQuincenas } from '../periodos/quincenas';
import { etiquetaQuincena } from '../periodos/periodos.format';
import { GASTOS_REPOSITORY } from './data/gastos.provider';

/** What was spent per category in each quincena (annulled expenses do not count). */
@Component({
  selector: 'app-por-categoria-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MontoComponent],
  template: `
    <div class="mb-4">
      <label for="porcat-quincena" class="mb-1 block text-xs font-medium text-muted-foreground">Quincena</label>
      <select id="porcat-quincena" class="sila-select w-full sm:w-64" (change)="cambiar($any($event.target).value)">
        <option value="" [selected]="periodo() === null">Todas las quincenas</option>
        @for (q of quincenas.opciones(); track q.id_periodo) {
          <option [value]="q.id_periodo" [selected]="q.id_periodo === periodo()">{{ q.etiqueta }}</option>
        }
      </select>
    </div>

    @if (datos.error()) {
      <div role="alert" class="sila-card p-6 text-center">
        <p class="mb-3 font-medium">No se pudo cargar el resumen por categoría.</p>
        <button type="button" class="sila-btn sila-btn-outline" (click)="datos.reload()">Reintentar</button>
      </div>
    } @else if (datos.hasValue()) {
      @if (datos.value().length === 0) {
        <p class="sila-card p-8 text-center text-sm text-muted-foreground" data-testid="sin-categorias">No hay gastos vigentes en esa selección.</p>
      } @else {
        <ul class="sila-card divide-y divide-border" aria-label="Gastos por categoría" data-testid="lista-categorias">
          @for (f of datos.value(); track f.id_periodo + f.categoria) {
            <li class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span class="min-w-0">
                <span class="font-medium">{{ f.categoria }}</span>
                <span class="block text-xs text-muted-foreground">{{ f.anio }} · {{ quincena(f.mes, f.quincena) }}</span>
              </span>
              <app-monto [valor]="f.total_gastos" [destacado]="true" />
            </li>
          }
          <li class="flex items-center justify-between gap-2 bg-muted/40 px-4 py-3 text-sm font-semibold">
            <span>Total mostrado</span>
            <span data-testid="total-categorias"><app-monto [valor]="total()" [destacado]="true" /></span>
          </li>
        </ul>
      }
    } @else {
      <p class="text-sm text-muted-foreground" aria-busy="true">Cargando…</p>
    }
  `,
})
export class PorCategoriaTabComponent {
  private readonly repo = inject(GASTOS_REPOSITORY);

  protected readonly quincenas = cargarQuincenas();
  protected readonly quincena = etiquetaQuincena;
  private readonly elegido = signal<number | null | undefined>(undefined);
  protected readonly periodo = computed(() => {
    const e = this.elegido();
    return e !== undefined ? e : this.quincenas.actualId();
  });

  protected readonly datos = rxResource({
    params: () => (this.quincenas.iniciado() ? { id_periodo: this.periodo() ?? undefined } : undefined),
    stream: ({ params }) => this.repo.porCategoria(params.id_periodo),
  });
  /** Computed on screen over the rows shown (not a server total). */
  protected readonly total = computed(() => Math.round((this.datos.hasValue() ? this.datos.value() : []).reduce((s, f) => s + f.total_gastos, 0) * 100) / 100);

  protected cambiar(valor: string): void {
    this.elegido.set(valor === '' ? null : Number(valor));
  }
}
