import type { Observable } from 'rxjs';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { CategoriaGasto, Gasto, GastoPorCategoria, GastosQuery, NuevoGasto, ResumenGastos } from '../models/gastos.models';

/**
 * Data contract of Gastos (through GASTOS_REPOSITORY).
 * Errors arrive as `ApiError`: 20001 (`fields`), 20004 closed quincena, 20006 inactive category, 20007 not found,
 * 20008 role, 20010 already annulled, 20016 / 20017 idempotency.
 * An expense is never edited or deleted: an ADMIN annuls it with a reason and the correct one is registered.
 */
export abstract class GastosRepository {
  /** Includes the annulled ones. */
  abstract listar(query: PageQuery & GastosQuery): Observable<Page<Gasto>>;
  /** Same filters as `listar` (paging does not apply). Annulled expenses do not add up. */
  abstract resumen(query: GastosQuery): Observable<ResumenGastos>;
  /** What used to be `GET /finanzas/gastos`: a plain list by quincena and category. */
  abstract porCategoria(idPeriodo?: number): Observable<GastoPorCategoria[]>;
  /** A plain array. `soloActivas` for the form of a new expense. */
  abstract categorias(soloActivas: boolean): Observable<CategoriaGasto[]>;
  /** Requires `Idempotency-Key`. */
  abstract crear(datos: NuevoGasto, claveIdempotencia: string): Observable<Gasto>;
  /** [ADMIN] Requires `Idempotency-Key`. Reason of 10 to 255 characters. */
  abstract anular(id: number, motivo: string, claveIdempotencia: string): Observable<Gasto>;
}
