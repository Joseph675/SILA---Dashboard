import type { Observable } from 'rxjs';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { Comprobante, ComprobanteDetalle, ComprobantesQuery, ResumenComprobantes, ResumenComprobantesQuery, TipoComprobante } from '../models/comprobantes.models';

/**
 * Data contract of Comprobantes (through COMPROBANTES_REPOSITORY). READ ONLY: there is no write here.
 * Errors arrive as `ApiError`: 400 invalid `tipo` / `sentido` / `estado` / `sort`, 404 the document does not exist.
 */
export abstract class ComprobantesRepository {
  /** Sort: fecha (default, desc), monto, tipo, numero, tercero, estado, sentido. Includes the annulled ones. */
  abstract listar(query: PageQuery & ComprobantesQuery): Observable<Page<Comprobante>>;
  /** Same filters as `listar` minus `estado`: it adds only the VALID ones. */
  abstract resumen(query: ResumenComprobantesQuery): Observable<ResumenComprobantes>;
  /** For an ABONO the `id` is the `id_recibo`. */
  abstract detalle(tipo: TipoComprobante, id: number): Observable<ComprobanteDetalle>;
}
