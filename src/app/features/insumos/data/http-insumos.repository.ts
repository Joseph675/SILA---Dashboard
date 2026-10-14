import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type {
  AjusteInsumo,
  AjustesInsumoQuery,
  Compra,
  ComprasQuery,
  ConsumoLote,
  Insumo,
  InsumoGuardar,
  InsumosQuery,
  NuevaCompra,
  NuevoAjusteInsumo,
  ResumenInsumos,
} from '../models/insumos.models';
import { InsumosRepository } from './insumos.repository';

const BASE = 'insumos';

/** HTTP implementation: `{apiBaseUrl}/api/v1/insumos...`. */
@Injectable({ providedIn: 'root' })
export class HttpInsumosRepository extends InsumosRepository {
  private readonly api = inject(ApiService);

  listar(query: PageQuery & InsumosQuery): Observable<Page<Insumo>> {
    return this.api.get<Page<Insumo>>(BASE, { ...query });
  }

  resumen(): Observable<ResumenInsumos> {
    return this.api.get<ResumenInsumos>(`${BASE}/resumen`);
  }

  crear(datos: InsumoGuardar & { codigo: string }): Observable<Insumo> {
    return this.api.post<Insumo>(BASE, datos);
  }

  actualizar(id: number, datos: InsumoGuardar): Observable<Insumo> {
    return this.api.put<Insumo>(`${BASE}/${id}`, datos);
  }

  cambiarEstado(id: number, activo: boolean): Observable<Insumo> {
    return this.api.patch<Insumo>(`${BASE}/${id}/estado`, { activo });
  }

  listarCompras(query: PageQuery & ComprasQuery): Observable<Page<Compra>> {
    return this.api.get<Page<Compra>>(`${BASE}/compras`, { ...query });
  }

  crearCompra(datos: NuevaCompra, claveIdempotencia: string): Observable<Compra> {
    return this.api.post<Compra>(`${BASE}/compras`, datos, { idempotencyKey: claveIdempotencia });
  }

  anularCompra(id: number, motivo: string, claveIdempotencia: string): Observable<Compra> {
    return this.api.post<Compra>(`${BASE}/compras/${id}/anular`, { motivo }, { idempotencyKey: claveIdempotencia });
  }

  listarAjustes(query: PageQuery & AjustesInsumoQuery): Observable<Page<AjusteInsumo>> {
    return this.api.get<Page<AjusteInsumo>>(`${BASE}/ajustes`, { ...query });
  }

  crearAjuste(datos: NuevoAjusteInsumo, claveIdempotencia: string): Observable<AjusteInsumo> {
    return this.api.post<AjusteInsumo>(`${BASE}/ajustes`, datos, { idempotencyKey: claveIdempotencia });
  }

  consumosDeLote(idLote: number): Observable<ConsumoLote[]> {
    return this.api.get<ConsumoLote[]>(`${BASE}/consumos`, { id_lote: idLote });
  }
}
