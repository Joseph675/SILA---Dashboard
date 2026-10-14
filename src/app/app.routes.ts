import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { DashboardShellComponent } from './layout/shell/dashboard-shell.component';

/**
 * Each screen of the map is added here as it is built. Until then the menu
 * shows it as "Pronto" and it has no route.
 * `/login` is public and has no shell; everything else needs a session.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login-page.component').then((m) => m.LoginPageComponent),
    title: 'Iniciar sesión · SILA',
  },
  {
    path: '',
    component: DashboardShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'catalogos' },
      {
        path: 'catalogos',
        loadChildren: () => import('./features/catalogos/catalogos.routes').then((m) => m.CATALOGOS_ROUTES),
      },
      {
        path: 'periodos',
        loadChildren: () => import('./features/periodos/periodos.routes').then((m) => m.PERIODOS_ROUTES),
      },
      {
        path: 'ventas',
        loadChildren: () => import('./features/ventas/ventas.routes').then((m) => m.VENTAS_ROUTES),
      },
      {
        path: 'precios-cliente',
        loadChildren: () => import('./features/precios-cliente/precios-cliente.routes').then((m) => m.PRECIOS_CLIENTE_ROUTES),
      },
      {
        path: 'cartera',
        loadChildren: () => import('./features/cartera/cartera.routes').then((m) => m.CARTERA_ROUTES),
      },
      {
        path: 'parametros',
        loadChildren: () => import('./features/parametros/parametros.routes').then((m) => m.PARAMETROS_ROUTES),
      },
      {
        path: 'acopio',
        loadChildren: () => import('./features/acopio/acopio.routes').then((m) => m.ACOPIO_ROUTES),
      },
      {
        path: 'produccion',
        loadChildren: () => import('./features/produccion/produccion.routes').then((m) => m.PRODUCCION_ROUTES),
      },
      {
        path: 'gastos',
        loadChildren: () => import('./features/gastos/gastos.routes').then((m) => m.GASTOS_ROUTES),
      },
      {
        path: 'documentos',
        loadChildren: () => import('./features/documentos/documentos.routes').then((m) => m.DOCUMENTOS_ROUTES),
      },
      {
        path: 'insumos',
        loadChildren: () => import('./features/insumos/insumos.routes').then((m) => m.INSUMOS_ROUTES),
      },
      {
        path: 'inventario',
        loadChildren: () => import('./features/inventario/inventario.routes').then((m) => m.INVENTARIO_ROUTES),
      },
      {
        path: 'usuarios',
        loadChildren: () => import('./features/usuarios/usuarios.routes').then((m) => m.USUARIOS_ROUTES),
      },
      {
        path: 'auditoria',
        loadChildren: () => import('./features/auditoria/auditoria.routes').then((m) => m.AUDITORIA_ROUTES),
      },
      {
        path: 'cuenta',
        loadComponent: () => import('./features/auth/cuenta-page.component').then((m) => m.CuentaPageComponent),
        title: 'Mi cuenta · SILA',
      },
      { path: '**', redirectTo: 'catalogos' },
    ],
  },
];
