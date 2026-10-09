import { Routes } from '@angular/router';

/** Ventas y cobros · Historial de ventas (`/ventas`) y Punto de venta (`/ventas/nueva`). Todos los usuarios con sesión. */
export const VENTAS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./ventas-page.component').then((m) => m.VentasPageComponent),
    title: 'Historial de ventas · SILA',
  },
  {
    path: 'nueva',
    loadComponent: () => import('./punto-venta-page.component').then((m) => m.PuntoVentaPageComponent),
    title: 'Punto de venta · SILA',
  },
];
