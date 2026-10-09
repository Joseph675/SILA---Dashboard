import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

/** Ventas y cobros · Precios por cliente. Solo ADMIN (el API también lo exige para escribir: 20008). */
export const PRECIOS_CLIENTE_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () => import('./precios-cliente-page.component').then((m) => m.PreciosClientePageComponent),
    title: 'Precios por cliente · SILA',
  },
];
