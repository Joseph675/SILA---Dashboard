import { Routes } from '@angular/router';

/** Inicio · Tablero. Read only; ADMIN and OPERATIVO see exactly the same figures. */
export const TABLERO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tablero-page.component').then((m) => m.TableroPageComponent),
    title: 'Tablero · SILA',
  },
];
