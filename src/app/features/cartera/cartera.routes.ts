import { Routes } from '@angular/router';

/** Ventas y cobros · Cartera. Todos los usuarios con sesión (castigar es solo ADMIN, y el servidor también lo exige). */
export const CARTERA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./cartera-page.component').then((m) => m.CarteraPageComponent),
    title: 'Cartera · SILA',
  },
];
