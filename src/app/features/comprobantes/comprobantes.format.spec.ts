import { chipEstadoComprobante, claveDocumento, etiquetaMetodoComprobante, etiquetaTipoComprobante, leerDocumento, montoConSigno, numeroLegible } from './comprobantes.format';

describe('comprobantes.format', () => {
  it('un ingreso se muestra con «+» en verde', () => {
    const m = montoConSigno({ sentido: 'INGRESO', monto: 125000 });
    expect(m.texto.replace(/\s/g, ' ')).toBe('+ $ 125.000');
    expect(m.clase).toBe('text-success');
  });

  it('un egreso se muestra con el signo menos «−» en rojo', () => {
    const m = montoConSigno({ sentido: 'EGRESO', monto: 85000.5 });
    expect(m.texto.startsWith('−')).toBe(true);
    expect(m.texto).toContain('85.000,50');
    expect(m.clase).toBe('text-destructive');
  });

  it('el signo lo da el sentido, no el signo del monto', () => {
    expect(montoConSigno({ sentido: 'EGRESO', monto: -500 }).texto.startsWith('−')).toBe(true);
    expect(montoConSigno({ sentido: 'INGRESO', monto: -500 }).texto.startsWith('+')).toBe(true);
  });

  it('el estado ANULADO es peligro y el VIGENTE éxito', () => {
    expect(chipEstadoComprobante('ANULADO')).toEqual({ texto: 'Anulado', tono: 'peligro' });
    expect(chipEstadoComprobante('VIGENTE')).toEqual({ texto: 'Vigente', tono: 'exito' });
  });

  it('etiquetas: tipos y métodos (VARIOS y null incluidos)', () => {
    expect(etiquetaTipoComprobante('PAGO_LECHERO')).toBe('Pago a lecheros');
    expect(etiquetaTipoComprobante('COMPRA_INSUMO')).toBe('Compra de insumos');
    expect(etiquetaMetodoComprobante('VARIOS')).toBe('Varios medios');
    expect(etiquetaMetodoComprobante(null)).toBe('—');
    expect(etiquetaMetodoComprobante('EFECTIVO')).toBe('Efectivo');
  });

  it('el número del servidor se muestra sin guion bajo', () => {
    expect(numeroLegible('COMPRA_INSUMO #25')).toBe('COMPRA INSUMO #25');
    expect(numeroLegible('VENTA #123')).toBe('VENTA #123');
  });

  it('la clave del documento (?ver=) va y vuelve, y rechaza lo inválido', () => {
    expect(claveDocumento('PAGO_LECHERO', 9)).toBe('PAGO_LECHERO-9');
    expect(leerDocumento('PAGO_LECHERO-9')).toEqual({ tipo: 'PAGO_LECHERO', id: 9 });
    expect(leerDocumento('FACTURA-3')).toBeNull();
    expect(leerDocumento('VENTA-0')).toBeNull();
    expect(leerDocumento('VENTA-abc')).toBeNull();
    expect(leerDocumento(null)).toBeNull();
  });
});
