import { redondear2 } from '../../shared/utils/dinero';
import type { VentaPendiente } from './models/cartera.models';

export interface Reparto {
  id_venta: number;
  /** What this payment covers of the sale. */
  aplicado: number;
  /** What the sale would still owe afterwards. */
  saldo_despues: number;
}

/**
 * Preview of how a payment is applied: from the oldest pending sale to the newest (the order of `pendientes`).
 * The SERVER does the real split; the receipt it returns is what counts.
 */
export function repartirAbono(monto: number, pendientes: readonly VentaPendiente[]): Reparto[] {
  let restante = redondear2(monto);
  const reparto: Reparto[] = [];
  for (const v of pendientes) {
    if (restante <= 0) break;
    const aplicado = Math.min(restante, v.saldo_pendiente);
    reparto.push({ id_venta: v.id_venta, aplicado: redondear2(aplicado), saldo_despues: redondear2(v.saldo_pendiente - aplicado) });
    restante = redondear2(restante - aplicado);
  }
  return reparto;
}
