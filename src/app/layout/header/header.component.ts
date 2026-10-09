import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SidebarStateService } from '../services/sidebar-state.service';
import { QuincenaChipComponent } from './quincena-chip.component';
import { UserMenuComponent } from './user-menu.component';
import { ThemeCustomizerStateService } from '../services/theme-customizer-state.service';
import { ThemeService } from '../services/theme.service';
import { HEADER_NOTIFICATIONS } from './header-mock-data';

@Component({
  selector: 'app-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, QuincenaChipComponent, UserMenuComponent],
  templateUrl: './header.component.html',
  host: { class: 'contents' },
})
export class HeaderComponent {
  protected readonly sidebarState = inject(SidebarStateService);
  protected readonly theme = inject(ThemeService);
  protected readonly customizer = inject(ThemeCustomizerStateService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  protected readonly notifications = HEADER_NOTIFICATIONS;

  protected readonly notificationsOpen = signal(false);

  protected toggleNotifications(): void {
    this.notificationsOpen.update((v) => !v);
  }

  protected toggleColorScheme(): void {
    this.theme.setMode(this.theme.mode() === 'dark' ? 'light' : 'dark');
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.notificationsOpen.set(false);
      }
  }
}
