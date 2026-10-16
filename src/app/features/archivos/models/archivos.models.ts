import type { PageQuery } from '../../../core/api/page.models';

/** Where a file comes from: made by the system (a voucher PDF) or uploaded by an ADMIN. */
export type OrigenArchivo = 'COMPROBANTE' | 'ADMIN';
export type TipoEntidadArchivo = 'VENTA' | 'ABONO' | 'PAGO_LECHERO' | 'COMPRA_INSUMO' | 'GASTO' | 'ARCHIVO';
export type VersionArchivo = 'ORIGINAL' | 'ANULADO';
/** State of the encrypted backup copy in Google Drive. */
export type EstadoDrive = 'PENDIENTE' | 'SUBIDO' | 'ERROR';
export type MimeArchivo = 'application/pdf' | 'image/jpeg' | 'image/png';

/** `Archivo` of the contract. The internal path never travels; everything about a voucher is null in a file the ADMIN uploaded. */
export interface Archivo {
  id_documento: number;
  origen: OrigenArchivo;
  tipo_entidad: TipoEntidadArchivo;
  /** For an ABONO it is the receipt (`id_recibo`). */
  id_entidad: number | null;
  version: VersionArchivo;
  /** The cancellation PDF points at the original. */
  id_documento_original: number | null;
  nombre_archivo: string;
  mime_type: MimeArchivo | string;
  tamano_bytes: number;
  checksum_sha256: string;
  id_carpeta: number | null;
  carpeta: string | null;
  archivado: boolean;
  motivo_archivo: string | null;
  usuario_archivo: string | null;
  /** UTC without a zone. */
  fecha_archivo: string | null;
  estado_drive: EstadoDrive;
  fecha_drive: string | null;
  usuario_carga: string | null;
  /** UTC without a zone. */
  fecha_registro: string;
  /** The voucher's day (Colombia) or, for an uploaded file, the day it was uploaded. */
  fecha: string;
  numero: string | null;
  sentido: 'INGRESO' | 'EGRESO' | null;
  monto: number | null;
  id_tercero: number | null;
  tercero_tipo: 'CLIENTE' | 'PROVEEDOR' | null;
  tercero: string | null;
  estado_comprobante: 'VIGENTE' | 'ANULADO' | null;
  id_periodo: number | null;
  anio: number | null;
  mes: number | null;
  quincena: number | null;
}

export type ArbolArchivos = 'TIPO' | 'CLIENTE' | 'PROVEEDOR' | 'MANUAL';
export const ARBOLES: readonly ArbolArchivos[] = ['TIPO', 'CLIENTE', 'PROVEEDOR', 'MANUAL'];

/** A folder (or a tree) as the explorer lists it. `clave` is what goes into the next `ruta`. */
export interface EntradaExplorador {
  clave: string;
  nombre: string;
  cantidad: number;
}

export interface Explorador {
  /** Absent at the root. */
  arbol: ArbolArchivos | null;
  /** The breadcrumb: one entry per level already walked, with its NAME. */
  ruta: EntradaExplorador[];
  carpetas: EntradaExplorador[];
  archivos: { items: Archivo[]; total: number; page: number; size: number };
  /** True only in «Mis carpetas» and only for an ADMIN. */
  puede_subir: boolean;
}

export interface ExploradorQuery extends PageQuery {
  arbol?: ArbolArchivos;
  /** The path of KEYS, level by level. */
  ruta?: string[];
  incluir_archivados?: boolean;
}

export interface ArchivosQuery {
  origen?: OrigenArchivo;
  tipo?: TipoEntidadArchivo;
  version?: VersionArchivo;
  archivado?: boolean;
  estado_drive?: EstadoDrive;
  id_carpeta?: number;
  texto?: string;
  desde?: string;
  hasta?: string;
}

export type ModoClave = 'DOCUMENTO' | 'ESCRITA' | 'ALEATORIA';

/** `GET /archivos/{id}/opciones-descarga`. */
export interface OpcionesDescarga {
  documento_disponible: boolean;
  /** Why the identity-document password is not available. */
  motivo_no_disponible: string | null;
  tercero: string | null;
  tercero_tipo: 'CLIENTE' | 'PROVEEDOR' | null;
  /** The document masked (`900***567`). */
  pista_clave_documento: string | null;
  clave_min: number;
  clave_max: number;
  es_imagen: boolean;
}

export interface Carpeta {
  id_carpeta: number;
  id_padre: number | null;
  nombre: string;
  ruta: string;
  nivel: number;
  archivada: boolean;
  motivo_archivo: string | null;
  usuario_archivo: string | null;
  fecha_archivo: string | null;
  usuario_creacion: string;
  fecha_creacion: string;
  n_archivos: number;
  n_subcarpetas: number;
}

export type AccionAcceso = 'VER' | 'DESCARGAR' | 'DESCIFRAR' | 'SUBIR' | 'ARCHIVAR' | 'CARPETA_CREAR' | 'CARPETA_ARCHIVAR' | 'SUBIDA_RECHAZADA';

/** One line of the access log. The password is NEVER here. */
export interface AccesoArchivo {
  id_acceso: number;
  /** UTC without a zone. */
  fecha: string;
  /** Null in `SUBIDA_RECHAZADA` (nothing was saved). */
  id_documento: number | null;
  nombre_archivo: string | null;
  tipo_entidad: string | null;
  id_entidad: number | null;
  version: string | null;
  usuario: string;
  accion: AccionAcceso | string;
  /** Only in `DESCARGAR`. */
  modo_clave: ModoClave | null;
  ip: string | null;
  user_agent: string | null;
  detalle: string | null;
}

export interface AccesosQuery {
  id_documento?: number;
  usuario?: string;
  accion?: AccionAcceso;
}

export interface EstadoDriveRespuesta {
  configurado: boolean;
  conectado: boolean;
  cuenta: string | null;
  carpeta: string | null;
  pendientes: number;
  con_error: number;
  subidos: number;
  ultimo_error: string | null;
  /** UTC without a zone. */
  ultima_sincronizacion: string | null;
}
