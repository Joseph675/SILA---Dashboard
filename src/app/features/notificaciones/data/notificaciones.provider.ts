import { InjectionToken } from '@angular/core';
import type { NotificacionesRepository } from './notificaciones.repository';

/** The only way components reach the alerts. Bound in `core/data/data-providers.ts`. */
export const NOTIFICACIONES_REPOSITORY = new InjectionToken<NotificacionesRepository>('NOTIFICACIONES_REPOSITORY');
