import { Injectable, signal } from '@angular/core';

const COLLAPSE_STORAGE_KEY = 'sila_sidebar_collapsed';

/** Sidebar open/collapsed/mobile-drawer state, shared between the sidebar and header. */
@Injectable({ providedIn: 'root' })
export class SidebarStateService {
  readonly collapsed = signal(localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true');
  readonly mobileOpen = signal(false);

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
  }

  openMobile(): void {
    this.mobileOpen.set(true);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }
}
