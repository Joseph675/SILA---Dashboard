import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { NuevaVenta, PrecioAplicable, PreciosQuery, Venta, VentaDetalle, VentasQuery } from '../models/ventas.models';
import { VentasRepository } from './ventas.repository';

const BASE = 'ventas';

/** HTTP implementation: `{apiBaseUrl}/api/v1/ventas...`. */
@Injectable({ providedIn: 'root' })
export class HttpVentasRepository extends VentasRepository {
  private readonly api = inject(ApiService);

  listar(query: PageQuery & VentasQuery): Observable<Page<Venta>> {
    return this.api.get<Page<Venta>>(BASE, { ...query });
  }

  detalle(id: number): Observable<VentaDetalle> {
    return this.api.get<VentaDetalle>(`${BASE}/${id}`);
  }

  precios(query: PageQuery & PreciosQuery): Observable<Page<PrecioAplicable>> {
    return this.api.get<Page<PrecioAplicable>>(`${BASE}/precios`, { ...query });
  }

  crear(datos: NuevaVenta, claveIdempotencia: string): Observable<VentaDetalle> {
    return this.api.post<VentaDetalle>(BASE, datos, { idempotencyKey: claveIdempotencia });
  }

  anular(id: number, motivo: string, claveIdempotencia: string): Observable<VentaDetalle> {
    return this.api.post<VentaDetalle>(`${BASE}/${id}/anular`, { motivo }, { idempotencyKey: claveIdempotencia });
  }
}
