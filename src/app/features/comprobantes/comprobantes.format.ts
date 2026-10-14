import type { ChipTono } from '../../shared/ui/status-chip/status-chip.component';
import { formatoCop } from '../../shared/utils/formato-co';
import type { Comprobante, EstadoComprobante, SentidoComprobante, TipoComprobante } from './models/comprobantes.models';

export const TIPOS_COMPROBANTE: readonly { valor: TipoComprobante; etiqueta: string }[] = [
  { valor: 'VENTA', etiqueta: 'Venta' },
  { valor: 'ABONO', etiqueta: 'Abono' },
  { valor: 'PAGO_LECHERO', etiqueta: 'Pago a lecheros' },
  { valor: 'COMPRA_INSUMO', etiqueta: 'Compra de insumos' },
  { valor: 'GASTO', etiqueta: 'Gasto' },
];

export const SENTIDOS_COMPROBANTE: readonly { valor: SentidoComprobante; etiqueta: string }[] = [
  { valor: 'INGRESO', etiqueta: 'Ingresos' },
  { valor: 'EGRESO', etiqueta: 'Egresos' },
];

export const ESTADOS_COMPROBANTE: readonly { valor: EstadoComprobante; etiqueta: string }[] = [
  { valor: 'VIGENTE', etiqueta: 'Vigentes' },
  { valor: 'ANULADO', etiqueta: 'Anulados' },
];

export function etiquetaTipoComprobante(tipo: TipoComprobante): string {
  return TIPOS_COMPROBANTE.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
}

/** The server sends `COMPRA_INSUMO #25`; on screen the underscore is a space (`COMPRA INSUMO #25`). The data itself is untouched. */
export function numeroLegible(numero: string): string {
  return numero.replace(/_/g, ' ');
}

const METODOS: Record<string, string> = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta', CHEQUE: 'Cheque', OTRO: 'Otro', VARIOS: 'Varios medios' };

/** The method can be `VARIOS` or null (then `—`). Unknown values are shown as they come. */
export function etiquetaMetodoComprobante(metodo: string | null | undefined): string {
  return metodo ? (METODOS[metodo] ?? metodo) : '—';
}

/** Income `+ $ 1.000` in green, expense `− $ 1.000` (true minus sign) in red. Same sign for an annulled one (the row is struck through). */
export function montoConSigno(c: Pick<Comprobante, 'sentido' | 'monto'>): { texto: string; clase: string } {
  const ingreso = c.sentido === 'INGRESO';
  return { texto: `${ingreso ? '+' : '−'} ${formatoCop(Math.abs(c.monto))}`, clase: ingreso ? 'text-success' : 'text-destructive' };
}

export function chipEstadoComprobante(estado: EstadoComprobante): { texto: string; tono: ChipTono } {
  return estado === 'ANULADO' ? { texto: 'Anulado', tono: 'peligro' } : { texto: 'Vigente', tono: 'exito' };
}

const TIPOS_VALIDOS = new Set<string>(TIPOS_COMPROBANTE.map((t) => t.valor));

/** `VENTA-123` (the `?ver=` parameter of the page). The types use `_`, never `-`. */
export function claveDocumento(tipo: TipoComprobante, id: number): string {
  return `${tipo}-${id}`;
}

export function leerDocumento(clave: string | null | undefined): { tipo: TipoComprobante; id: number } | null {
  const m = /^([A-Z_]+)-(\d+)$/.exec(clave ?? '');
  if (!m || !TIPOS_VALIDOS.has(m[1]) || Number(m[2]) <= 0) return null;
  return { tipo: m[1] as TipoComprobante, id: Number(m[2]) };
}
