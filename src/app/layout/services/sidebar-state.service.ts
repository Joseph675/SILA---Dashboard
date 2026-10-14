import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

const COLLAPSE_STORAGE_KEY = 'sila_sidebar_collapsed';
/** The sidebar is a fixed column from this width (Tailwind `lg`); below it, an off-canvas drawer. */
const ANCHO_ESCRITORIO = 1024;

/**
 * Sidebar open/collapsed/mobile-drawer state, shared between the sidebar and header.
 * The drawer closes by itself on navigation, with Escape and when the screen grows to desktop size,
 * and while it is open the page behind it does not scroll.
 */
@Injectable({ providedIn: 'root' })
export class SidebarStateService {
  private readonly documento = inject(DOCUMENT);

  readonly collapsed = signal(localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true');
  readonly mobileOpen = signal(false);

  constructor() {
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.closeMobile());
    this.documento.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.mobileOpen()) this.closeMobile();
    });
    this.documento.defaultView?.addEventListener('resize', () => {
      if (this.documento.defaultView!.innerWidth >= ANCHO_ESCRITORIO) this.closeMobile();
    });
    // No scroll of the page behind the open drawer.
    effect(() => this.documento.body.classList.toggle('sila-sin-scroll', this.mobileOpen()));
  }

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
