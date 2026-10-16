import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';
import { arbolDeUrl } from './archivos.rutas-ui';

/** `/archivos/TIPO|CLIENTE|PROVEEDOR|MANUAL` (any letter case): one segment that names a tree. */
export function emparejarArbol(segmentos: UrlSegment[]): UrlMatchResult | null {
  return segmentos.length === 1 && arbolDeUrl(segmentos[0].path) !== null ? { consumed: segmentos, posParams: { arbol: segmentos[0] } } : null;
}

/**
 * Archivos. ADMIN and OPERATIVO see and download everything; the Drive panel and the access log are ADMIN only
 * (the API also answers 403: hiding is a convenience, not security).
 */
export const ARCHIVOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./archivos-layout.component').then((m) => m.ArchivosLayoutComponent),
    title: 'Archivos · SILA',
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./explorador-page.component').then((m) => m.ExploradorPageComponent) },
      { path: 'ver-documento', loadComponent: () => import('./ver-documento-page.component').then((m) => m.VerDocumentoPageComponent) },
      { path: 'drive', canActivate: [roleGuard('ADMIN')], loadComponent: () => import('./drive-panel.component').then((m) => m.DrivePanelComponent) },
      { path: 'accesos', canActivate: [roleGuard('ADMIN')], loadComponent: () => import('./accesos-tab.component').then((m) => m.AccesosTabComponent) },
      { matcher: emparejarArbol, loadComponent: () => import('./explorador-page.component').then((m) => m.ExploradorPageComponent) },
      { path: '**', redirectTo: '' },
    ],
  },
];
