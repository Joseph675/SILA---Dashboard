import { ChangeDetectionStrategy, Component, NgZone, computed, inject, input, output } from '@angular/core';
import { ApexAnnotations, ApexChart, ApexDataLabels, ApexGrid, ApexLegend, ApexPlotOptions, ApexTooltip, ApexXAxis, ApexYAxis, NgApexchartsModule } from 'ng-apexcharts';
import { ChartThemeService } from '../../shared/services/chart-theme.service';
import { formatoCop } from '../../shared/utils/formato-co';
import { hoyColombia } from '../../shared/utils/fecha-co';
import type { Periodo } from '../periodos/models/periodos.models';
import { etiquetaQuincena } from '../periodos/periodos.format';
import { esAtenuada } from './resultado-quincena.logica';

const COMPACTO = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
const MES_CORTO = new Intl.DateTimeFormat('es-CO', { month: 'short' });

/**
 * Grouped bars of the year: for each quincena, the RESULT (what it earned) and the CASH (what came in and went out), in two
 * colors with a legend. The zero line is drawn; future quincenas with nothing in them are faded; the selected one stands out.
 * Clicking a bar (or its label) selects that quincena. The table under the chart is the text alternative.
 */
@Component({
  selector: 'app-resultado-anio-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgApexchartsModule],
  template: `
    <div class="overflow-x-auto" data-testid="grafica-anio">
      <div class="max-md:min-w-[760px]" role="img" [attr.aria-label]="resumen()">
        <apx-chart [chart]="chart" [series]="series()" [xaxis]="xaxis()" [yaxis]="yaxis()" [colors]="colors()" [plotOptions]="plotOptions" [dataLabels]="dataLabels" [grid]="grid()" [tooltip]="tooltip()" [legend]="legend()" [annotations]="annotations()" />
      </div>
    </div>
  `,
})
export class ResultadoAnioChartComponent {
  private readonly tema = inject(ChartThemeService);
  private readonly zona = inject(NgZone);

  readonly periodos = input.required<readonly Periodo[]>();
  /** The id of the selected quincena (it stands out). */
  readonly seleccionadaId = input<number | null>(null);
  /** Today in Colombia (`AAAA-MM-DD`): decides which quincenas are future. */
  readonly hoy = input<string>(hoyColombia());

  readonly seleccionar = output<number>();

  protected readonly resumen = computed(() => `Resultado y caja de las ${this.periodos().length} quincenas del año. Los mismos datos están en la tabla de abajo.`);
  protected readonly series = computed(() => [
    { name: 'Resultado (lo que ganó)', data: this.periodos().map((p) => p.resultado_estimado) },
    { name: 'Caja (lo que entró y salió)', data: this.periodos().map((p) => p.caja_neta) },
  ]);

  /** One color per point: faded if it is a future quincena with no data, and softer if another one is selected. */
  protected readonly colors = computed(() => {
    const periodos = this.periodos();
    const hoy = this.hoy();
    const sel = this.seleccionadaId();
    const paleta = this.tema.palette();
    const de = (base: string) => ({ dataPointIndex }: { dataPointIndex: number }) => {
      const p = periodos[dataPointIndex];
      if (!p) return base;
      if (esAtenuada(p, hoy)) return `color-mix(in srgb, ${base} 25%, transparent)`;
      return sel !== null && p.id_periodo !== sel ? `color-mix(in srgb, ${base} 65%, transparent)` : base;
    };
    return [de(paleta.chart1), de(paleta.chart2)];
  });

  protected readonly chart: ApexChart = {
    type: 'bar',
    height: 340,
    toolbar: { show: false },
    animations: { enabled: false },
    background: 'transparent',
    fontFamily: 'inherit',
    events: {
      dataPointSelection: (_e, _c, opciones) => this.elegir(opciones?.dataPointIndex),
      xAxisLabelClick: (_e, _c, opciones) => this.elegir(opciones?.['labelIndex'] as number | undefined),
      // A click anywhere in the column of a quincena (most bars are 0 high, and a bar of height 0 cannot be touched):
      // Apex keeps the column under the pointer (the one its tooltip shows) in `globals.capturedDataPointIndex`.
      click: (_e, _c, opciones) => {
        const g = opciones?.['globals'] as { capturedDataPointIndex?: number } | undefined;
        const directo = opciones?.dataPointIndex;
        this.elegir(directo !== undefined && directo >= 0 ? directo : g?.capturedDataPointIndex);
      },
    },
  };
  protected readonly plotOptions: ApexPlotOptions = { bar: { borderRadius: 3, columnWidth: '70%' } };
  protected readonly dataLabels: ApexDataLabels = { enabled: false };

  protected readonly xaxis = computed<ApexXAxis>(() => ({
    // Two lines per label (`oct` / `1`) so the 24 fit.
    categories: this.periodos().map((p) => [MES_CORTO.format(new Date(2000, p.mes - 1, 1)).replace('.', ''), String(p.quincena)]),
    labels: { rotate: 0, trim: false, hideOverlappingLabels: false, style: { colors: this.tema.palette().mutedForeground, fontSize: '11px' } },
    axisBorder: { show: false },
    axisTicks: { show: false },
  }));
  protected readonly yaxis = computed<ApexYAxis>(() => ({
    labels: { formatter: (v: number) => `${v < 0 ? '-' : ''}$ ${COMPACTO.format(Math.abs(v))}`, style: { colors: this.tema.palette().mutedForeground } },
  }));
  protected readonly grid = computed<ApexGrid>(() => ({ borderColor: this.tema.palette().border, strokeDashArray: 4 }));
  protected readonly legend = computed<ApexLegend>(() => ({ show: true, position: 'top', horizontalAlign: 'left', labels: { colors: this.tema.palette().foreground }, markers: { size: 6 } }));
  /** The zero line, visible and solid. */
  protected readonly annotations = computed<ApexAnnotations>(() => ({ yaxis: [{ y: 0, borderColor: this.tema.palette().foreground, borderWidth: 1, strokeDashArray: 0, opacity: 0.6 }] }));
  protected readonly tooltip = computed<ApexTooltip>(() => {
    const periodos = this.periodos();
    return {
      theme: 'dark',
      shared: true,
      intersect: false,
      x: { formatter: (_v: unknown, o?: { dataPointIndex?: number }) => { const p = periodos[o?.dataPointIndex ?? 0]; return p ? `${p.anio} · ${etiquetaQuincena(p.mes, p.quincena)}` : ''; } },
      y: { formatter: (v: number) => formatoCop(v) },
    };
  });

  /** Called from ApexCharts (outside Angular's zone). */
  protected elegir(indice: number | undefined): void {
    const p = indice === undefined || indice < 0 ? undefined : this.periodos()[indice];
    if (p) this.zona.run(() => this.seleccionar.emit(p.id_periodo));
  }
}
