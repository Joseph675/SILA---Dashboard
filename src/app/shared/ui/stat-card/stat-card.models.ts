import type { ChartColor } from '../../services/chart-theme.service';
import type { IconName } from '../icon/icon.component';

/**
 * Input shape of `<app-stat-card>`. Lives next to the component so any page can
 * build its own cards without importing another feature's models.
 */
export interface StatCardData {
  title: string;
  value: string;
  deltaLabel: string;
  deltaDirection: 'up' | 'down';
  comparisonLabel: string;
  icon: IconName;
  color: ChartColor;
  sparkline: number[];
}
