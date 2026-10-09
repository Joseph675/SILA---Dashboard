const MES_LARGO = new Intl.DateTimeFormat('es-CO', { month: 'long' });
const MES_CORTO = new Intl.DateTimeFormat('es-CO', { month: 'short' });

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** `(10, 1)` -> `Octubre · 1.ª quincena` */
export function etiquetaQuincena(mes: number, quincena: number): string {
  return `${mayuscula(MES_LARGO.format(new Date(2000, mes - 1, 1)))} · ${quincena}.ª quincena`;
}

/** `(10, 1, 2026)` -> `Quincena 1 · oct 2026` (for the header chip). */
export function etiquetaQuincenaCorta(mes: number, quincena: number, anio: number): string {
  const mesCorto = MES_CORTO.format(new Date(2000, mes - 1, 1)).replace('.', '');
  return `Quincena ${quincena} · ${mesCorto} ${anio}`;
}
