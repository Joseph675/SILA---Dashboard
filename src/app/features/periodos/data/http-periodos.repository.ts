import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Page } from '../../../core/api/page.models';
import type { CrearPeriodosResultado, ListarPeriodosQuery, Periodo } from '../models/periodos.models';
import { PeriodosRepository } from './periodos.repository';

const BASE = 'periodos';

/**
 * HTTP implementation: `{apiBaseUrl}/api/v1/periodos...`. JSON is snake_case on
 * both sides, so rows and bodies pass through without mapping. Failures arrive
 * as `ApiError` (see error.interceptor.ts).
 */
@Injectable({ providedIn: 'root' })
export class HttpPeriodosRepository extends PeriodosRepository {
  private readonly api = inject(ApiService);

  listar(query: ListarPeriodosQuery): Observable<Page<Periodo>> {
    return this.api.get<Page<Periodo>>(BASE, { ...query });
  }

  anios(): Observable<number[]> {
    return this.api.get<number[]>(`${BASE}/anios`);
  }

  obtener(id: number): Observable<Periodo> {
    return this.api.get<Periodo>(`${BASE}/${id}`);
  }

  actual(): Observable<Periodo> {
    return this.api.get<Periodo>(`${BASE}/actual`);
  }

  crearAnio(anio: number): Observable<CrearPeriodosResultado> {
    return this.api.post<CrearPeriodosResultado>(`${BASE}/anio/${anio}`, null);
  }

  cerrar(id: number): Observable<Periodo> {
    return this.api.patch<Periodo>(`${BASE}/${id}/estado`, { estado: 'CERRADA' });
  }

  reabrir(id: number, motivo: string): Observable<Periodo> {
    return this.api.patch<Periodo>(`${BASE}/${id}/estado`, { estado: 'ABIERTA', motivo });
  }
}
