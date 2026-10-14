import { claseNeto, datosGrafica, etiquetaDia, fechaLarga, formatoPesos, horaCo, tituloQuincena } from './tablero.format';

const limpio = (s: string) => s.replace(/\s/g, ' ');

describe('tablero.format', () => {
  it('pesos sin decimales (redondea) y el negativo lleva su signo', () => {
    expect(limpio(formatoPesos(423114.24))).toBe('$ 423.114');
    expect(limpio(formatoPesos(-226885.76))).toContain('226.886');
    expect(formatoPesos(-226885.76)).toContain('-');
    expect(limpio(formatoPesos(0))).toBe('$ 0');
  });

  it('la fecha larga es «miércoles 14 de octubre» (sin coma, sin correrse de día)', () => {
    expect(fechaLarga('2026-10-14')).toBe('miércoles 14 de octubre');
    expect(fechaLarga('2026-01-01')).toBe('jueves 1 de enero');
    expect(fechaLarga('2026-10-14T03:00:00')).toBe('miércoles 14 de octubre');
  });

  it('el título de la quincena es «Quincena N de <mes> <año>»', () => {
    expect(tituloQuincena(10, 1, 2026)).toBe('Quincena 1 de octubre 2026');
    expect(tituloQuincena(2, 2, 2027)).toBe('Quincena 2 de febrero 2027');
  });

  it('el neto negativo va en rojo y el cero o positivo no', () => {
    expect(claseNeto(-1)).toBe('text-destructive');
    expect(claseNeto(0)).toBe('');
    expect(claseNeto(500)).toBe('');
  });

  it('la etiqueta de un día es «mié 14»', () => {
    expect(etiquetaDia('2026-10-14')).toBe('mié 14');
  });

  it('la gráfica conserva las 7 filas (también las de 0) y la última se llama «Hoy»', () => {
    const semana = Array.from({ length: 7 }, (_, i) => ({ fecha: `2026-10-${String(8 + i).padStart(2, '0')}`, total: i === 3 ? 0 : 1000 * i, cantidad: i === 3 ? 0 : i }));
    const g = datosGrafica(semana);

    expect(g.totales).toEqual([0, 1000, 2000, 0, 4000, 5000, 6000]);
    expect(g.cantidades).toEqual([0, 1, 2, 0, 4, 5, 6]);
    expect(g.etiquetas).toHaveLength(7);
    expect(g.etiquetas[6]).toBe('Hoy');
    expect(g.etiquetas[0]).toBe('jue 8');
    expect(g.fechas[0]).toBe('08/10/2026');
  });

  it('la hora se da en horario de Colombia', () => {
    expect(horaCo(new Date('2026-10-14T20:05:00Z'))).toBe('15:05');
  });
});
