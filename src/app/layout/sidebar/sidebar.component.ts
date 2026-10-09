import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { iniciales } from '../../shared/utils/formato-co';
import { SidebarStateService } from '../services/sidebar-state.service';
import { SIDEBAR_NAV_GROUPS } from './sidebar-nav.data';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './sidebar.component.html',
  host: { class: 'contents' },
})
export class SidebarComponent {
  protected readonly sidebarState = inject(SidebarStateService);

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly sesion = computed(() => this.auth.sesion());
  protected readonly iniciales = computed(() => iniciales(this.sesion()?.nombre ?? ''));

  /** Groups and items the current role may see. */
  protected readonly groups = computed(() => {
    this.auth.rol();
    const permitido = (rol?: 'ADMIN' | 'OPERATIVO') => !rol || this.auth.hasRole(rol);
    return SIDEBAR_NAV_GROUPS.filter((group) => permitido(group.rol))
      .map((group) => ({ ...group, items: group.items.filter((item) => permitido(item.rol)) }))
      .filter((group) => group.items.length > 0);
  });

  private readonly collapsedGroups = signal(new Set<string>());

  protected isGroupCollapsed(label: string): boolean {
    return this.collapsedGroups().has(label);
  }

  protected toggleGroup(label: string): void {
    const next = new Set(this.collapsedGroups());
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
    }
    this.collapsedGroups.set(next);
  }

  protected cerrarSesion(): void {
    this.auth.cerrarSesion().subscribe(() => void this.router.navigate(['/login']));
  }
}
