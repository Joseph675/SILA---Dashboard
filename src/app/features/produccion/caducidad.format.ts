import type { ChipTono } from '../../shared/ui/status-chip/status-chip.component';
import type { NivelAlerta } from './models/produccion.models';

/** VENCIDO / CRITICO are danger, PROXIMO is a warning, no level means no chip. */
export function tonoNivel(nivel: NivelAlerta | null): ChipTono | null {
  if (nivel === 'VENCIDO' || nivel === 'CRITICO') return 'peligro';
  return nivel === 'PROXIMO' ? 'alerta' : null;
}

export function etiquetaNivel(nivel: NivelAlerta | null): string {
  if (nivel === null) return '';
  return nivel === 'VENCIDO' ? 'Vencido' : nivel === 'CRITICO' ? 'Crítico' : 'Próximo';
}

/** `-3` -> "Venció hace 3 días", `0` -> "Vence hoy", `1` -> "1 día". */
export function textoDias(dias: number): string {
  const n = Math.abs(dias);
  const unidad = n === 1 ? 'día' : 'días';
  if (dias < 0) return `Venció hace ${n} ${unidad}`;
  return dias === 0 ? 'Vence hoy' : `${n} ${unidad}`;
}
