import { CUENTAS_EN_CERO } from '../periodos/testing/periodo.fixture';
import type { Periodo } from '../periodos/models/periodos.models';

/** A quincena of the year 2026 whose cascades add up (to be spread under what a test cares about). */
export function periodoDe(id: number, extra: Partial<Periodo> = {}): Periodo {
  const mes = Math.floor((id - 1) / 2) + 1;
  const quincena = ((id - 1) % 2) + 1;
  const inicio = `2026-${String(mes).padStart(2, '0')}-${quincena === 1 ? '01' : '16'}`;
  const fin = quincena === 1 ? `2026-${String(mes).padStart(2, '0')}-15` : `2026-${String(mes).padStart(2, '0')}-28`;
  return { ...CUENTAS_EN_CERO, id_periodo: id, anio: 2026, mes, quincena, fecha_inicio: inicio, fecha_fin: fin, estado: 'CERRADA', ingresos_ventas: 0, costo_produccion: 0, gastos_operativos: 0, cartera_castigada: 0, resultado_estimado: 0, ...extra };
}

/**
 * Octubre 1.ª quincena (id 19) with every figure consistent:
 *   resultado = 900.000 − 300.000 − 50.000 − 20.000 = 530.000
 *   caja      = 700.000 (400.000 contado + 300.000 abonos) − 200.000 − 40.000 − 50.000 = 410.000
 */
export const OCTUBRE_1: Periodo = periodoDe(19, {
  estado: 'ABIERTA',
  ingresos_ventas: 900000,
  costo_produccion: 300000,
  gastos_operativos: 50000,
  cartera_castigada: 20000,
  resultado_estimado: 530000,
  iva_ventas: 171000,
  total_vendido: 1071000,
  ventas_contado: 600000,
  ventas_credito: 471000,
  cobrado_contado: 400000,
  cobrado_abonos: 300000,
  total_cobrado: 700000,
  cartera_pendiente: 371000,
  leche_litros: 1500,
  leche_litros_rechazados: 120.5,
  leche_comprada: 450000,
  leche_pagada: 200000,
  leche_por_pagar: 250000,
  pagos_proveedores_caja: 200000,
  compras_insumos: 40000,
  caja_neta: 410000,
});
