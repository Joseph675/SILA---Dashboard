import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ApexChart, ApexFill, ApexStroke, ApexTooltip, ApexXAxis, ApexYAxis, NgApexchartsModule } from 'ng-apexcharts';
import { ChartColor, chartColorValue, ChartThemeService } from '../../services/chart-theme.service';
import { IconComponent, IconName } from '../icon/icon.component';

const ICON_WRAP_CLASSES: Record<ChartColor, string> = {
  'chart-1': 'bg-chart-1/10 text-chart-1',
  'chart-2': 'bg-chart-2/10 text-chart-2',
  'chart-3': 'bg-chart-3/10 text-chart-3',
  'chart-4': 'bg-chart-4/10 text-chart-4',
  'chart-5': 'bg-chart-5/10 text-chart-5',
};

@Component({
  selector: 'app-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, NgApexchartsModule],
  templateUrl: './stat-card.component.html',
})
export class StatCardComponent {
  private readonly chartTheme = inject(ChartThemeService);

  readonly title = input.required<string>();
  readonly value = input.required<string>();
  readonly deltaLabel = input.required<string>();
  readonly deltaDirection = input.required<'up' | 'down'>();
  readonly comparisonLabel = input.required<string>();
  readonly icon = input.required<IconName>();
  readonly color = input.required<ChartColor>();
  readonly sparkline = input.required<number[]>();

  protected readonly iconWrapClass = computed(() => ICON_WRAP_CLASSES[this.color()]);

  protected readonly series = computed(() => [{ name: this.title(), data: this.sparkline() }]);

  protected readonly resolvedColor = computed(() => chartColorValue(this.chartTheme.palette(), this.color()));

  protected readonly chart: ApexChart = { type: 'area', height: 48, sparkline: { enabled: true }, animations: { enabled: false } };
  protected readonly stroke: ApexStroke = { curve: 'smooth', width: 2 };
  protected readonly xaxis: ApexXAxis = { labels: { show: false }, axisTicks: { show: false }, axisBorder: { show: false } };
  protected readonly yaxis: ApexYAxis = { labels: { show: false } };
  protected readonly tooltip: ApexTooltip = { enabled: false };

  protected readonly fill = computed<ApexFill>(() => ({
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 90, 100] },
  }));

  protected readonly colors = computed(() => [this.resolvedColor()]);
}
