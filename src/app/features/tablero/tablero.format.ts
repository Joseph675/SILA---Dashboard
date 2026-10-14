import { formatoFecha } from '../../shared/utils/formato-co';
import type { VentaDia } from './models/tablero.models';

const COP_SIN_DECIMALES = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Whole pesos for the big cards: `423114.24` -> `$ 423.114`, `-226885.76` -> `-$ 226.886`. */
export function formatoPesos(valor: number): string {
  return COP_SIN_DECIMALES.format(valor);
}

const DIA_SEMANA = new Intl.DateTimeFormat('es-CO', { weekday: 'long' });
const MES = new Intl.DateTimeFormat('es-CO', { month: 'long' });
const DIA_CORTO = new Intl.DateTimeFormat('es-CO', { weekday: 'short' });

/** A `AAAA-MM-DD` day as a local date (never through UTC, so the day cannot shift). */
function aFecha(iso: string): Date {
  const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

/** `2026-10-14` -> `miércoles 14 de octubre`. */
export function fechaLarga(iso: string): string {
  const f = aFecha(iso);
  return `${DIA_SEMANA.format(f)} ${f.getDate()} de ${MES.format(f)}`;
}

/** `(10, 1, 2026)` -> `Quincena 1 de octubre 2026`. */
export function tituloQuincena(mes: number, quincena: number, anio: number): string {
  return `Quincena ${quincena} de ${MES.format(new Date(2000, mes - 1, 1))} ${anio}`;
}

/** `2026-10-14` -> `mié 14` (the label of a bar). */
export function etiquetaDia(iso: string): string {
  const f = aFecha(iso);
  return `${DIA_CORTO.format(f).replace('.', '')} ${f.getDate()}`;
}

/** A negative figure is red AND carries its minus sign (never color alone). */
export function claseNeto(valor: number): string {
  return valor < 0 ? 'text-destructive' : '';
}

const HORA = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** `HH:mm` in Colombia time. */
export function horaCo(fecha: Date): string {
  return HORA.format(fecha);
}

/** The 7 bars: label, total and count of sales per day. The last one is today and zero days are kept. */
export function datosGrafica(semana: readonly VentaDia[]): { etiquetas: string[]; totales: number[]; cantidades: number[]; fechas: string[] } {
  return {
    etiquetas: semana.map((d, i) => (i === semana.length - 1 ? 'Hoy' : etiquetaDia(d.fecha))),
    totales: semana.map((d) => d.total),
    cantidades: semana.map((d) => d.cantidad),
    fechas: semana.map((d) => formatoFecha(d.fecha)),
  };
}
