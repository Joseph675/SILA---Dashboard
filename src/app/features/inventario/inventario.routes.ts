import { Routes } from '@angular/router';

/** Grupo 3 · Producción y acopio · Inventario. Todos los usuarios con sesión. */
export const INVENTARIO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./inventario-page.component').then((m) => m.InventarioPageComponent),
    title: 'Inventario · SILA',
  },
];
