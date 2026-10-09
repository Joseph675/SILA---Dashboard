import { repartirAbono } from './cartera.calculos';
import type { VentaPendiente } from './models/cartera.models';

const venta = (id: number, saldo: number): VentaPendiente => ({ id_venta: id, fecha_venta: '2026-10-01T10:00:00', fecha_vencimiento: '2026-10-31', total_venta: saldo, saldo_pendiente: saldo, dias_mora: 0 });

describe('repartirAbono', () => {
  it('aplica primero a la venta más antigua y sigue con la siguiente', () => {
    expect(repartirAbono(150, [venta(1, 100), venta(2, 100)])).toEqual([
      { id_venta: 1, aplicado: 100, saldo_despues: 0 },
      { id_venta: 2, aplicado: 50, saldo_despues: 50 },
    ]);
  });

  it('un abono pequeño solo toca la primera venta', () => {
    expect(repartirAbono(30.5, [venta(1, 100), venta(2, 100)])).toEqual([{ id_venta: 1, aplicado: 30.5, saldo_despues: 69.5 }]);
  });

  it('sin monto no reparte nada', () => {
    expect(repartirAbono(0, [venta(1, 100)])).toEqual([]);
  });
});
