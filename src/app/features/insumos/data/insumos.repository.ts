import type { Observable } from 'rxjs';
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

/**
 * Data contract of Insumos (through INSUMOS_REPOSITORY).
 * Errors arrive as `ApiError`: 20001 (`fields`), 20002 (not enough stock: say how much), 20004 closed quincena,
 * 20006 (unit locked / still used by a recipe), 20007, 20008 role, 20016 / 20017 idempotency.
 */
export abstract class InsumosRepository {
  abstract listar(query: PageQuery & InsumosQuery): Observable<Page<Insumo>>;
  abstract resumen(): Observable<ResumenInsumos>;
  /** [ADMIN] Starts with stock 0 and cost 0. */
  abstract crear(datos: InsumoGuardar & { codigo: string }): Observable<Insumo>;
  /** [ADMIN] The unit does not change once there are movements or a recipe uses it (409 / 20006). */
  abstract actualizar(id: number, datos: InsumoGuardar): Observable<Insumo>;
  /** [ADMIN] Not allowed while a recipe of an active product uses it (409 / 20006). */
  abstract cambiarEstado(id: number, activo: boolean): Observable<Insumo>;
  abstract listarCompras(query: PageQuery & ComprasQuery): Observable<Page<Compra>>;
  /** [ADMIN] Requires `Idempotency-Key`. */
  abstract crearCompra(datos: NuevaCompra, claveIdempotencia: string): Observable<Compra>;
  /** [ADMIN] Only if the stock covers what was bought (409 / 20002). Sends `Idempotency-Key` (optional in the contract, recommended on every write). */
  abstract anularCompra(id: number, motivo: string, claveIdempotencia: string): Observable<Compra>;
  abstract listarAjustes(query: PageQuery & AjustesInsumoQuery): Observable<Page<AjusteInsumo>>;
  /** Requires `Idempotency-Key`. The correction types are ADMIN only (403 / 20008). */
  abstract crearAjuste(datos: NuevoAjusteInsumo, claveIdempotencia: string): Observable<AjusteInsumo>;
  /** What a lote consumed. A plain array, not a `Page`. */
  abstract consumosDeLote(idLote: number): Observable<ConsumoLote[]>;
}
