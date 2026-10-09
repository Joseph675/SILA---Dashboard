import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ThemeAccent = 'teal' | 'blue' | 'violet' | 'rose' | 'green' | 'amber';
export type ThemeRadius = 'none' | 'small' | 'medium' | 'large';
export type ThemeDirection = 'ltr' | 'rtl';

interface ThemePreferences {
  mode: ThemeMode;
  accent: ThemeAccent;
  radius: ThemeRadius;
  direction: ThemeDirection;
}

const STORAGE_KEY = 'sila_theme_preferences';

const DEFAULT_PREFERENCES: ThemePreferences = {
  mode: 'dark',
  accent: 'blue',
  radius: 'medium',
  direction: 'ltr',
};

/** Applies the theme customizer's choices to <html> and keeps them in localStorage. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly preferences = signal<ThemePreferences>(this.loadPreferences());
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');

  readonly mode = signal(this.preferences().mode);
  readonly accent = signal(this.preferences().accent);
  readonly radius = signal(this.preferences().radius);
  readonly direction = signal(this.preferences().direction);

  constructor() {
    this.media.addEventListener('change', () => {
      if (this.mode() === 'auto') {
        this.applyResolvedMode();
      }
    });

    effect(() => {
      const prefs: ThemePreferences = {
        mode: this.mode(),
        accent: this.accent(),
        radius: this.radius(),
        direction: this.direction(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      this.applyResolvedMode();
      document.documentElement.setAttribute('data-accent', prefs.accent);
      document.documentElement.setAttribute('data-radius', prefs.radius);
      document.documentElement.setAttribute('dir', prefs.direction);
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  setAccent(accent: ThemeAccent): void {
    this.accent.set(accent);
  }

  setRadius(radius: ThemeRadius): void {
    this.radius.set(radius);
  }

  setDirection(direction: ThemeDirection): void {
    this.direction.set(direction);
  }

  reset(): void {
    this.mode.set(DEFAULT_PREFERENCES.mode);
    this.accent.set(DEFAULT_PREFERENCES.accent);
    this.radius.set(DEFAULT_PREFERENCES.radius);
    this.direction.set(DEFAULT_PREFERENCES.direction);
  }

  private applyResolvedMode(): void {
    const isDark = this.mode() === 'dark' || (this.mode() === 'auto' && this.media.matches);
    document.documentElement.classList.toggle('dark', isDark);
  }

  private loadPreferences(): ThemePreferences {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_PREFERENCES;
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }
}
