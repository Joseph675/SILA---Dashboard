import { Injectable, signal } from '@angular/core';

export type ToastTipo = 'exito' | 'error';

export interface Toast {
  id: number;
  tipo: ToastTipo;
  mensaje: string;
  /** Support reference the user can copy (error 20999). */
  supportRef?: number;
}

const DURACION_MS = 5000;

/** Non-blocking notifications. Rendered once by `ToastHostComponent` in the shell. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<readonly Toast[]>([]);
  private siguienteId = 1;

  exito(mensaje: string): void {
    this.mostrar({ tipo: 'exito', mensaje });
  }

  error(mensaje: string, supportRef?: number): void {
    this.mostrar({ tipo: 'error', mensaje, supportRef });
  }

  cerrar(id: number): void {
    this.toasts.update((lista) => lista.filter((t) => t.id !== id));
  }

  private mostrar(toast: Omit<Toast, 'id'>): void {
    const id = this.siguienteId++;
    this.toasts.update((lista) => [...lista, { ...toast, id }]);
    // Errors with a support reference stay until closed, so there is time to copy it.
    if (toast.supportRef === undefined) {
      setTimeout(() => this.cerrar(id), DURACION_MS);
    }
  }
}
