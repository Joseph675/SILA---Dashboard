import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ClaveIdempotente } from '../../core/api/idempotencia';
import { DOCUMENTOS_REPOSITORY } from './data/documentos.provider';
import type { Documento } from './models/documentos.models';
import { SUBIDOR_DOCUMENTOS } from './subida-drive';

/**
 * Runs the upload through the Drive hook and REPORTS the real result to the backend: `subido` if it worked,
 * `error` (one more attempt, stays in the queue) if it failed. Without a hook it does nothing and fails loudly:
 * the state is never faked.
 */
@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly repo = inject(DOCUMENTOS_REPOSITORY);
  private readonly subidor = inject(SUBIDOR_DOCUMENTOS);

  readonly disponible = this.subidor !== null;

  async subir(documento: Documento): Promise<Documento> {
    if (!this.subidor) throw new Error('La subida a Drive aún no está disponible.');
    let resultado;
    try {
      resultado = await this.subidor.subir(documento);
    } catch (fallo) {
      const mensaje = (fallo instanceof Error ? fallo.message : String(fallo)).slice(0, 255) || 'Falló la subida a Drive.';
      await firstValueFrom(this.repo.marcarError(documento.id_documento, mensaje, new ClaveIdempotente().para({ id: documento.id_documento, mensaje })));
      throw fallo;
    }
    return firstValueFrom(this.repo.marcarSubido(documento.id_documento, resultado, new ClaveIdempotente().para({ id: documento.id_documento, resultado })));
  }
}
