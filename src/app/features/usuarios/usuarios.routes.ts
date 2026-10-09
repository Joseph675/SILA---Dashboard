import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

/** Grupo 6 · Administración · Usuarios. Solo ADMIN (el API también lo exige: 20008). */
export const USUARIOS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () => import('./usuarios-page.component').then((m) => m.UsuariosPageComponent),
    title: 'Usuarios · SILA',
  },
];
