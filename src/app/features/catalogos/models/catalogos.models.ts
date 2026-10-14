import type { PageQuery } from '../../../core/api/page.models';

/*
 * Field names are exactly the database column names (snake_case), so the
 * HTTP repository can pass rows through without mapping.
 */

export type TipoDocumento = 'CC' | 'NIT' | 'CE' | 'PASAPORTE' | 'TI';
export type TipoProveedor = 'LECHERO' | 'INSUMOS';
export type UnidadMedida = 'KG' | 'GR' | 'LT' | 'ML' | 'UND' | 'PAQ';

export const TIPOS_DOCUMENTO: readonly TipoDocumento[] = ['CC', 'NIT', 'CE', 'PASAPORTE', 'TI'];
export const TIPOS_PROVEEDOR: readonly TipoProveedor[] = ['LECHERO', 'INSUMOS'];
export const UNIDADES_MEDIDA: readonly UnidadMedida[] = ['KG', 'GR', 'LT', 'ML', 'UND', 'PAQ'];

/** Tri-state filter used by the three tabs. */
export type FiltroActivo = 'TODOS' | 'ACTIVOS' | 'INACTIVOS';

// ---------- Clientes ----------

/** Row of the clientes view. */
export interface Cliente {
  // SUPUESTO: la clave se llama id_cliente y el estado es un booleano `activo` (el documento no los nombra).
  id_cliente: number;
  tipo_documento: TipoDocumento;
  numero_documento: string;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  limite_credito: number;
  /** Read only: what the client owes today (computed by the database). */
  saldo_deudor: number;
  activo: boolean;
}

/**
 * Input of the create/update client procedures. `limite_credito` is only
 * accepted from ADMIN (20008 otherwise); OPERATIVO leaves it out.
 */
export interface ClienteGuardar {
  tipo_documento: TipoDocumento;
  numero_documento: string;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  limite_credito?: number;
}

export interface ClientesQuery extends PageQuery {
  texto?: string;
  activo?: boolean;
}

// ---------- Proveedores ----------

export interface Proveedor {
  // SUPUESTO: id_proveedor y `activo` (Recepción de leche solo lista proveedores LECHERO activos).
  id_proveedor: number;
  tipo_documento: TipoDocumento;
  numero_documento: string;
  nombre: string;
  telefono: string;
  tipo_proveedor: TipoProveedor;
  activo: boolean;
}

export interface ProveedorGuardar {
  tipo_documento: TipoDocumento;
  numero_documento: string;
  nombre: string;
  telefono: string;
  tipo_proveedor: TipoProveedor;
}

export interface ProveedoresQuery extends PageQuery {
  texto?: string;
  tipo_proveedor?: TipoProveedor;
  activo?: boolean;
}

// ---------- Productos ----------

export interface Producto {
  // SUPUESTO: id_producto y `activo`.
  id_producto: number;
  codigo_sku: string;
  nombre: string;
  unidad_medida: UnidadMedida;
  precio_base: number;
  tarifa_iva: number;
  /** Read only: changes only through production, sales and adjustments. */
  stock: number;
  /** Alert threshold: 0 = no alert. */
  stock_minimo: number;
  /** The stock is at or under the minimum (and the minimum is above 0). */
  bajo_minimo: boolean;
  activo: boolean;
}

/** Create product [ADMIN]. Stock always starts at 0. */
export interface ProductoCrear {
  codigo_sku: string;
  nombre: string;
  unidad_medida: UnidadMedida;
  precio_base: number;
  tarifa_iva: number;
  /** Supplies one unit uses. Two steps in the database: if the recipe fails the product EXISTS already (see `RecetaFallida`). */
  receta?: LineaRecetaGuardar[];
  /** Optional alert threshold (0 to 99.999.999, 3 decimals). */
  stock_minimo?: number;
}

/** One line of a recipe to save: how much of an insumo ONE unit of the product uses, in the insumo's unit. */
export interface LineaRecetaGuardar {
  id_insumo: number;
  cantidad: number;
}

export interface LineaReceta {
  id_insumo: number;
  codigo_insumo: string;
  insumo: string;
  unidad_insumo: string;
  cantidad_por_unidad: number;
  costo_unitario_insumo: number;
  valor_por_unidad: number;
  stock_insumo: number;
  insumo_activo: boolean;
}

export interface Receta {
  id_producto: number;
  codigo_sku: string;
  producto: string;
  lineas: LineaReceta[];
  /** What the supplies of ONE unit cost, at today's average cost. */
  costo_insumos_unitario: number;
  /** How many units the current insumo stock can make (`null` without a recipe). */
  unidades_posibles: number | null;
}

// SUPUESTO: OPERATIVO puede editar nombre y unidad de medida; precio_base y tarifa_iva solo ADMIN (cambiar precio).
export interface ProductoActualizar {
  nombre: string;
  unidad_medida: UnidadMedida;
  /** Only an ADMIN may send it (403 / 20008 otherwise). Left out = the minimum does not change. */
  stock_minimo?: number;
}

/** Change price [ADMIN]. */
export interface ProductoCambiarPrecio {
  precio_base: number;
  tarifa_iva: number;
}

export interface ProductosQuery extends PageQuery {
  texto?: string;
  activo?: boolean;
}

export function activoDesdeFiltro(filtro: FiltroActivo): boolean | undefined {
  return filtro === 'TODOS' ? undefined : filtro === 'ACTIVOS';
}
