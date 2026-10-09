const NAVEGADORES: readonly [RegExp, string][] = [
  [/edg(e|a|ios)?\//i, 'Edge'],
  [/opr\/|opera/i, 'Opera'],
  [/firefox\/|fxios\//i, 'Firefox'],
  [/chrome\/|crios\//i, 'Chrome'],
  // Safari says "Safari" but so does Chrome: it is only Safari when none of the above matched.
  [/safari\//i, 'Safari'],
];

const SISTEMAS: readonly [RegExp, string][] = [
  [/windows/i, 'Windows'],
  [/android/i, 'Android'],
  [/iphone|ipad|ipod/i, 'iOS'],
  [/cros/i, 'ChromeOS'],
  [/mac os x|macintosh/i, 'macOS'],
  [/linux|x11/i, 'Linux'],
];

export const DISPOSITIVO_DESCONOCIDO = 'Dispositivo desconocido';

/**
 * A short, readable device name from the `User-Agent`: `Chrome en Windows`.
 * Deliberately simple (a few patterns, not a parser): when the browser is not
 * recognized it says `Dispositivo desconocido`; the full text goes in a `title`.
 */
export function describirDispositivo(userAgent: string | null | undefined): string {
  if (!userAgent) return DISPOSITIVO_DESCONOCIDO;
  const navegador = NAVEGADORES.find(([patron]) => patron.test(userAgent))?.[1];
  if (!navegador) return DISPOSITIVO_DESCONOCIDO;
  const sistema = SISTEMAS.find(([patron]) => patron.test(userAgent))?.[1];
  return sistema ? `${navegador} en ${sistema}` : navegador;
}
