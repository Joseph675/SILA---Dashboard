/** es-CO display formatters. Data always travels as numbers and ISO dates; only the screen uses these. */

const COP_ENTERO = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const COP_DECIMAL = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUMERO = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/** `1234567` -> `$ 1.234.567`, `1234.5` -> `$ 1.234,50` (no decimals when they are ,00). */
export function formatoCop(valor: number): string {
  return (Number.isInteger(valor) ? COP_ENTERO : COP_DECIMAL).format(valor);
}

/** `1234.5` -> `1.234,5` */
export function formatoNumero(valor: number): string {
  return NUMERO.format(valor);
}

/** `2026-09-29` or an ISO timestamp -> `29/09/2026` */
export function formatoFecha(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

const FECHA_HORA_BOGOTA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * The API sends timestamps in UTC WITHOUT a zone (`2026-10-09T03:45:05`).
 * They are read as UTC and shown in Colombia time: `08/10/2026 22:45`.
 * An empty value gives `—`.
 */
export function formatoFechaHora(utcSinZona: string | null | undefined): string {
  if (!utcSinZona) return '—';
  const conZona = /(Z|[+-]\d{2}:?\d{2})$/.test(utcSinZona) ? utcSinZona : `${utcSinZona}Z`;
  const fecha = new Date(conZona);
  if (Number.isNaN(fecha.getTime())) return '—';
  const partes = Object.fromEntries(FECHA_HORA_BOGOTA.formatToParts(fecha).map((p) => [p.type, p.value]));
  return `${partes['day']}/${partes['month']}/${partes['year']} ${partes['hour']}:${partes['minute']}`;
}

/** `Ana María Pérez` -> `AM` (first two words). */
export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('');
}

