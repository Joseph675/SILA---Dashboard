import { Routes } from '@angular/router';

/** Finanzas · Comprobantes. Read only, for every user with a session. */
export const COMPROBANTES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./comprobantes-page.component').then((m) => m.ComprobantesPageComponent),
    title: 'Comprobantes · SILA',
  },
];
