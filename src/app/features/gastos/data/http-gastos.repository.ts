import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { CategoriaGasto, Gasto, GastoPorCategoria, GastosQuery, NuevoGasto, ResumenGastos } from '../models/gastos.models';
import { GastosRepository } from './gastos.repository';

const BASE = 'finanzas';

/** HTTP implementation: `{apiBaseUrl}/api/v1/finanzas/...`. */
@Injectable({ providedIn: 'root' })
export class HttpGastosRepository extends GastosRepository {
  private readonly api = inject(ApiService);

  listar(query: PageQuery & GastosQuery): Observable<Page<Gasto>> {
    return this.api.get<Page<Gasto>>(`${BASE}/gastos`, { ...query });
  }

  resumen(query: GastosQuery): Observable<ResumenGastos> {
    return this.api.get<ResumenGastos>(`${BASE}/gastos/resumen`, { ...query });
  }

  porCategoria(idPeriodo?: number): Observable<GastoPorCategoria[]> {
    return this.api.get<GastoPorCategoria[]>(`${BASE}/gastos/por-categoria`, { id_periodo: idPeriodo });
  }

  categorias(soloActivas: boolean): Observable<CategoriaGasto[]> {
    // The parameter is camelCase in this endpoint (as the contract of the task says), unlike the rest of the API.
    return this.api.get<CategoriaGasto[]>(`${BASE}/categorias`, { soloActivas: soloActivas || undefined });
  }

  crear(datos: NuevoGasto, claveIdempotencia: string): Observable<Gasto> {
    return this.api.post<Gasto>(`${BASE}/gastos`, datos, { idempotencyKey: claveIdempotencia });
  }

  anular(id: number, motivo: string, claveIdempotencia: string): Observable<Gasto> {
    return this.api.post<Gasto>(`${BASE}/gastos/${id}/anular`, { motivo }, { idempotencyKey: claveIdempotencia });
  }
}
