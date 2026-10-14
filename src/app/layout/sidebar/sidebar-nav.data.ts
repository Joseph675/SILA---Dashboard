import type { Rol } from '../../core/services/auth.service';
import type { IconName } from '../../shared/ui/icon/icon.component';

export interface SidebarNavItem {
  label: string;
  icon: IconName;
  /** Route of the screen. Items without one are not built yet and render disabled. */
  route?: string;
  /** Minimum role. Hiding the item is not security: the API rejects the calls anyway (20008). */
  rol?: Rol;
  badge?: string;
  /** The link is active only on this exact path (so `/ventas` does not light up on `/ventas/nueva`). */
  exacta?: boolean;
}

export interface SidebarNavGroup {
  label: string;
  rol?: Rol;
  items: SidebarNavItem[];
}

/**
 * The 6 groups / 15 screens of the screen map (prompt.md). An item with a
 * `route` is built; the rest show as "Pronto".
 */
export const SIDEBAR_NAV_GROUPS: SidebarNavGroup[] = [
  {
    label: 'Inicio',
    items: [{ label: 'Tablero', icon: 'lucideLayoutDashboard' }],
  },
  {
    label: 'Ventas y cobros',
    items: [
      { label: 'Punto de venta', icon: 'lucideScanBarcode', route: '/ventas/nueva' },
      { label: 'Historial de ventas', icon: 'lucideReceipt', route: '/ventas', exacta: true },
      { label: 'Precios por cliente', icon: 'lucideTags', route: '/precios-cliente', rol: 'ADMIN' },
      { label: 'Comprobantes', icon: 'lucideFileText', route: '/comprobantes' },
      { label: 'Cartera', icon: 'lucideWallet', route: '/cartera' },
    ],
  },
  {
    label: 'Producción y acopio',
    items: [
      { label: 'Recepción de leche', icon: 'lucideMilk', route: '/acopio' },
      { label: 'Producción', icon: 'lucideFactory', route: '/produccion' },
      { label: 'Inventario', icon: 'lucideWarehouse', route: '/inventario' },
      { label: 'Insumos', icon: 'lucidePackage', route: '/insumos' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { label: 'Gastos', icon: 'lucideBanknote', route: '/gastos' },
      { label: 'Resultado por quincena', icon: 'lucideChartColumn' },
      { label: 'Períodos', icon: 'lucideCalendarRange', route: '/periodos', rol: 'ADMIN' },
    ],
  },
  {
    label: 'Catálogos',
    items: [{ label: 'Catálogos', icon: 'lucideLibraryBig', route: '/catalogos' }],
  },
  {
    label: 'Administración',
    rol: 'ADMIN',
    items: [
      { label: 'Parámetros', icon: 'lucideSlidersHorizontal', route: '/parametros', rol: 'ADMIN' },
      { label: 'Documentos Drive', icon: 'lucideCloudUpload', route: '/documentos' },
      { label: 'Resoluciones DIAN', icon: 'lucideStamp' },
      { label: 'Auditoría y accesos', icon: 'lucideShieldCheck', route: '/auditoria' },
      { label: 'Usuarios', icon: 'lucideUserCog', route: '/usuarios', rol: 'ADMIN' },
    ],
  },
];
