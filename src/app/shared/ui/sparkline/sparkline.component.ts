import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const WIDTH = 80;
const HEIGHT = 28;

/**
 * The 80x28 inline trend line used inside table rows — a plain SVG polyline
 * (not an ApexCharts instance) so a page can render dozens of them cheaply.
 * `stroke` stays a `var(--...)` reference: the browser resolves it, so the
 * line follows the active theme without any JS.
 */
@Component({
  selector: 'app-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="width" [attr.height]="height" [attr.viewBox]="viewBox" fill="none" class="overflow-visible">
      <polyline
        [attr.points]="points()"
        [attr.stroke]="stroke()"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
})
export class SparklineComponent {
  /** Series values, low to high; the line is normalised to the 80x28 box. */
  readonly data = input.required<readonly number[]>();

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly viewBox = `0 0 ${WIDTH} ${HEIGHT}`;

  /** Falling series are drawn in the destructive colour, like the original template. */
  protected readonly stroke = computed(() => {
    const values = this.data();
    const rising = values.length < 2 || values[values.length - 1] >= values[0];
    return rising ? 'var(--success)' : 'var(--destructive)';
  });

  protected readonly points = computed(() => {
    const values = this.data();
    if (values.length === 0) {
      return '';
    }
    const min = Math.min(...values);
    const span = Math.max(...values) - min || 1;
    const step = values.length > 1 ? WIDTH / (values.length - 1) : 0;
    return values
      .map((value, index) => `${(index * step).toFixed(1)},${(HEIGHT - ((value - min) / span) * HEIGHT).toFixed(1)}`)
      .join(' ');
  });
}
