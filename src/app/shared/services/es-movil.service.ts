import { Injectable, signal } from '@angular/core';

/** Below this width (px) tables become cards. Same as Tailwind's `md` (768 px). */
export const ANCHO_MOVIL = 768;

/**
 * Whether the viewport is phone-sized, as a signal that follows rotation and resizing.
 * Without `matchMedia` (tests, old browsers) it is `false`: the desktop layout.
 */
@Injectable({ providedIn: 'root' })
export class EsMovilService {
  readonly movil = signal(false);

  constructor() {
    if (typeof matchMedia !== 'function') return;
    const consulta = matchMedia(`(max-width: ${ANCHO_MOVIL - 1}px)`);
    this.movil.set(consulta.matches);
    consulta.addEventListener('change', (e) => this.movil.set(e.matches));
  }
}
