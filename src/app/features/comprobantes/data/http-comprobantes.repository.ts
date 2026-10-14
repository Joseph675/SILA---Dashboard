import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { Comprobante, ComprobanteDetalle, ComprobantesQuery, ResumenComprobantes, ResumenComprobantesQuery, TipoComprobante } from '../models/comprobantes.models';
import { ComprobantesRepository } from './comprobantes.repository';

const BASE = 'comprobantes';

/** HTTP implementation: `{apiBaseUrl}/api/v1/comprobantes/...`. */
@Injectable({ providedIn: 'root' })
export class HttpComprobantesRepository extends ComprobantesRepository {
  private readonly api = inject(ApiService);

  listar(query: PageQuery & ComprobantesQuery): Observable<Page<Comprobante>> {
    return this.api.get<Page<Comprobante>>(BASE, { ...query });
  }

  resumen(query: ResumenComprobantesQuery): Observable<ResumenComprobantes> {
    return this.api.get<ResumenComprobantes>(`${BASE}/resumen`, { ...query });
  }

  detalle(tipo: TipoComprobante, id: number): Observable<ComprobanteDetalle> {
    return this.api.get<ComprobanteDetalle>(`${BASE}/${tipo}/${id}`);
  }
}
