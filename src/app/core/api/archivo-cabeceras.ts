import type { HttpHeaders } from '@angular/common/http';

/** What the binary answers of `/archivos/**` carry besides the bytes. */
export interface RespuestaArchivo {
  blob: Blob;
  /** The file name the server chose (already decoded, accents included). `null` if the answer carried none. */
  nombre: string | null;
  /** `X-Archivo-Id`: the document the bytes belong to (only when the database knows it). */
  idArchivo: number | null;
  /** `X-Clave-Generada`: the random password of a `ALEATORIA` download. Shown once, never stored. */
  claveGenerada: string | null;
}

function decodificar(texto: string): string | null {
  try {
    return decodeURIComponent(texto);
  } catch {
    return null;
  }
}

/**
 * The file name of a binary answer. Order: `filename*=UTF-8''…` of `Content-Disposition` (percent-encoded UTF-8, the one that
 * keeps accents), the plain `filename="…"`, and `X-Archivo-Nombre` (percent-encoded). A path (`a/b.pdf`) is cut to its last
 * segment so a name can never be a route.
 */
export function nombreDeCabeceras(headers: Pick<HttpHeaders, 'get'>): string | null {
  const disposicion = headers.get('Content-Disposition') ?? '';
  const extendido = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i.exec(disposicion);
  const simple = /filename\s*=\s*"((?:[^"\\]|\\.)*)"|filename\s*=\s*([^;\s]+)/i.exec(disposicion.replace(/filename\*\s*=\s*[^;]+;?/i, ''));
  const candidatos = [
    extendido ? decodificar(extendido[1].trim()) : null,
    simple ? (simple[1] ?? simple[2] ?? '').replace(/\\(.)/g, '$1') : null,
    headers.get('X-Archivo-Nombre') ? decodificar(headers.get('X-Archivo-Nombre')!) : null,
  ];
  const nombre = candidatos.find((n): n is string => !!n && n.trim() !== '');
  return nombre ? (nombre.split(/[\\/]/).pop() ?? nombre).trim() : null;
}

export function respuestaDeArchivo(blob: Blob, headers: Pick<HttpHeaders, 'get'>): RespuestaArchivo {
  const id = Number(headers.get('X-Archivo-Id'));
  return {
    blob,
    nombre: nombreDeCabeceras(headers),
    idArchivo: Number.isInteger(id) && id > 0 ? id : null,
    claveGenerada: headers.get('X-Clave-Generada') || null,
  };
}
