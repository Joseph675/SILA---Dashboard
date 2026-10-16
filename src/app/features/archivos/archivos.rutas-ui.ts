import type { ArbolArchivos } from './models/archivos.models';
import { ARBOLES } from './models/archivos.models';

/** A `:arbol` segment of the URL, if it is one of the four trees (the match is case-insensitive: `/archivos/tipo` works too). */
export function arbolDeUrl(segmento: string | null | undefined): ArbolArchivos | null {
  const mayus = (segmento ?? '').toUpperCase();
  return (ARBOLES as readonly string[]).includes(mayus) ? (mayus as ArbolArchivos) : null;
}
