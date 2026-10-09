import type { Observable } from 'rxjs';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { AlertaCaducidad, AlertasCaducidadQuery, InventarioQuery, ItemInventario, ResumenInventario } from '../models/inventario.models';

/** Data contract of the Inventario screen (through INVENTARIO_REPOSITORY). Read only. */
export abstract class InventarioRepository {
  abstract listar(query: PageQuery & InventarioQuery): Observable<Page<ItemInventario>>;
  abstract resumen(): Observable<ResumenInventario>;
  abstract alertasCaducidad(query: PageQuery & AlertasCaducidadQuery): Observable<Page<AlertaCaducidad>>;
}
