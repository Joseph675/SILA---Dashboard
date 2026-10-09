import { Injectable, signal } from '@angular/core';

/** Open/close state for the theme customizer slide-over, shared between the header trigger and the panel itself. */
@Injectable({ providedIn: 'root' })
export class ThemeCustomizerStateService {
  readonly open = signal(false);

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }
}
