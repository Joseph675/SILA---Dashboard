import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { FijarPrecio, PrecioCliente, PreciosClienteQuery } from '../models/precios-cliente.models';
import { PreciosClienteRepository } from './precios-cliente.repository';

const BASE = 'precios-cliente';

@Injectable({ providedIn: 'root' })
export class HttpPreciosClienteRepository extends PreciosClienteRepository {
  private readonly api = inject(ApiService);

  listar(query: PageQuery & PreciosClienteQuery): Observable<Page<PrecioCliente>> {
    return this.api.get<Page<PrecioCliente>>(BASE, { ...query });
  }

  fijar(datos: FijarPrecio): Observable<PrecioCliente> {
    return this.api.put<PrecioCliente>(BASE, datos);
  }

  desactivar(id: number): Observable<PrecioCliente> {
    return this.api.patch<PrecioCliente>(`${BASE}/${id}/estado`, { activo: false });
  }
}
