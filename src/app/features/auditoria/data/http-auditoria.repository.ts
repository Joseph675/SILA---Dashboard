import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Page } from '../../../core/api/page.models';
import type { AccesoAuditoria, AccesosQuery, CambioAuditoria, CambiosQuery, ErrorAuditoria, ErroresQuery } from '../models/auditoria.models';
import { AuditoriaRepository } from './auditoria.repository';

const BASE = 'auditoria';

/** HTTP implementation: `{apiBaseUrl}/api/v1/auditoria/...`. Filters keep the contract's names (`desde`, `hasta`, `codigo_error`...). */
@Injectable({ providedIn: 'root' })
export class HttpAuditoriaRepository extends AuditoriaRepository {
  private readonly api = inject(ApiService);

  accesos(query: AccesosQuery): Observable<Page<AccesoAuditoria>> {
    return this.api.get<Page<AccesoAuditoria>>(`${BASE}/accesos`, { ...query });
  }
  cambios(query: CambiosQuery): Observable<Page<CambioAuditoria>> {
    return this.api.get<Page<CambioAuditoria>>(`${BASE}/cambios`, { ...query });
  }
  errores(query: ErroresQuery): Observable<Page<ErrorAuditoria>> {
    return this.api.get<Page<ErrorAuditoria>>(`${BASE}/errores`, { ...query });
  }
}
