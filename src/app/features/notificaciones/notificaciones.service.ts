import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { NOTIFICACIONES_REPOSITORY } from './data/notificaciones.provider';
import type { Notificacion } from './models/notificaciones.models';
import { marcarVistas, sinVer } from './notificaciones.logica';

const PREFIJO = 'sila_notif_vistas_';
export const INTERVALO_REFRESCO_MS = 2 * 60 * 1000;

function leer(clave: string | null): Set<string> {
  if (!clave) return new Set();
  try {
    const crudo = localStorage.getItem(clave);
    const lista: unknown = crudo ? JSON.parse(crudo) : [];
    return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/**
 * The alerts of the bell and of the page. They are fetched, never stored by the backend; «read» is a local thing:
 * the set of `clave`s the person has seen, kept in localStorage PER USER (nothing sensitive: only keys).
 * A failed refresh keeps the last list and shows nothing intrusive.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly repo = inject(NOTIFICACIONES_REPOSITORY);
  private readonly auth = inject(AuthService);

  readonly items = signal<readonly Notificacion[]>([]);
  readonly cargado = signal(false);

  private readonly claveAlmacen = computed(() => {
    const id = this.auth.sesion()?.id_usuario;
    return id === undefined ? null : `${PREFIJO}${id}`;
  });
  /** Keys already seen by THIS user; it reloads when another user signs in. */
  private readonly vistas = linkedSignal<string | null, Set<string>>({ source: this.claveAlmacen, computation: (clave) => leer(clave) });

  readonly noVistas = computed(() => sinVer(this.items(), this.vistas()));
  readonly criticasNoVistas = computed(() => this.noVistas().filter((n) => n.severidad === 'CRITICA'));
  readonly criticas = computed(() => this.items().filter((n) => n.severidad === 'CRITICA'));
  readonly advertencias = computed(() => this.items().filter((n) => n.severidad !== 'CRITICA'));

  esLeida(n: Notificacion): boolean {
    return this.vistas().has(n.clave);
  }

  /** Silent: on failure the last list stays and nothing is shown. */
  refrescar(): void {
    if (!this.auth.sesion()) return;
    this.repo.listar().subscribe({
      next: (r) => {
        this.items.set(r.items);
        this.cargado.set(true);
      },
      error: () => undefined,
    });
  }

  /** The alerts stay in the list; only their keys are remembered as seen. */
  marcarTodasLeidas(): void {
    const claves = this.items().map((n) => n.clave);
    if (claves.length === 0) return;
    const siguiente = marcarVistas(this.vistas(), claves);
    this.vistas.set(siguiente);
    const almacen = this.claveAlmacen();
    if (!almacen) return;
    try {
      localStorage.setItem(almacen, JSON.stringify([...siguiente]));
    } catch {
      // Storage blocked: «read» only lasts until the page reloads.
    }
  }
}
