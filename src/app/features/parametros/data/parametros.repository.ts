import type { Observable } from 'rxjs';
import type { Parametro } from '../models/parametros.models';

/** Data contract of system parameters (through PARAMETROS_REPOSITORY). Reading is for everyone; changing is ADMIN (20008). */
export abstract class ParametrosRepository {
  /** A plain array (there are few), by `clave`. */
  abstract listar(): Observable<Parametro[]>;
  /** Out of range → 400 / 20001 with the range in the message. No `Idempotency-Key`: it is a set, not an accumulation. */
  abstract actualizar(clave: string, valor: number): Observable<Parametro>;
}
