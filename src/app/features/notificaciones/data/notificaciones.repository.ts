import type { Observable } from 'rxjs';
import type { Notificaciones } from '../models/notificaciones.models';

/** Data contract of the notifications (through NOTIFICACIONES_REPOSITORY). Any signed-in user can read them. */
export abstract class NotificacionesRepository {
  abstract listar(): Observable<Notificaciones>;
}
