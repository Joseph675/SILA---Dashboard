import type { PageQuery } from '../../../core/api/page.models';

/*
 * Read-only logs. Times arrive in UTC without a zone: show them with `formatoFechaHora`.
 * The `desde` / `hasta` filters are UTC DAYS (`AAAA-MM-DD`, both ends included).
 */

/** `GET /auditoria/accesos` */
export interface AccesoAuditoria {
  id_evento: number;
  fecha: string;
  usuario: string | null;
  evento: string;
  ip: string | null;
  user_agent: string | null;
  detalle: string | null;
}

/** `GET /auditoria/cambios` (`id_registro` comes as text). */
export interface CambioAuditoria {
  id_auditoria: number;
  fecha: string;
  usuario: string | null;
  tabla: string;
  id_registro: string | null;
  columna: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
}

/** `GET /auditoria/errores`. `id_log` is the `support_ref` the user saw; `codigo_error` can be negative (ORA codes). */
export interface ErrorAuditoria {
  id_log: number;
  fecha: string;
  usuario: string | null;
  unidad: string | null;
  codigo_error: number | null;
  mensaje: string | null;
  contexto: string | null;
}

export interface RangoFechas {
  desde?: string;
  hasta?: string;
}

export interface AccesosQuery extends PageQuery, RangoFechas {
  usuario?: string;
  /** The API takes ONE event (a comma-separated list matches nothing). */
  evento?: string;
  /** Exact match. */
  ip?: string;
}

export interface CambiosQuery extends PageQuery, RangoFechas {
  usuario?: string;
  tabla?: string;
  columna?: string;
}

export interface ErroresQuery extends PageQuery, RangoFechas {
  usuario?: string;
  unidad?: string;
  codigo_error?: number;
}
