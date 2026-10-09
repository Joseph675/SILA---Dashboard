export type TipoVenta = 'CONTADO' | 'CREDITO';
export type EstadoPago = 'PAGADA' | 'PENDIENTE' | 'ANULADA' | 'CASTIGADA';
export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CHEQUE' | 'OTRO';

/** Header row of `GET /ventas`. */
export interface Venta {
  id_venta: number;
  id_cliente: number;
  cliente: string;
  tipo_documento: string;
  numero_documento: string;
  id_periodo: number;
  /** Already in Colombia time, no zone: `2026-10-09T15:42:10`. */
  fecha_venta: string;
  tipo_venta: TipoVenta;
  fecha_vencimiento: string | null;
  subtotal_venta: number;
  total_iva: number;
  total_venta: number;
  saldo_pendiente: number;
  monto_castigado: number;
  estado_pago: EstadoPago;
  motivo_anulacion: string | null;
  usuario_registro: string;
  /** UTC, no zone. */
  fecha_registro: string;
}

export interface LineaVenta {
  id_detalle: number;
  id_producto: number;
  codigo_sku: string;
  producto: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: number;
  precio_lista: number;
  /** true = sold at a price different from the list price (agreement with the client). */
  precio_pactado: boolean;
  tarifa_iva: number;
  subtotal: number;
  valor_iva: number;
  total_linea: number;
}

export interface PagoVenta {
  id_pago: number;
  metodo_pago: MetodoPago;
  monto: number;
  referencia_pago: string | null;
}

export interface VentaDetalle {
  venta: Venta;
  lineas: LineaVenta[];
  pagos: PagoVenta[];
}

export interface VentasQuery {
  texto?: string;
  id_cliente?: number;
  estado_pago?: EstadoPago;
  tipo_venta?: TipoVenta;
  desde?: string;
  hasta?: string;
}

/** A product with the price that THIS client is charged. */
export interface PrecioAplicable {
  id_producto: number;
  codigo_sku: string;
  producto: string;
  unidad_medida: string;
  tarifa_iva: number;
  stock_actual: number;
  precio_base: number;
  precio_pactado: number | null;
  precio_aplicable: number;
}

export interface PreciosQuery {
  /** Required by the API. */
  id_cliente: number;
  texto?: string;
  solo_con_stock?: boolean;
}

/** Body of `POST /ventas`. Never carries prices or totals: the server computes them. */
export interface NuevaVenta {
  id_cliente: number;
  tipo_venta: TipoVenta;
  lineas: { id_producto: number; cantidad: number }[];
  /** Only for CONTADO; the sum must equal the total exactly. */
  pagos?: { metodo_pago: MetodoPago; monto: number; referencia?: string }[];
}
