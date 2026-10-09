import type { Observable } from 'rxjs';
import type { Page } from '../../../core/api/page.models';
import type { AccesoAuditoria, AccesosQuery, CambioAuditoria, CambiosQuery, ErrorAuditoria, ErroresQuery } from '../models/auditoria.models';

/** Data contract of the Auditoría screen (ADMIN only, read only). Default order is `fecha,desc`. */
export abstract class AuditoriaRepository {
  abstract accesos(query: AccesosQuery): Observable<Page<AccesoAuditoria>>;
  abstract cambios(query: CambiosQuery): Observable<Page<CambioAuditoria>>;
  abstract errores(query: ErroresQuery): Observable<Page<ErrorAuditoria>>;
}
