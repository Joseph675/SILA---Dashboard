import type { MetodoPago } from '../../ventas/models/ventas.models';

export type EstadoCredito = 'AL_DIA' | 'VIGENTE' | 'EN_MORA' | 'EXCEDIDO';

export interface ClienteCartera {
  id_cliente: number;
  cliente: string;
  telefono: string | null;
  limite_credito: number;
  saldo_deudor: number;
  cupo_disponible: number;
  dias_mora: number;
  estado_credito: EstadoCredito;
}

export interface ClientesCarteraQuery {
  texto?: string;
  estado_credito?: EstadoCredito;
  /** The API default is `true`. */
  solo_con_deuda?: boolean;
  mora_minima?: number;
}

export interface ResumenCartera {
  total_cartera: number;
  clientes_con_deuda: number;
  clientes_en_mora: number;
  cartera_vencida: number;
}

export interface VentaPendiente {
  id_venta: number;
  fecha_venta: string;
  fecha_vencimiento: string;
  total_venta: number;
  saldo_pendiente: number;
  dias_mora: number;
}

export interface Abono {
  id_abono: number;
  id_recibo: number;
  id_cliente: number;
  cliente: string;
  id_venta: number;
  /** In practice a day (`AAAA-MM-DD`, Colombia), not a UTC timestamp like the other `fecha_*` fields. */
  fecha_abono: string;
  monto: number;
  metodo_pago: MetodoPago;
  referencia_pago: string | null;
  usuario_registro: string;
}

export interface AbonosQuery {
  id_cliente?: number;
  id_venta?: number;
  id_recibo?: number;
  metodo_pago?: MetodoPago;
  desde?: string;
  hasta?: string;
}

export interface NuevoAbono {
  id_cliente: number;
  monto: number;
  metodo_pago: MetodoPago;
  referencia?: string;
}

export interface Recibo {
  id_recibo: number;
  saldo_restante: number;
  abonos: Abono[];
}

export interface NuevoCastigo {
  id_cliente: number;
  motivo: string;
}

export interface CastigoResultado {
  id_cliente: number;
  monto_castigado: number;
}
