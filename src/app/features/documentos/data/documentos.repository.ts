import type { Observable } from 'rxjs';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { Documento, DocumentoSubido, DocumentosQuery, EstadoCarga, NuevoDocumento } from '../models/documentos.models';

/**
 * Data contract of Documentos, the Google Drive queue (through DOCUMENTOS_REPOSITORY).
 * Errors arrive as `ApiError`: 20001, 20007 (the entity does not exist), 20010 (already uploaded), 20016 / 20017.
 * All three writes require `Idempotency-Key`.
 */
export abstract class DocumentosRepository {
  abstract listar(query: PageQuery & DocumentosQuery): Observable<Page<Documento>>;
  /** The queue: PENDIENTE and ERROR, not paged. */
  abstract pendientes(estado?: EstadoCarga): Observable<Documento[]>;
  /** Registers the document as PENDIENTE. */
  abstract crear(datos: NuevoDocumento, claveIdempotencia: string): Observable<Documento>;
  /** Reports a finished upload (state SUBIDO). Only the caller that really uploaded the file may call it. */
  abstract marcarSubido(id: number, datos: DocumentoSubido, claveIdempotencia: string): Observable<Documento>;
  /** Reports a failed upload (state ERROR, one more attempt; it stays in the queue). */
  abstract marcarError(id: number, mensaje: string, claveIdempotencia: string): Observable<Documento>;
}
