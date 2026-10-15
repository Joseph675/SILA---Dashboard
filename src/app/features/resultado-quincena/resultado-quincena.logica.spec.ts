import { periodoDe, OCTUBRE_1 } from './resultado-quincena.fixture';
import { anioPorDefecto, cascadaCaja, cascadaResultado, esAtenuada, etiquetaCorta, haEmpezado, quincenaPorDefecto, sumaDeLineas, totalesAnio, vecina } from './resultado-quincena.logica';

const AÑO = Array.from({ length: 24 }, (_, i) => periodoDe(i + 1));

describe('cascadas', () => {
  it('RESULTADO: las líneas (ventas sin IVA − producción − gastos − cartera castigada) suman EXACTAMENTE resultado_estimado', () => {
    const c = cascadaResultado(OCTUBRE_1);

    expect(c.lineas.map((l) => [l.etiqueta, l.signo, l.valor])).toEqual([
      ['Ventas sin IVA', '+', 900000],
      ['Costo de producción', '−', 300000],
      ['Gastos', '−', 50000],
      ['Cartera castigada', '−', 20000],
    ]);
    expect(sumaDeLineas(c)).toBe(530000);
    expect(sumaDeLineas(c)).toBe(c.total);
  });

  it('CAJA: cobrado (contado + abonos) − pagos a lecheros − insumos − gastos suman EXACTAMENTE caja_neta', () => {
    const c = cascadaCaja(OCTUBRE_1);

    expect(c.lineas.filter((l) => l.detalle).map((l) => l.clave)).toEqual(['cobrado_contado', 'cobrado_abonos']);
    // Las sub-líneas son un desglose del «Cobrado»: no se suman dos veces.
    expect(sumaDeLineas(c)).toBe(410000);
    expect(sumaDeLineas(c)).toBe(c.total);
    expect(c.lineas.find((l) => l.clave === 'cobrado_contado')!.valor + c.lineas.find((l) => l.clave === 'cobrado_abonos')!.valor).toBe(c.lineas[0].valor);
  });

  it('la leche comprada NO entra en ninguna de las dos cascadas', () => {
    const claves = [...cascadaResultado(OCTUBRE_1).lineas, ...cascadaCaja(OCTUBRE_1).lineas].map((l) => l.clave);
    expect(claves).not.toContain('leche_comprada');
    expect(claves).not.toContain('leche_por_pagar');
  });

  it('un resultado negativo: las líneas siguen sumando al total negativo', () => {
    const p = periodoDe(20, { ingresos_ventas: 100000, costo_produccion: 150000, gastos_operativos: 30000, resultado_estimado: -80000 });
    const c = cascadaResultado(p);

    expect(c.total).toBe(-80000);
    expect(sumaDeLineas(c)).toBe(-80000);
  });

  it('los centavos no rompen la suma (redondeo a 2 decimales)', () => {
    const p = periodoDe(20, { ingresos_ventas: 100.1, costo_produccion: 50.2, gastos_operativos: 0.1, resultado_estimado: 49.8 });
    expect(sumaDeLineas(cascadaResultado(p))).toBe(49.8);
  });
});

describe('selección por defecto', () => {
  const HOY = '2026-10-14';

  it('el año: el de la quincena de hoy; si no hay, el último con quincenas; si no hay años, ninguno', () => {
    expect(anioPorDefecto([2025, 2026], { anio: 2026 })).toBe(2026);
    expect(anioPorDefecto([2025, 2026], null)).toBe(2026);
    expect(anioPorDefecto([2024, 2025], { anio: 2026 })).toBe(2025);
    expect(anioPorDefecto([], null)).toBeNull();
  });

  it('la quincena: la de hoy (lo que devolvió /periodos/actual)', () => {
    expect(quincenaPorDefecto(AÑO, { id_periodo: 19 }, HOY)?.id_periodo).toBe(19);
  });

  it('si /periodos/actual dio 404: la ÚLTIMA quincena que ya empezó', () => {
    // Hoy 2026-10-14 → la de octubre 1.ª (id 19) empezó el 1; la 2.ª (id 20) empieza el 16.
    expect(quincenaPorDefecto(AÑO, null, HOY)?.id_periodo).toBe(19);
    expect(quincenaPorDefecto(AÑO, null, '2026-10-16')?.id_periodo).toBe(20);
  });

  it('un año pasado sin «actual»: la última del año; un año futuro: la primera', () => {
    expect(quincenaPorDefecto(AÑO, null, '2027-03-01')?.id_periodo).toBe(24);
    expect(quincenaPorDefecto(AÑO, null, '2025-12-31')?.id_periodo).toBe(1);
  });

  it('la «actual» de OTRO año no aplica (no está en la lista): cae a la última empezada', () => {
    expect(quincenaPorDefecto(AÑO, { id_periodo: 999 }, HOY)?.id_periodo).toBe(19);
  });

  it('año sin quincenas: ninguna', () => {
    expect(quincenaPorDefecto([], null, HOY)).toBeNull();
  });

  it('anterior / siguiente: se detienen en los extremos del año', () => {
    expect(vecina(AÑO, 19, -1)?.id_periodo).toBe(18);
    expect(vecina(AÑO, 19, 1)?.id_periodo).toBe(20);
    expect(vecina(AÑO, 1, -1)).toBeNull();
    expect(vecina(AÑO, 24, 1)).toBeNull();
    expect(vecina(AÑO, null, 1)).toBeNull();
  });
});

describe('totales del año y quincenas futuras', () => {
  const HOY = '2026-10-14';

  it('suman SOLO las quincenas que ya empezaron', () => {
    const año = AÑO.map((p) => (p.id_periodo === 19 ? OCTUBRE_1 : p.id_periodo === 18 ? periodoDe(18, { ingresos_ventas: 100000, resultado_estimado: 100000, caja_neta: -5000, leche_por_pagar: 10, cartera_pendiente: 20 }) : p));
    // Una quincena FUTURA con una cifra rara no debe entrar.
    año[22] = periodoDe(23, { resultado_estimado: 777 });
    const t = totalesAnio(año, HOY);

    expect(t.quincenas).toBe(19);
    expect(t.ingresos_ventas).toBe(1000000);
    expect(t.resultado_estimado).toBe(630000);
    expect(t.caja_neta).toBe(405000);
    expect(t.leche_por_pagar).toBe(250010);
    expect(t.cartera_pendiente).toBe(371020);
  });

  it('sin quincenas empezadas los totales son 0', () => {
    expect(totalesAnio(AÑO, '2025-01-01')).toMatchObject({ quincenas: 0, resultado_estimado: 0, caja_neta: 0 });
  });

  it('una quincena empieza el mismo día de su fecha_inicio', () => {
    expect(haEmpezado(periodoDe(19), '2026-10-01')).toBe(true);
    expect(haEmpezado(periodoDe(19), '2026-09-30')).toBe(false);
  });

  it('se atenúa solo la futura y en cero', () => {
    expect(esAtenuada(periodoDe(22), '2026-10-14')).toBe(true);
    expect(esAtenuada(periodoDe(22, { resultado_estimado: 5 }), '2026-10-14')).toBe(false);
    expect(esAtenuada(periodoDe(10), '2026-10-14')).toBe(false);
    expect(esAtenuada(OCTUBRE_1, '2026-10-14')).toBe(false);
  });

  it('etiqueta corta: «1 de oct»', () => {
    expect(etiquetaCorta(10, 1)).toBe('1 de oct');
    expect(etiquetaCorta(1, 2)).toBe('2 de ene');
  });
});
