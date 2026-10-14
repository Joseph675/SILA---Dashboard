import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ApexChart, ApexDataLabels, ApexGrid, ApexPlotOptions, ApexTooltip, ApexXAxis, ApexYAxis, NgApexchartsModule } from 'ng-apexcharts';
import { ChartThemeService } from '../../shared/services/chart-theme.service';
import { formatoCop } from '../../shared/utils/formato-co';
import type { VentaDia } from './models/tablero.models';
import { datosGrafica, fechaLarga, formatoPesos } from './tablero.format';

const COMPACTO = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });

/** Bars of the sales of the last 7 days (the last one is today). Days with 0 are drawn too; the data is also in a table for screen readers. */
@Component({
  selector: 'app-ventas-semana-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgApexchartsModule],
  template: `
    <figure class="m-0" data-testid="grafica-semana">
      <div role="img" [attr.aria-label]="resumen()">
        <apx-chart [chart]="chart" [series]="series()" [xaxis]="xaxis()" [yaxis]="yaxis()" [colors]="colors()" [plotOptions]="plotOptions" [dataLabels]="dataLabels" [grid]="grid()" [tooltip]="tooltip()" />
      </div>
      <table class="sr-only" data-testid="tabla-semana">
        <caption>Ventas de los últimos 7 días</caption>
        <thead><tr><th scope="col">Día</th><th scope="col">Total</th><th scope="col">Ventas</th></tr></thead>
        <tbody>
          @for (d of semana(); track d.fecha) {
            <tr><th scope="row">{{ fecha(d.fecha) }}</th><td>{{ cop(d.total) }}</td><td>{{ d.cantidad }}</td></tr>
          }
        </tbody>
      </table>
    </figure>
  `,
})
export class VentasSemanaChartComponent {
  private readonly tema = inject(ChartThemeService);

  readonly semana = input.required<readonly VentaDia[]>();

  protected readonly cop = formatoCop;
  protected readonly fecha = fechaLarga;
  private readonly datos = computed(() => datosGrafica(this.semana()));

  protected readonly resumen = computed(() => {
    const total = this.semana().reduce((s, d) => s + d.total, 0);
    return `Ventas de los últimos 7 días: ${formatoPesos(total)} en total`;
  });
  protected readonly series = computed(() => [{ name: 'Ventas', data: this.datos().totales }]);
  protected readonly colors = computed(() => [this.tema.palette().chart1]);

  protected readonly chart: ApexChart = { type: 'bar', height: 260, toolbar: { show: false }, animations: { enabled: false }, background: 'transparent', fontFamily: 'inherit' };
  protected readonly plotOptions: ApexPlotOptions = { bar: { borderRadius: 4, columnWidth: '55%' } };
  protected readonly dataLabels: ApexDataLabels = { enabled: false };
  protected readonly xaxis = computed<ApexXAxis>(() => ({
    // Two lines (`mié` / `14`) so the 7 labels fit on a phone without overlapping.
    categories: this.datos().etiquetas.map((e) => e.split(' ')),
    labels: { rotate: 0, trim: false, hideOverlappingLabels: false, style: { colors: this.tema.palette().mutedForeground } },
    axisBorder: { show: false },
    axisTicks: { show: false },
  }));
  protected readonly yaxis = computed<ApexYAxis>(() => ({
    min: 0,
    labels: { formatter: (v: number) => `$ ${COMPACTO.format(v)}`, style: { colors: this.tema.palette().mutedForeground } },
  }));
  protected readonly grid = computed<ApexGrid>(() => ({ borderColor: this.tema.palette().border, strokeDashArray: 4 }));
  protected readonly tooltip = computed<ApexTooltip>(() => {
    const semana = this.semana();
    const indice = (o?: { dataPointIndex?: number }) => o?.dataPointIndex ?? 0;
    return {
      theme: 'dark',
      x: { formatter: (_v: number, o?: { dataPointIndex?: number }) => fechaLarga(semana[indice(o)]?.fecha ?? '') },
      y: {
        title: { formatter: () => '' },
        formatter: (v: number, o?: { dataPointIndex?: number }) => {
          const n = semana[indice(o)]?.cantidad ?? 0;
          return `${formatoPesos(v)} · ${n} ${n === 1 ? 'venta' : 'ventas'}`;
        },
      },
    };
  });
}
