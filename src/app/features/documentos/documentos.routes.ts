import { Routes } from '@angular/router';

/** Administración · Documentos Drive. Lectura para todos los usuarios con sesión. */
export const DOCUMENTOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./documentos-page.component').then((m) => m.DocumentosPageComponent),
    title: 'Documentos Drive · SILA',
  },
];
