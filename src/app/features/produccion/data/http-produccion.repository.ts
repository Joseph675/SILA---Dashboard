import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { Ajuste, AjustesQuery, Lote, LotesQuery, NuevoAjuste, NuevoLote } from '../models/produccion.models';
import { ProduccionRepository } from './produccion.repository';

const BASE = 'produccion';

/** HTTP implementation: `{apiBaseUrl}/api/v1/produccion...`. JSON is snake_case on both sides. */
@Injectable({ providedIn: 'root' })
export class HttpProduccionRepository extends ProduccionRepository {
  private readonly api = inject(ApiService);

  listarLotes(query: PageQuery & LotesQuery): Observable<Page<Lote>> {
    return this.api.get<Page<Lote>>(`${BASE}/lotes`, { ...query });
  }

  crearLote(datos: NuevoLote, claveIdempotencia: string): Observable<Lote> {
    return this.api.post<Lote>(`${BASE}/lotes`, datos, { idempotencyKey: claveIdempotencia });
  }

  listarAjustes(query: PageQuery & AjustesQuery): Observable<Page<Ajuste>> {
    return this.api.get<Page<Ajuste>>(`${BASE}/ajustes`, { ...query });
  }

  crearAjuste(datos: NuevoAjuste, claveIdempotencia: string): Observable<Ajuste> {
    return this.api.post<Ajuste>(`${BASE}/ajustes`, datos, { idempotencyKey: claveIdempotencia });
  }
}
