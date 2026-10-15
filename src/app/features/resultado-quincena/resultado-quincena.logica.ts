import type { Periodo } from '../periodos/models/periodos.models';

/** One line of a cascade: `signo` says how it enters the total; `detalle` lines are a part of the one above. */
export interface LineaCascada {
  clave: string;
  etiqueta: string;
  valor: number;
  signo: '+' | '−';
  detalle?: boolean;
}

export interface Cascada {
  lineas: LineaCascada[];
  /** The total the SERVER sends (not recomputed here). */
  total: number;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/** What the quincena EARNED: sales (no IVA) − production cost − expenses − written-off portfolio = `resultado_estimado`. */
export function cascadaResultado(p: Periodo): Cascada {
  return {
    total: p.resultado_estimado,
    lineas: [
      { clave: 'ingresos_ventas', etiqueta: 'Ventas sin IVA', valor: p.ingresos_ventas, signo: '+' },
      { clave: 'costo_produccion', etiqueta: 'Costo de producción', valor: p.costo_produccion, signo: '−' },
      { clave: 'gastos_operativos', etiqueta: 'Gastos', valor: p.gastos_operativos, signo: '−' },
      { clave: 'cartera_castigada', etiqueta: 'Cartera castigada', valor: p.cartera_castigada, signo: '−' },
    ],
  };
}

/** The CASH that came in and went out: collected − paid to lecheros − insumo purchases − expenses = `caja_neta`. */
export function cascadaCaja(p: Periodo): Cascada {
  return {
    total: p.caja_neta,
    lineas: [
      { clave: 'total_cobrado', etiqueta: 'Cobrado', valor: p.total_cobrado, signo: '+' },
      { clave: 'cobrado_contado', etiqueta: 'De ventas de contado', valor: p.cobrado_contado, signo: '+', detalle: true },
      { clave: 'cobrado_abonos', etiqueta: 'De abonos de cartera', valor: p.cobrado_abonos, signo: '+', detalle: true },
      { clave: 'pagos_proveedores_caja', etiqueta: 'Pagos a lecheros', valor: p.pagos_proveedores_caja, signo: '−' },
      { clave: 'compras_insumos', etiqueta: 'Compras de insumos', valor: p.compras_insumos, signo: '−' },
      { clave: 'gastos_operativos', etiqueta: 'Gastos', valor: p.gastos_operativos, signo: '−' },
    ],
  };
}

/** The sum of the lines that enter the total (the `detalle` lines are only a breakdown). Used to check a cascade, never shown as the result. */
export function sumaDeLineas(c: Cascada): number {
  return redondear(c.lineas.filter((l) => !l.detalle).reduce((s, l) => s + (l.signo === '+' ? l.valor : -l.valor), 0));
}

/** The quincena has started: its first day is today or earlier (today = `AAAA-MM-DD` in Colombia). ISO days compare as text. */
export function haEmpezado(p: Pick<Periodo, 'fecha_inicio'>, hoy: string): boolean {
  return p.fecha_inicio <= hoy;
}

/** A future quincena with nothing in it: drawn faded in the chart. */
export function esAtenuada(p: Periodo, hoy: string): boolean {
  return !haEmpezado(p, hoy) && p.resultado_estimado === 0 && p.caja_neta === 0;
}

/** The year to open: the one of the current quincena, else the latest year that has quincenas, else none. */
export function anioPorDefecto(anios: readonly number[], actual: Pick<Periodo, 'anio'> | null): number | null {
  if (actual && anios.includes(actual.anio)) return actual.anio;
  return anios.length > 0 ? Math.max(...anios) : null;
}

/**
 * The quincena to select in a year: the current one if it is in that year; otherwise the LAST one that already started;
 * if none started (a future year), the first. Empty year: `null`.
 */
export function quincenaPorDefecto(periodos: readonly Periodo[], actual: Pick<Periodo, 'id_periodo'> | null, hoy: string): Periodo | null {
  if (periodos.length === 0) return null;
  const deHoy = actual ? periodos.find((p) => p.id_periodo === actual.id_periodo) : undefined;
  if (deHoy) return deHoy;
  const empezadas = periodos.filter((p) => haEmpezado(p, hoy));
  return empezadas.length > 0 ? empezadas[empezadas.length - 1] : periodos[0];
}

export interface TotalesAnio {
  quincenas: number;
  ingresos_ventas: number;
  resultado_estimado: number;
  caja_neta: number;
  leche_por_pagar: number;
  cartera_pendiente: number;
}

/** Totals of the year: ONLY the quincenas that already started (the future ones are all zeros anyway). */
export function totalesAnio(periodos: readonly Periodo[], hoy: string): TotalesAnio {
  const empezadas = periodos.filter((p) => haEmpezado(p, hoy));
  const suma = (campo: keyof Periodo) => redondear(empezadas.reduce((s, p) => s + (p[campo] as number), 0));
  return {
    quincenas: empezadas.length,
    ingresos_ventas: suma('ingresos_ventas'),
    resultado_estimado: suma('resultado_estimado'),
    caja_neta: suma('caja_neta'),
    leche_por_pagar: suma('leche_por_pagar'),
    cartera_pendiente: suma('cartera_pendiente'),
  };
}

const MES_CORTO = new Intl.DateTimeFormat('es-CO', { month: 'short' });

/** `(10, 1)` -> `1 de oct`. */
export function etiquetaCorta(mes: number, quincena: number): string {
  return `${quincena} de ${MES_CORTO.format(new Date(2000, mes - 1, 1)).replace('.', '')}`;
}

/** Index of the neighbour of the selected quincena (−1 before, +1 after), or `null` at the ends of the year. */
export function vecina(periodos: readonly Periodo[], idSeleccionada: number | null, paso: -1 | 1): Periodo | null {
  const i = periodos.findIndex((p) => p.id_periodo === idSeleccionada);
  return i < 0 ? null : (periodos[i + paso] ?? null);
}
