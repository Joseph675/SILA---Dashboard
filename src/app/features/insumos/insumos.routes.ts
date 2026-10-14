import { Routes } from '@angular/router';

/** Grupo 3 · Producción y acopio · Insumos. Todos los usuarios con sesión (comprar y definir recetas es solo ADMIN: lo decide el servidor). */
export const INSUMOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./insumos-page.component').then((m) => m.InsumosPageComponent),
    title: 'Insumos · SILA',
  },
];
