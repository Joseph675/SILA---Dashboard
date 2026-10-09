import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

/** Grupo 6 · Administración · Auditoría y accesos. Solo ADMIN (el API también lo exige: 20008). */
export const AUDITORIA_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () => import('./auditoria-page.component').then((m) => m.AuditoriaPageComponent),
    title: 'Auditoría y accesos · SILA',
  },
];
