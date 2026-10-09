/** Where to go after signing in when there is no valid `?return=`. */
export const URL_INICIO = '/';

/**
 * Validates the `?return=` URL so the login cannot be used as an open
 * redirect: only app-internal absolute paths are accepted. Rejects
 * `//host`, `/\\host` (browsers read it as `//host`), any scheme (`https:`,
 * `javascript:`) and control characters; the login itself is never a target.
 */
export function urlRetornoSegura(valor: string | null | undefined): string {
  if (!valor || !valor.startsWith('/')) return URL_INICIO;
  if (valor.startsWith('//') || valor.includes('\\') || valor.includes(':')) return URL_INICIO;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(valor)) return URL_INICIO;
  if (valor === '/login' || valor.startsWith('/login?') || valor.startsWith('/login/')) return URL_INICIO;
  return valor;
}
