import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Notificaciones } from '../models/notificaciones.models';
import { NotificacionesRepository } from './notificaciones.repository';

/** HTTP implementation: `{apiBaseUrl}/api/v1/notificaciones`. */
@Injectable({ providedIn: 'root' })
export class HttpNotificacionesRepository extends NotificacionesRepository {
  private readonly api = inject(ApiService);

  listar(): Observable<Notificaciones> {
    return this.api.get<Notificaciones>('notificaciones');
  }
}
