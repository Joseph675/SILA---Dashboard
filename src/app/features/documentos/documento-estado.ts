import type { ChipTono } from '../../shared/ui/status-chip/status-chip.component';
import type { EstadoCarga } from './models/documentos.models';

const ESTADOS: Record<EstadoCarga, { texto: string; tono: ChipTono }> = {
  PENDIENTE: { texto: 'Pendiente', tono: 'alerta' },
  SUBIDO: { texto: 'Subido', tono: 'exito' },
  ERROR: { texto: 'Error', tono: 'peligro' },
};

export function chipEstadoCarga(estado: EstadoCarga): { texto: string; tono: ChipTono } {
  return ESTADOS[estado];
}

/** Only an http(s) link is offered, so a `javascript:` URL can never become a clickable link. */
export function enlaceSeguro(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}
