import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

/** Grupo 4 · Finanzas · Períodos. Solo ADMIN (el API también lo exige: 20008). */
export const PERIODOS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () => import('./periodos-page.component').then((m) => m.PeriodosPageComponent),
    title: 'Períodos · SILA',
  },
  {
    path: ':id',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () => import('./cuentas-quincena-page.component').then((m) => m.CuentasQuincenaPageComponent),
    title: 'Cuentas de la quincena · SILA',
  },
];
