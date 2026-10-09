import type { Observable } from 'rxjs';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { NuevaVenta, PrecioAplicable, PreciosQuery, Venta, VentaDetalle, VentasQuery } from '../models/ventas.models';

/**
 * Data contract of the sales screens (through VENTAS_REPOSITORY).
 * Errors arrive as `ApiError`: 20001 (`fields`), 20002 stock, 20003 credit limit, 20004 closed quincena,
 * 20006 inactive client/product or not annullable, 20007 not found, 20008 role, 20016 / 20017 idempotency.
 */
export abstract class VentasRepository {
  abstract listar(query: PageQuery & VentasQuery): Observable<Page<Venta>>;
  abstract detalle(id: number): Observable<VentaDetalle>;
  /** Prices for the point of sale. `id_cliente` is required. */
  abstract precios(query: PageQuery & PreciosQuery): Observable<Page<PrecioAplicable>>;
  /** Requires `Idempotency-Key`. */
  abstract crear(datos: NuevaVenta, claveIdempotencia: string): Observable<VentaDetalle>;
  /** [ADMIN] Requires `Idempotency-Key`. */
  abstract anular(id: number, motivo: string, claveIdempotencia: string): Observable<VentaDetalle>;
}
