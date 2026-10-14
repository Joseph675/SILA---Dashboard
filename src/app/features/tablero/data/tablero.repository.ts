import type { Observable } from 'rxjs';
import type { Tablero } from '../models/tablero.models';

/**
 * Data contract of the Tablero (through TABLERO_REPOSITORY). READ ONLY, one call: `GET /tablero`.
 * It is a snapshot at the moment of asking; do not ask more often than every 1–2 minutes.
 */
export abstract class TableroRepository {
  abstract obtener(): Observable<Tablero>;
}
