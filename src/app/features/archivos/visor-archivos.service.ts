import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiErrorService } from '../../core/api/api-error';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ARCHIVOS_REPOSITORY } from './data/archivos.provider';
import { esImagen } from './archivos.logica';
import { guardarBlob } from './guardar-archivo';
import { nombreDescarga } from './archivos.logica';
import type { RespuestaArchivo } from '../../core/api/archivo-cabeceras';

/** What the viewer dialogs show. Only `blob:` URLs made here, and only for `<img>` or an `Abrir` link: never inside the page. */
export interface VistaArchivo {
  url: string;
  nombre: string;
}

/** How long a `blob:` URL opened in another tab stays alive (the tab has loaded it long before). */
const VIDA_URL_PESTANA_MS = 2 * 60 * 1000;

/**
 * «Ver» a file. An IMAGE goes to the viewer dialog (`<img [src]="blob:…">`). A PDF opens in a NEW TAB (never in an `<iframe>`:
 * an uploaded PDF is not page content); if the browser blocks the tab, an `Abrir` button is offered. The bytes are fetched on
 * demand and the `blob:` URLs are released when the viewer closes (or after a while, for the tab).
 */
@Injectable({ providedIn: 'root' })
export class VisorArchivosService {
  private readonly repo = inject(ARCHIVOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly toast = inject(ToastService);

  /** The image on screen (viewer dialog). */
  readonly imagen = signal<VistaArchivo | null>(null);
  /** A PDF that the browser did not let open by itself: the person presses «Abrir». */
  readonly bloqueado = signal<VistaArchivo | null>(null);
  readonly cargando = signal(false);

  /** Fetches and shows a file. Resolves when it is on screen (or has failed: the error is already toasted). */
  async ver(id: number, nombreAlterno = 'archivo'): Promise<void> {
    if (this.cargando()) return;
    this.cargando.set(true);
    try {
      this.mostrar(await firstValueFrom(this.repo.contenido(id)), nombreAlterno);
    } catch (fallo) {
      const { mensaje, supportRef } = this.errores.describe(fallo);
      this.toast.error(mensaje, supportRef);
    } finally {
      this.cargando.set(false);
    }
  }

  /** Shows bytes already in hand (also used by «Ver documento», which decrypts a `.sila`). */
  mostrar(respuesta: RespuestaArchivo, nombreAlterno = 'archivo'): void {
    const nombre = nombreDescarga(respuesta.nombre, nombreAlterno);
    const url = URL.createObjectURL(respuesta.blob);
    if (esImagen(respuesta.blob.type)) {
      this.cerrar();
      this.imagen.set({ url, nombre });
      return;
    }
    const ventana = window.open(url, '_blank');
    if (ventana) {
      // The new tab must not hold a link back to this page.
      ventana.opener = null;
      setTimeout(() => URL.revokeObjectURL(url), VIDA_URL_PESTANA_MS);
    } else {
      this.cerrar();
      this.bloqueado.set({ url, nombre });
    }
  }

  /** Closes whatever is showing and releases its `blob:` URL. */
  cerrar(): void {
    for (const vista of [this.imagen(), this.bloqueado()]) if (vista) URL.revokeObjectURL(vista.url);
    this.imagen.set(null);
    this.bloqueado.set(null);
  }

  /** The blocked PDF was opened by the person's own click: its URL can go after a while. */
  abrioBloqueado(): void {
    const v = this.bloqueado();
    if (v) setTimeout(() => URL.revokeObjectURL(v.url), VIDA_URL_PESTANA_MS);
    this.bloqueado.set(null);
  }

  /** Saves the original bytes of what is on screen (image viewer). */
  descargarImagen(): void {
    const v = this.imagen();
    if (!v) return;
    fetch(v.url)
      .then((r) => r.blob())
      .then((b) => guardarBlob(b, v.nombre))
      .catch(() => this.toast.error('No se pudo guardar la imagen.'));
  }
}
