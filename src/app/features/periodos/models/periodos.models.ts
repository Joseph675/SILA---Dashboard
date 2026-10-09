import type { PageQuery } from '../../../core/api/page.models';

/*
 * Field names are exactly the API's (snake_case, same as the view columns),
 * so rows pass through without mapping. See docs/CONTRATO_BACKEND.md.
 */

export type EstadoPeriodo = 'ABIERTA' | 'CERRADA';

/** One quincena (row of the periods view). Dates are ISO `AAAA-MM-DD`; amounts are COP. */
export interface Periodo {
  id_periodo: number;
  anio: number;
  mes: number;
  /** 1 = days 1-15, 2 = day 16 to the end of the month. */
  quincena: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoPeriodo;
  ingresos_ventas: number;
  costo_produccion: number;
  gastos_operativos: number;
  cartera_castigada: number;
  /** Computed by the database: ingresos - costo - gastos - cartera castigada. Management estimate, not accounting. */
  resultado_estimado: number;

  // ---- Quincena accounts (see «Cuentas con los lecheros y cuentas de la quincena» of the contract) ----
  /** IVA of the (non-annulled) sales. `ingresos_ventas` is WITHOUT IVA. */
  iva_ventas: number;
  /** Total sold WITH IVA. */
  total_vendido: number;
  ventas_contado: number;
  ventas_credito: number;
  cobrado_contado: number;
  /** Cartera payments received DURING the quincena (of any sale). */
  cobrado_abonos: number;
  total_cobrado: number;
  /** What clients still owe from this quincena's sales. */
  cartera_pendiente: number;
  leche_litros: number;
  leche_litros_rechazados: number;
  leche_comprada: number;
  leche_pagada: number;
  leche_por_pagar: number;
  /** Payments to lecheros made DURING the quincena (of any milk quincena). */
  pagos_proveedores_caja: number;
  /** total_cobrado − pagos_proveedores_caja − gastos_operativos. */
  caja_neta: number;
}

export interface PeriodosQuery {
  anio?: number;
  estado?: EstadoPeriodo;
}

export type ListarPeriodosQuery = PageQuery & PeriodosQuery;

/** Answer of `POST periodos/anio/{anio}`. `creados` is 0 when the year already existed. */
export interface CrearPeriodosResultado {
  anio: number;
  creados: number;
}
