import { Routes } from '@angular/router';

/**
 * Finanzas · Resultado por quincena. Read only; OPERATIVO and ADMIN see the same figures, so there is NO `roleGuard`
 * (unlike `/periodos`, which stays ADMIN-only).
 */
export const RESULTADO_QUINCENA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./resultado-quincena-page.component').then((m) => m.ResultadoQuincenaPageComponent),
    title: 'Resultado por quincena · SILA',
  },
];
