import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type {
  CalidadProveedor,
  FijarPrecioLeche,
  NuevoPagoLechero,
  PagoProveedor,
  PagosQuery,
  PrecioProveedor,
  PreciosQuery,
  SaldoProveedor,
  SaldosQuery,
  NuevaRecepcion,
  PagoLechero,
  PagoLecherosQuery,
  Recepcion,
  RecepcionesQuery,
  Umbrales,
} from '../models/acopio.models';
import { AcopioRepository } from './acopio.repository';

const BASE = 'acopio';

/** HTTP implementation: `{apiBaseUrl}/api/v1/acopio...`. JSON is snake_case on both sides. */
@Injectable({ providedIn: 'root' })
export class HttpAcopioRepository extends AcopioRepository {
  private readonly api = inject(ApiService);

  listarRecepciones(query: PageQuery & RecepcionesQuery): Observable<Page<Recepcion>> {
    return this.api.get<Page<Recepcion>>(`${BASE}/recepciones`, { ...query });
  }

  crearRecepcion(datos: NuevaRecepcion, claveIdempotencia: string): Observable<Recepcion> {
    return this.api.post<Recepcion>(`${BASE}/recepciones`, datos, { idempotencyKey: claveIdempotencia });
  }

  umbrales(): Observable<Umbrales> {
    return this.api.get<Umbrales>(`${BASE}/umbrales`);
  }

  calidad(query: PageQuery): Observable<Page<CalidadProveedor>> {
    return this.api.get<Page<CalidadProveedor>>(`${BASE}/calidad`, { ...query });
  }

  pagoLecheros(query: PageQuery & PagoLecherosQuery): Observable<Page<PagoLechero>> {
    return this.api.get<Page<PagoLechero>>(`${BASE}/pago-lecheros`, { ...query });
  }

  listarPrecios(query: PageQuery & PreciosQuery): Observable<Page<PrecioProveedor>> {
    return this.api.get<Page<PrecioProveedor>>(`${BASE}/precios`, { ...query });
  }

  fijarPrecio(datos: FijarPrecioLeche, claveIdempotencia: string): Observable<PrecioProveedor> {
    return this.api.post<PrecioProveedor>(`${BASE}/precios`, datos, { idempotencyKey: claveIdempotencia });
  }

  saldos(query: PageQuery & SaldosQuery): Observable<Page<SaldoProveedor>> {
    return this.api.get<Page<SaldoProveedor>>(`${BASE}/saldos`, { ...query });
  }

  listarPagos(query: PageQuery & PagosQuery): Observable<Page<PagoProveedor>> {
    return this.api.get<Page<PagoProveedor>>(`${BASE}/pagos`, { ...query });
  }

  registrarPago(datos: NuevoPagoLechero, claveIdempotencia: string): Observable<PagoProveedor> {
    return this.api.post<PagoProveedor>(`${BASE}/pagos`, datos, { idempotencyKey: claveIdempotencia });
  }

  anularPago(id: number, motivo: string, claveIdempotencia: string): Observable<PagoProveedor> {
    return this.api.post<PagoProveedor>(`${BASE}/pagos/${id}/anular`, { motivo }, { idempotencyKey: claveIdempotencia });
  }
}
