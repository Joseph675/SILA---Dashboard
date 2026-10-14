import { Routes } from '@angular/router';

/** Todas las alertas, agrupadas por severidad. Cualquier usuario con sesión. */
export const NOTIFICACIONES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./notificaciones-page.component').then((m) => m.NotificacionesPageComponent),
    title: 'Notificaciones · SILA',
  },
];
