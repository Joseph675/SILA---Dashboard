import type { ChipTono } from '../../shared/ui/status-chip/status-chip.component';
import type { EstadoCredito } from './models/cartera.models';

export const ESTADOS_CREDITO: readonly EstadoCredito[] = ['AL_DIA', 'VIGENTE', 'EN_MORA', 'EXCEDIDO'];

const CHIPS: Record<EstadoCredito, { texto: string; tono: ChipTono }> = {
  AL_DIA: { texto: 'Al día', tono: 'exito' },
  VIGENTE: { texto: 'Vigente', tono: 'info' },
  EN_MORA: { texto: 'En mora', tono: 'peligro' },
  EXCEDIDO: { texto: 'Excedido', tono: 'peligro' },
};

export function chipEstadoCredito(estado: EstadoCredito): { texto: string; tono: ChipTono } {
  return CHIPS[estado];
}
