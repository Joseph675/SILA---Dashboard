export type TipoComprobante = 'VENTA' | 'ABONO' | 'PAGO_LECHERO' | 'COMPRA_INSUMO' | 'GASTO';
export type SentidoComprobante = 'INGRESO' | 'EGRESO';
export type EstadoComprobante = 'VIGENTE' | 'ANULADO';

/** One money movement as the server unifies it (`vw_comprobantes`). Internal document: NOT an electronic invoice. */
export interface Comprobante {
  tipo: TipoComprobante;
  /** For ABONO it is the `id_recibo`. */
  id_documento: number;
  /** `VENTA #123`. */
  numero: string;
  sentido: SentidoComprobante;
  /** false only for a credit sale (the money comes in with the payments). */
  afecta_caja: boolean;
  /** A day or a timestamp depending on the type: only the day is shown. */
  fecha: string;
  monto: number;
  id_tercero: number | null;
  tercero_tipo: 'CLIENTE' | 'PROVEEDOR' | null;
  tercero: string | null;
  descripcion: string | null;
  /** Can be `VARIOS` (cash sale with several means) or null. */
  metodo_pago: string | null;
  referencia: string | null;
  estado: EstadoComprobante;
  motivo_anulacion: string | null;
  id_periodo: number | null;
  usuario_registro: string | null;
}

/** Filters shared by the list and the summary card. */
export interface ComprobantesQuery {
  tipo?: TipoComprobante;
  sentido?: SentidoComprobante;
  estado?: EstadoComprobante;
  id_periodo?: number;
  /** Number, third party, description or reference (no accents). */
  texto?: string;
  /** ISO day. */
  desde?: string;
  hasta?: string;
}

/** The summary ignores `estado`: it only adds the VALID ones. */
export type ResumenComprobantesQuery = Omit<ComprobantesQuery, 'estado'>;

export interface ResumenComprobantes {
  /** Only what moves cash. */
  ingresos: number;
  egresos: number;
  neto: number;
  cantidad: number;
}

export interface LineaComprobante {
  concepto: string;
  /** null in an abono, an expense or a milk payment (there is a single amount, no quantity). Not in the contract: seen in the real API. */
  cantidad: number | null;
  valor_unitario: number | null;
  valor: number;
}

export interface PagoComprobante {
  metodo_pago: string;
  monto: number;
  referencia: string | null;
}

export interface ComprobanteDetalle {
  comprobante: Comprobante;
  lineas: LineaComprobante[];
  pagos: PagoComprobante[];
  /** Only for a VENTA (null in the rest). */
  subtotal: number | null;
  iva: number | null;
}
