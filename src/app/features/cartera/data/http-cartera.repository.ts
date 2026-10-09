import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type {
  Abono,
  AbonosQuery,
  CastigoResultado,
  ClienteCartera,
  ClientesCarteraQuery,
  NuevoAbono,
  NuevoCastigo,
  Recibo,
  ResumenCartera,
  VentaPendiente,
} from '../models/cartera.models';
import { CarteraRepository } from './cartera.repository';

const BASE = 'cartera';

@Injectable({ providedIn: 'root' })
export class HttpCarteraRepository extends CarteraRepository {
  private readonly api = inject(ApiService);

  clientes(query: PageQuery & ClientesCarteraQuery): Observable<Page<ClienteCartera>> {
    return this.api.get<Page<ClienteCartera>>(`${BASE}/clientes`, { ...query });
  }

  resumen(): Observable<ResumenCartera> {
    return this.api.get<ResumenCartera>(`${BASE}/resumen`);
  }

  ventasPendientes(idCliente: number): Observable<VentaPendiente[]> {
    return this.api.get<VentaPendiente[]>(`${BASE}/clientes/${idCliente}/ventas-pendientes`);
  }

  abonos(query: PageQuery & AbonosQuery): Observable<Page<Abono>> {
    return this.api.get<Page<Abono>>(`${BASE}/abonos`, { ...query });
  }

  registrarAbono(datos: NuevoAbono, claveIdempotencia: string): Observable<Recibo> {
    return this.api.post<Recibo>(`${BASE}/abonos`, datos, { idempotencyKey: claveIdempotencia });
  }

  castigar(datos: NuevoCastigo, claveIdempotencia: string): Observable<CastigoResultado> {
    return this.api.post<CastigoResultado>(`${BASE}/castigos`, datos, { idempotencyKey: claveIdempotencia });
  }
}
