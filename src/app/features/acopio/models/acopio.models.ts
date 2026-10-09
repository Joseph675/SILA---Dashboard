export type EstadoCalidad = 'APROBADO' | 'RECHAZADO';

export interface Recepcion {
  id_recepcion: number;
  id_proveedor: number;
  proveedor: string;
  id_periodo: number;
  /** `AAAA-MM-DD`. */
  fecha: string;
  litros: number;
  temperatura: number;
  acidez: number;
  estado_calidad: EstadoCalidad;
  motivo_rechazo: string | null;
  /** Price per liter fixed on the day of the delivery (the lechero's, or the system default). */
  precio_litro: number;
  /** litros × precio; 0 when REJECTED (it is not paid). */
  valor_total: number;
  usuario_registro: string;
  /** UTC, no zone: `2026-10-09T14:03:11`. */
  fecha_registro: string;
}

export interface RecepcionesQuery {
  id_proveedor?: number;
  estado_calidad?: EstadoCalidad;
  id_periodo?: number;
  desde?: string;
  hasta?: string;
}

export interface NuevaRecepcion {
  id_proveedor: number;
  litros: number;
  temperatura: number;
  acidez: number;
  fecha?: string;
}

export interface Umbrales {
  temperatura_max: number;
  acidez_max: number;
}

export interface CalidadProveedor {
  id_proveedor: number;
  proveedor: string;
  numero_entregas: number;
  temperatura_promedio: number;
  acidez_promedio: number;
  entregas_rechazadas: number;
  porcentaje_rechazo: number;
}

export interface PagoLechero {
  id_periodo: number;
  anio: number;
  mes: number;
  quincena: number;
  id_proveedor: number;
  proveedor: string;
  litros_a_pagar: number;
  litros_rechazados: number;
  /** What the approved milk of that quincena is worth. */
  valor_leche: number;
  valor_pagado: number;
  /** valor_leche − valor_pagado. */
  saldo: number;
  precio_promedio: number;
}

export interface PagoLecherosQuery {
  id_periodo?: number;
  anio?: number;
  id_proveedor?: number;
}

export interface PrecioProveedor {
  id_precio: number;
  id_proveedor: number;
  proveedor: string;
  precio_litro: number;
  /** `AAAA-MM-DD`. */
  vigente_desde: string;
  /** The one in force today. */
  vigente: boolean;
}

export interface PreciosQuery {
  id_proveedor?: number;
  solo_vigentes?: boolean;
}

export interface FijarPrecioLeche {
  id_proveedor: number;
  /** 0.01 to 20000. */
  precio_litro: number;
  vigente_desde?: string;
}

export interface SaldoProveedor {
  id_proveedor: number;
  proveedor: string;
  activo: boolean;
  /** The lechero's price, or the system default when it has none of its own. */
  precio_vigente: number;
  litros_aprobados: number;
  total_comprado: number;
  total_pagado: number;
  saldo: number;
  ultima_entrega: string | null;
  ultimo_pago: string | null;
}

export interface SaldosQuery {
  solo_con_saldo?: boolean;
}

export type MetodoPagoLechero = 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'OTRO';

export interface PagoProveedor {
  id_pago: number;
  id_proveedor: number;
  proveedor: string;
  /** Quincena in which the money went out. */
  id_periodo: number;
  /** Quincena of milk that this payment settles. */
  id_periodo_liquidado: number;
  anio: number;
  mes: number;
  quincena: number;
  fecha_pago: string;
  monto: number;
  metodo_pago: MetodoPagoLechero;
  referencia_pago: string | null;
  estado: 'VIGENTE' | 'ANULADO';
  motivo_anulacion: string | null;
}

export interface PagosQuery {
  id_proveedor?: number;
  id_periodo?: number;
  id_periodo_liquidado?: number;
  estado?: 'VIGENTE' | 'ANULADO';
}

export interface NuevoPagoLechero {
  id_proveedor: number;
  id_periodo_liquidado: number;
  monto: number;
  metodo_pago: MetodoPagoLechero;
  referencia_pago?: string;
  fecha_pago?: string;
}
