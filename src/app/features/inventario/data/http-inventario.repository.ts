import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { AlertaCaducidad, AlertasCaducidadQuery, InventarioQuery, ItemInventario, ResumenInventario } from '../models/inventario.models';
import { InventarioRepository } from './inventario.repository';

const BASE = 'inventario';

/** HTTP implementation: `{apiBaseUrl}/api/v1/inventario...`. */
@Injectable({ providedIn: 'root' })
export class HttpInventarioRepository extends InventarioRepository {
  private readonly api = inject(ApiService);

  listar(query: PageQuery & InventarioQuery): Observable<Page<ItemInventario>> {
    return this.api.get<Page<ItemInventario>>(BASE, { ...query });
  }

  resumen(): Observable<ResumenInventario> {
    return this.api.get<ResumenInventario>(`${BASE}/resumen`);
  }

  alertasCaducidad(query: PageQuery & AlertasCaducidadQuery): Observable<Page<AlertaCaducidad>> {
    return this.api.get<Page<AlertaCaducidad>>(`${BASE}/alertas-caducidad`, { ...query });
  }
}
