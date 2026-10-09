import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ThemeCustomizerStateService } from '../services/theme-customizer-state.service';
import { ThemeAccent, ThemeDirection, ThemeMode, ThemeRadius, ThemeService } from '../services/theme.service';

interface AccentSwatch {
  value: ThemeAccent;
  colorClass: string;
}

const ACCENT_SWATCHES: AccentSwatch[] = [
  { value: 'teal', colorClass: 'bg-[oklch(0.55_0.175_160)]' },
  { value: 'blue', colorClass: 'bg-[oklch(0.55_0.175_255)]' },
  { value: 'violet', colorClass: 'bg-[oklch(0.55_0.20_300)]' },
  { value: 'rose', colorClass: 'bg-[oklch(0.58_0.22_15)]' },
  { value: 'green', colorClass: 'bg-[oklch(0.60_0.17_150)]' },
  { value: 'amber', colorClass: 'bg-[oklch(0.78_0.15_80)]' },
];

const RADIUS_OPTIONS: { value: ThemeRadius; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

@Component({
  selector: 'app-theme-customizer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './theme-customizer.component.html',
  host: { class: 'contents' },
})
export class ThemeCustomizerComponent {
  protected readonly state = inject(ThemeCustomizerStateService);
  protected readonly theme = inject(ThemeService);

  protected readonly accents = ACCENT_SWATCHES;
  protected readonly radiusOptions = RADIUS_OPTIONS;

  protected setMode(mode: ThemeMode): void {
    this.theme.setMode(mode);
  }

  protected setAccent(accent: ThemeAccent): void {
    this.theme.setAccent(accent);
  }

  protected setRadius(radius: ThemeRadius): void {
    this.theme.setRadius(radius);
  }

  protected setDirection(direction: ThemeDirection): void {
    this.theme.setDirection(direction);
  }
}
