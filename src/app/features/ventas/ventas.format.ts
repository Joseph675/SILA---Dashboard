import type { ChipTono } from '../../shared/ui/status-chip/status-chip.component';
import type { EstadoPago, MetodoPago, TipoVenta } from './models/ventas.models';

export const METODOS_PAGO: readonly { valor: MetodoPago; etiqueta: string; pideReferencia: boolean }[] = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo', pideReferencia: false },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia', pideReferencia: true },
  { valor: 'TARJETA', etiqueta: 'Tarjeta', pideReferencia: true },
  { valor: 'CHEQUE', etiqueta: 'Cheque', pideReferencia: true },
  { valor: 'OTRO', etiqueta: 'Otro', pideReferencia: false },
];

export function etiquetaMetodo(metodo: MetodoPago): string {
  return METODOS_PAGO.find((m) => m.valor === metodo)?.etiqueta ?? metodo;
}

export function etiquetaTipoVenta(tipo: TipoVenta): string {
  return tipo === 'CONTADO' ? 'Contado' : 'Crédito';
}

const ESTADOS: Record<EstadoPago, { texto: string; tono: ChipTono }> = {
  PAGADA: { texto: 'Pagada', tono: 'exito' },
  PENDIENTE: { texto: 'Pendiente', tono: 'alerta' },
  ANULADA: { texto: 'Anulada', tono: 'peligro' },
  CASTIGADA: { texto: 'Castigada', tono: 'castigado' },
};

export function chipEstadoPago(estado: EstadoPago): { texto: string; tono: ChipTono } {
  return ESTADOS[estado];
}
