import { LineaTicket, PagoFila, armarVenta, cambioDe, efectivoAplicado, faltante, totalesTicket } from './ticket.calculos';

const linea = (id: number, cantidadTexto: string, precio: number, iva: number): LineaTicket => ({
  id_producto: id,
  codigo_sku: 'SKU' + id,
  producto: 'Producto ' + id,
  unidad_medida: 'UND',
  cantidadTexto,
  precio_unitario: precio,
  precio_base: precio,
  pactado: false,
  tarifa_iva: iva,
  stock: 100,
});
const pago = (uid: number, metodo: PagoFila['metodo'], montoTexto: string, referencia = ''): PagoFila => ({ uid, metodo, montoTexto, referencia });

describe('ticket.calculos', () => {
  it('2 × 10 con IVA 19 % = subtotal 20, IVA 3,80 y total 23,80', () => {
    const t = totalesTicket([linea(1, '2', 10, 19)]);
    expect(t).toMatchObject({ subtotal: 20, iva: 3.8, total: 23.8 });
  });

  it('redondea por línea y luego suma (no sobre el total)', () => {
    // 3 × 0,10 con 19 %: subtotal 0,30 e IVA 0,057 → 0,06 por línea; dos líneas = 0,12 (y no 0,11)
    const t = totalesTicket([linea(1, '3', 0.1, 19), linea(2, '3', 0.1, 19)]);
    expect(t.iva).toBe(0.12);
    expect(t.total).toBe(0.72);
  });

  it('acepta coma decimal y trata una cantidad inválida como 0', () => {
    expect(totalesTicket([linea(1, '1,5', 10, 0)]).total).toBe(15);
    expect(totalesTicket([linea(1, 'abc', 10, 0)]).total).toBe(0);
  });

  it('faltante: positivo falta, cero completo, negativo sobra', () => {
    expect(faltante(23.8, [pago(1, 'EFECTIVO', '10')])).toBe(13.8);
    expect(faltante(23.8, [pago(1, 'EFECTIVO', '10'), pago(2, 'TRANSFERENCIA', '13.8')])).toBe(0);
    expect(faltante(23.8, [pago(1, 'EFECTIVO', '30')])).toBe(-6.2);
  });

  it('el cambio sale del efectivo recibido menos el efectivo aplicado, y nunca es negativo', () => {
    const pagos = [pago(1, 'EFECTIVO', '10'), pago(2, 'TRANSFERENCIA', '13.8')];
    expect(efectivoAplicado(pagos)).toBe(10);
    expect(cambioDe('20', pagos)).toBe(10);
    expect(cambioDe('5', pagos)).toBe(0);
    expect(cambioDe('', pagos)).toBe(0);
  });

  it('el cuerpo de una venta de contado lleva solo producto, cantidad y pagos aplicados (sin cambio ni precios)', () => {
    const cuerpo = armarVenta(5, 'CONTADO', [linea(3, '2', 10, 19)], [pago(1, 'EFECTIVO', '10'), pago(2, 'TRANSFERENCIA', '13.8', ' REF-1 ')]);
    expect(cuerpo).toEqual({
      id_cliente: 5,
      tipo_venta: 'CONTADO',
      lineas: [{ id_producto: 3, cantidad: 2 }],
      pagos: [
        { metodo_pago: 'EFECTIVO', monto: 10 },
        { metodo_pago: 'TRANSFERENCIA', monto: 13.8, referencia: 'REF-1' },
      ],
    });
  });

  it('una venta a crédito no lleva pagos', () => {
    const cuerpo = armarVenta(5, 'CREDITO', [linea(3, '1', 10, 0)], [pago(1, 'EFECTIVO', '10')]);
    expect('pagos' in cuerpo).toBe(false);
  });
});
