import { Routes } from '@angular/router';

/** Finanzas · Gastos. Todos los usuarios con sesión registran; anular es solo ADMIN (el servidor también lo exige: 20008). */
export const GASTOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./gastos-page.component').then((m) => m.GastosPageComponent),
    title: 'Gastos · SILA',
  },
];
