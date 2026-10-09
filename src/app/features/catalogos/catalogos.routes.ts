import { Routes } from '@angular/router';

/** Grupo 5 · Catálogos. Available to ADMIN and OPERATIVO; ADMIN-only actions are hidden per button. */
export const CATALOGOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./catalogos-page.component').then((m) => m.CatalogosPageComponent),
    title: 'Catálogos · SILA',
  },
];
