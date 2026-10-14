export type EstadoGasto = 'VIGENTE' | 'ANULADO';

export interface CategoriaGasto {
  id_categoria: number;
  nombre: string;
  activo: boolean;
}

export interface Gasto {
  id_gasto: number;
  id_periodo: number;
  anio: number;
  mes: number;
  quincena: number;
  id_categoria: number;
  categoria: string;
  /** `AAAA-MM-DD`. */
  fecha_gasto: string;
  concepto: string;
  monto: number;
  usuario_registro: string;
  /** UTC, no zone. */
  fecha_registro: string;
  estado: EstadoGasto;
  motivo_anulacion: string | null;
  usuario_anulacion: string | null;
  /** UTC, no zone. */
  fecha_anulacion: string | null;
}

/** Filters shared by the list and the summary card, so both always describe the same expenses. */
export interface GastosQuery {
  id_periodo?: number;
  id_categoria?: number;
  /** Looks in the concept (no accents). */
  texto?: string;
  estado?: EstadoGasto;
  desde?: string;
  hasta?: string;
}

/** Total and count of the VALID (not annulled) expenses that match the filters. */
export interface ResumenGastos {
  total: number;
  cantidad: number;
}

export interface GastoPorCategoria {
  id_periodo: number;
  anio: number;
  mes: number;
  quincena: number;
  categoria: string;
  total_gastos: number;
}

export interface NuevoGasto {
  id_categoria: number;
  /** 3 to 255 characters. */
  concepto: string;
  /** Above 0, 2 decimals. */
  monto: number;
  /** Not in the future; without it, today in Colombia. */
  fecha_gasto?: string;
}
