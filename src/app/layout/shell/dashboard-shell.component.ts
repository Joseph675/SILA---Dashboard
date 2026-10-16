import { VisorArchivosComponent } from '../../features/archivos/visor-archivos.component';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { InactividadService } from '../../core/session/inactividad.service';
import { AvisoInactividadComponent } from './aviso-inactividad.component';
import { AvisoRespaldoComponent } from './aviso-respaldo.component';
import { ToastHostComponent } from '../../shared/ui/toast/toast-host.component';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SidebarStateService } from '../services/sidebar-state.service';
import { ThemeCustomizerComponent } from '../theme-customizer/theme-customizer.component';

@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VisorArchivosComponent, RouterOutlet, AvisoInactividadComponent, AvisoRespaldoComponent, ToastHostComponent, SidebarComponent, HeaderComponent, ThemeCustomizerComponent],
  templateUrl: './dashboard-shell.component.html',
})
export class DashboardShellComponent {
  protected readonly sidebarState = inject(SidebarStateService);
}
