import { InjectionToken } from '@angular/core';
import type { Documento, DocumentoSubido } from './models/documentos.models';

/**
 * HOOK for the real upload to Google Drive, which does not exist yet. When it exists, provide an implementation
 * with this token: it uploads the file and returns what Drive answered. While the token is `null` (the default)
 * the screens offer no upload button and NOTHING is ever marked as SUBIDO.
 */
export interface SubidorDocumentos {
  subir(documento: Documento): Promise<DocumentoSubido>;
}

export const SUBIDOR_DOCUMENTOS = new InjectionToken<SubidorDocumentos | null>('SUBIDOR_DOCUMENTOS', { providedIn: 'root', factory: () => null });
