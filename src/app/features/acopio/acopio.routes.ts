import { Routes } from '@angular/router';

/** Grupo 3 · Producción y acopio · Recepción de leche. Todos los usuarios con sesión. */
export const ACOPIO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./acopio-page.component').then((m) => m.AcopioPageComponent),
    title: 'Recepción de leche · SILA',
  },
];
