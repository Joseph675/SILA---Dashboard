import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificacionesCampanaComponent } from '../../features/notificaciones/notificaciones-campana.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SidebarStateService } from '../services/sidebar-state.service';
import { QuincenaChipComponent } from './quincena-chip.component';
import { UserMenuComponent } from './user-menu.component';
import { ThemeCustomizerStateService } from '../services/theme-customizer-state.service';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, NotificacionesCampanaComponent, QuincenaChipComponent, UserMenuComponent],
  templateUrl: './header.component.html',
  host: { class: 'contents' },
})
export class HeaderComponent {
  protected readonly sidebarState = inject(SidebarStateService);
  protected readonly theme = inject(ThemeService);
  protected readonly customizer = inject(ThemeCustomizerStateService);

  protected toggleColorScheme(): void {
    this.theme.setMode(this.theme.mode() === 'dark' ? 'light' : 'dark');
  }

}
