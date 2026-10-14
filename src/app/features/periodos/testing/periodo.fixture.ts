import type { Periodo } from '../models/periodos.models';

/** The account fields of a quincena, all in zero: spread it under the fields a test cares about. */
export const CUENTAS_EN_CERO: Pick<
  Periodo,
  | 'iva_ventas' | 'total_vendido' | 'ventas_contado' | 'ventas_credito' | 'cobrado_contado' | 'cobrado_abonos' | 'total_cobrado'
  | 'cartera_pendiente' | 'leche_litros' | 'leche_litros_rechazados' | 'leche_comprada' | 'leche_pagada' | 'leche_por_pagar'
  | 'pagos_proveedores_caja' | 'compras_insumos' | 'caja_neta'
> = {
  iva_ventas: 0, total_vendido: 0, ventas_contado: 0, ventas_credito: 0, cobrado_contado: 0, cobrado_abonos: 0, total_cobrado: 0,
  cartera_pendiente: 0, leche_litros: 0, leche_litros_rechazados: 0, leche_comprada: 0, leche_pagada: 0, leche_por_pagar: 0,
  pagos_proveedores_caja: 0, compras_insumos: 0, caja_neta: 0,
};
