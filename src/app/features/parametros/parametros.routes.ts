import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

/** Administración · Parámetros. Solo ADMIN (el API también lo exige para cambiar: 20008). */
export const PARAMETROS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () => import('./parametros-page.component').then((m) => m.ParametrosPageComponent),
    title: 'Parámetros · SILA',
  },
];
