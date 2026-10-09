import { Injectable, effect, inject, signal } from '@angular/core';
import { ThemeService } from '../../layout/services/theme.service';

export interface ChartPalette {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  success: string;
  destructive: string;
  mutedForeground: string;
  border: string;
  foreground: string;
}

export type ChartColor = 'chart-1' | 'chart-2' | 'chart-3' | 'chart-4' | 'chart-5';

/** Looks up the resolved color for one of the chart-1..5 design tokens. */
export function chartColorValue(palette: ChartPalette, color: ChartColor): string {
  switch (color) {
    case 'chart-1':
      return palette.chart1;
    case 'chart-2':
      return palette.chart2;
    case 'chart-3':
      return palette.chart3;
    case 'chart-4':
      return palette.chart4;
    case 'chart-5':
      return palette.chart5;
  }
}

/**
 * Resolves the app's oklch design tokens into literal color strings ApexCharts
 * can use, and keeps them in sync whenever the theme customizer changes mode
 * or accent (the --chart-* custom properties shift with both).
 */
@Injectable({ providedIn: 'root' })
export class ChartThemeService {
  private readonly theme = inject(ThemeService);

  readonly palette = signal<ChartPalette>(this.readPalette());

  constructor() {
    effect(() => {
      // Track the signals that change the underlying CSS custom properties.
      this.theme.mode();
      this.theme.accent();
      // The DOM attribute/class updates happen in this same ThemeService effect;
      // defer one microtask so getComputedStyle reads the post-update values.
      queueMicrotask(() => this.palette.set(this.readPalette()));
    });
  }

  private readPalette(): ChartPalette {
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string) => styles.getPropertyValue(name).trim();
    return {
      chart1: read('--chart-1'),
      chart2: read('--chart-2'),
      chart3: read('--chart-3'),
      chart4: read('--chart-4'),
      chart5: read('--chart-5'),
      success: read('--success'),
      destructive: read('--destructive'),
      mutedForeground: read('--muted-foreground'),
      border: read('--border'),
      foreground: read('--foreground'),
    };
  }
}
