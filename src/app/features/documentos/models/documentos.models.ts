export type TipoEntidadDocumento = 'FACTURA' | 'NOTA_CREDITO' | 'RECEPCION_LECHE';
export type EstadoCarga = 'PENDIENTE' | 'SUBIDO' | 'ERROR';

export const TIPOS_ENTIDAD: readonly { valor: TipoEntidadDocumento; etiqueta: string }[] = [
  { valor: 'FACTURA', etiqueta: 'Factura' },
  { valor: 'NOTA_CREDITO', etiqueta: 'Nota crédito' },
  { valor: 'RECEPCION_LECHE', etiqueta: 'Recepción de leche' },
];

export function etiquetaTipoEntidad(tipo: TipoEntidadDocumento): string {
  return TIPOS_ENTIDAD.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
}

/** A document in the Google Drive queue. The backend only keeps the record and its state; the upload itself is done by the caller. */
export interface Documento {
  id_documento: number;
  tipo_entidad: TipoEntidadDocumento;
  id_entidad: number;
  nombre_archivo: string;
  mime_type: string;
  drive_url: string | null;
  checksum_sha256: string | null;
  estado_carga: EstadoCarga;
  intentos: number;
  ultimo_error: string | null;
  usuario_carga: string | null;
  /** UTC, no zone. */
  fecha_registro: string;
  /** UTC, no zone. */
  fecha_carga: string | null;
}

export interface DocumentosQuery {
  tipo_entidad?: TipoEntidadDocumento;
  id_entidad?: number;
  estado_carga?: EstadoCarga;
}

export interface NuevoDocumento {
  tipo_entidad: TipoEntidadDocumento;
  id_entidad: number;
  nombre_archivo: string;
  /** Default `application/pdf`. */
  mime_type?: string;
}

export interface DocumentoSubido {
  drive_file_id: string;
  drive_url?: string;
  /** 64 hexadecimal characters. */
  checksum_sha256?: string;
}
