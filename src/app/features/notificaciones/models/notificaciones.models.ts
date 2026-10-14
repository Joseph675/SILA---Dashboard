export type SeveridadNotificacion = 'CRITICA' | 'ADVERTENCIA';

/** What an alert points at: where to take the person when they open it. */
export type EntidadNotificacion = 'INSUMO' | 'PRODUCTO' | 'LOTE' | 'CLIENTE' | 'PERIODO' | 'DOCUMENTO';

/**
 * One alert. They are COMPUTED when asked for (not stored) and disappear by themselves when the problem is solved.
 * `clave` identifies the alert: a NEW alert brings a `clave` the person has not seen yet.
 */
export interface Notificacion {
  clave: string;
  /** INSUMO_AGOTADO, INSUMO_BAJO, PRODUCTO_AGOTADO, PRODUCTO_BAJO, LOTE_VENCIDO, LOTE_POR_VENCER, CARTERA_VENCIDA, CARTERA_POR_VENCER, PERIODO_SIN_CERRAR, LECHE_POR_PAGAR, DOCUMENTOS_ERROR. */
  tipo: string;
  severidad: SeveridadNotificacion;
  titulo: string;
  detalle: string;
  entidad: EntidadNotificacion | string;
  id_entidad: number | null;
  /** Can be null. */
  fecha: string | null;
}

/** Answer of `GET /notificaciones`: at most 100, the critical ones first. */
export interface Notificaciones {
  total: number;
  criticas: number;
  items: Notificacion[];
}
