export interface PrecioCliente {
  id_precio: number;
  id_cliente: number;
  cliente: string;
  id_producto: number;
  codigo_sku: string;
  producto: string;
  unidad_medida: string;
  /** The agreed price. */
  precio: number;
  /** The list price today. */
  precio_base: number;
  /** `precio - precio_base`; negative = discount. */
  diferencia: number;
  activo: boolean;
}

export interface PreciosClienteQuery {
  id_cliente?: number;
  id_producto?: number;
  activo?: boolean;
}

export interface FijarPrecio {
  id_cliente: number;
  id_producto: number;
  precio: number;
}
