import { Injectable } from '@angular/core';

/**
 * What tabs say to each other. NEVER sensitive data: no tokens, no names, no codes.
 * - `logout`: this tab signed out, so the others must drop their in-memory session.
 * - `actividad`: the person did something here (time in ms), so no tab counts it as idle.
 */
export type MensajeCanal = { tipo: 'logout'; motivo?: 'inactividad' } | { tipo: 'actividad'; t: number };

const NOMBRE_CANAL = 'sila-sesion';

function esMensaje(dato: unknown): dato is MensajeCanal {
  if (typeof dato !== 'object' || dato === null) return false;
  const { tipo, motivo, t } = dato as Record<string, unknown>;
  if (tipo === 'logout') return motivo === undefined || motivo === 'inactividad';
  return tipo === 'actividad' && typeof t === 'number' && Number.isFinite(t);
}

/**
 * Thin wrapper over `BroadcastChannel('sila-sesion')` (same origin only, nothing persisted).
 * Without BroadcastChannel it does nothing and each tab works alone.
 */
@Injectable({ providedIn: 'root' })
export class CanalSesion {
  private readonly canal = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(NOMBRE_CANAL);
  private readonly oyentes = new Set<(mensaje: MensajeCanal) => void>();

  constructor() {
    this.canal?.addEventListener('message', (evento: MessageEvent<unknown>) => {
      // Other code of the same origin could write here: only well-formed messages are used.
      if (esMensaje(evento.data)) {
        this.oyentes.forEach((oyente) => oyente(evento.data as MensajeCanal));
      }
    });
  }

  enviar(mensaje: MensajeCanal): void {
    this.canal?.postMessage(mensaje);
  }

  /** Returns the function that stops listening. */
  escuchar(oyente: (mensaje: MensajeCanal) => void): () => void {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }
}
