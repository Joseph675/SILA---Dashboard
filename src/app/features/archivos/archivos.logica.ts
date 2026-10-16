import { causaDe, isApiError } from '../../core/api/api-error';
import { etiquetaTipoComprobante } from '../comprobantes/comprobantes.format';
import type { Archivo, ArbolArchivos, EntradaExplorador, ModoClave, TipoEntidadArchivo } from './models/archivos.models';

/** 10 MB, as the server (it checks again, and looks at the real content: this is only to save a trip). */
export const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024;
export const EXTENSIONES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png'] as const;
export const ACCEPT_SUBIDA = '.pdf,.jpg,.jpeg,.png';
export const ACCEPT_SILA = '.sila';
/** A `.sila` file from Drive: a bit larger than the original (it carries the encryption envelope). */
export const TAMANO_MAXIMO_SILA_BYTES = 11 * 1024 * 1024;

export const NOMBRES_ARBOL: Record<ArbolArchivos, string> = { TIPO: 'Por tipo', CLIENTE: 'Por cliente', PROVEEDOR: 'Por proveedor', MANUAL: 'Mis carpetas' };

export function extensionDe(nombre: string): string {
  const i = nombre.lastIndexOf('.');
  return i < 0 ? '' : nombre.slice(i + 1).toLowerCase();
}

/** `null` if the file can go up; otherwise the sentence to show. The server decides in the end (it reads the real bytes). */
export function validarArchivoParaSubir(archivo: Pick<File, 'name' | 'size'>): string | null {
  if (!(EXTENSIONES_PERMITIDAS as readonly string[]).includes(extensionDe(archivo.name))) return 'Solo se admiten archivos PDF, JPG o PNG.';
  if (archivo.size <= 0) return 'El archivo está vacío.';
  if (archivo.size > TAMANO_MAXIMO_BYTES) return 'El archivo supera 10 MB.';
  return null;
}

export function validarArchivoSila(archivo: Pick<File, 'name' | 'size'>): string | null {
  if (extensionDe(archivo.name) !== 'sila') return 'Elige un archivo que termine en .sila (el que bajó de Google Drive).';
  if (archivo.size <= 0) return 'El archivo está vacío.';
  if (archivo.size > TAMANO_MAXIMO_SILA_BYTES) return 'El archivo supera 11 MB.';
  return null;
}

export interface FalloLegible {
  mensaje: string;
  /** Only the antivirus being down (503): the file was NOT saved and trying again later can work. */
  reintentable: boolean;
}

/**
 * The text for a failed upload. The server's own `message` is meant for the user (422 says whether it was the type, the extension,
 * the antivirus or an active PDF; 409 an archived folder), so it is shown as it is; only the antivirus down (20019) gets the fixed
 * sentence and a retry, and a body-less 413 already comes with its text from the error interceptor.
 */
export function describirFalloSubida(fallo: unknown): FalloLegible {
  const e = causaDe(fallo);
  if (isApiError(e)) {
    if (e.code === 20019) return { mensaje: 'El antivirus no está disponible; el archivo no se guardó. Intente en unos minutos.', reintentable: true };
    return { mensaje: e.message, reintentable: false };
  }
  return { mensaje: 'No se pudo subir el archivo. Intenta de nuevo.', reintentable: false };
}

const UNIDADES = ['B', 'KB', 'MB', 'GB'];

/** `10485760` -> `10 MB`, `1536` -> `1,5 KB`. */
export function formatoTamano(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  let valor = bytes;
  let i = 0;
  while (valor >= 1024 && i < UNIDADES.length - 1) {
    valor /= 1024;
    i++;
  }
  const texto = i === 0 || Number.isInteger(valor) ? String(Math.round(valor)) : valor.toFixed(1).replace('.', ',');
  return `${texto} ${UNIDADES[i]}`;
}

export const esImagen = (mime: string): boolean => mime === 'image/jpeg' || mime === 'image/png';
export const esPdf = (mime: string): boolean => mime === 'application/pdf';

export function etiquetaTipoArchivo(tipo: TipoEntidadArchivo): string {
  return tipo === 'ARCHIVO' ? 'Archivo subido' : etiquetaTipoComprobante(tipo);
}

/** A voucher shows its number (`VENTA #12`) and, if it is the cancellation PDF, says so; an uploaded file shows its name. */
export function tituloArchivo(a: Pick<Archivo, 'numero' | 'nombre_archivo' | 'version'>): string {
  if (!a.numero) return a.nombre_archivo;
  return `${a.numero.replace(/_/g, ' ')}${a.version === 'ANULADO' ? ' · anulación' : ''}`;
}

export interface InsigniaArchivo {
  texto: string;
  tono: 'peligro' | 'neutro' | 'alerta';
}

/** `ANULADO` in red, `Archivado` in grey, and `Sin respaldo en Drive` while the encrypted copy is not up (`estado_drive != SUBIDO`). */
export function insigniasDe(a: Pick<Archivo, 'version' | 'estado_comprobante' | 'archivado' | 'estado_drive'>): InsigniaArchivo[] {
  const lista: InsigniaArchivo[] = [];
  if (a.version === 'ANULADO' || a.estado_comprobante === 'ANULADO') lista.push({ texto: 'ANULADO', tono: 'peligro' });
  if (a.archivado) lista.push({ texto: 'Archivado', tono: 'neutro' });
  if (a.estado_drive !== 'SUBIDO') lista.push({ texto: 'Sin respaldo en Drive', tono: 'alerta' });
  return lista;
}

/** The keys of a path as the URL carries them (`?ruta=VENTA&ruta=2026`), without empties. */
export function rutaDeQuery(valores: readonly string[]): string[] {
  return valores.map((v) => v.trim()).filter((v) => v !== '');
}

/** The path of the explorer one level deeper than `ruta`, keys only. */
export function rutaMasProfunda(ruta: readonly EntradaExplorador[], clave: string): string[] {
  return [...ruta.map((e) => e.clave), clave];
}

/** A password of your own: within the length the server states. */
export function validarClaveEscrita(clave: string, min: number, max: number): string | null {
  if (clave.length < min) return `La clave debe tener al menos ${min} caracteres.`;
  if (clave.length > max) return `La clave no puede pasar de ${max} caracteres.`;
  return null;
}

export const ETIQUETA_MODO: Record<ModoClave, string> = { DOCUMENTO: 'Documento de identidad', ESCRITA: 'Clave escrita', ALEATORIA: 'Clave aleatoria' };

export function nombreDescarga(base: string | null, respaldo: string): string {
  return (base ?? respaldo).replace(/[\\/]/g, '_');
}
