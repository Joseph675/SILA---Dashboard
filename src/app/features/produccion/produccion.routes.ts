import { Routes } from '@angular/router';

/** Grupo 3 · Producción y acopio · Producción. Todos los usuarios con sesión. */
export const PRODUCCION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./produccion-page.component').then((m) => m.ProduccionPageComponent),
    title: 'Producción · SILA',
  },
];
