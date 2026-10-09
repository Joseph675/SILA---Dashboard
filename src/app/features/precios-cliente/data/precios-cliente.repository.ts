import type { Observable } from 'rxjs';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { FijarPrecio, PrecioCliente, PreciosClienteQuery } from '../models/precios-cliente.models';

/** Data contract of Precios por cliente (through PRECIOS_CLIENTE_REPOSITORY). Writes are ADMIN only (20008). */
export abstract class PreciosClienteRepository {
  abstract listar(query: PageQuery & PreciosClienteQuery): Observable<Page<PrecioCliente>>;
  /** Creates the agreement or updates its price, and leaves it active. */
  abstract fijar(datos: FijarPrecio): Observable<PrecioCliente>;
  /** Only deactivates; to reactivate, set the price again with `fijar`. */
  abstract desactivar(id: number): Observable<PrecioCliente>;
}
