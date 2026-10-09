import type { Observable } from 'rxjs';
import type { Page } from '../../../core/api/page.models';
import type { CrearPeriodosResultado, ListarPeriodosQuery, Periodo } from '../models/periodos.models';

/**
 * Data contract of the Períodos screen. Components depend only on this class
 * (through PERIODOS_REPOSITORY).
 *
 * Errors arrive as `ApiError`: 20001 invalid data (year outside 2000-2100,
 * reason too short), 20007 not found, 20008 insufficient role, 20010 invalid
 * state (closing a closed quincena or reopening an open one).
 */
export abstract class PeriodosRepository {
  /** Paged list. A full year is 24 rows, so ask for `size: 50`. */
  abstract listar(query: ListarPeriodosQuery): Observable<Page<Periodo>>;
  /** Years with quincenas created, ascending. A plain array, not a `Page`. */
  abstract anios(): Observable<number[]>;
  /** One quincena with its accounts. Fails with 20007 when it does not exist. */
  abstract obtener(id: number): Observable<Periodo>;
  /** The quincena that contains today. Fails with 20007 when none is created. */
  abstract actual(): Observable<Periodo>;
  /** [ADMIN] Idempotent: `creados` is 0 if the year already existed. */
  abstract crearAnio(anio: number): Observable<CrearPeriodosResultado>;
  /** [ADMIN] */
  abstract cerrar(id: number): Observable<Periodo>;
  /** [ADMIN] The reason (10-200 characters) is kept in the audit log. */
  abstract reabrir(id: number, motivo: string): Observable<Periodo>;
}
