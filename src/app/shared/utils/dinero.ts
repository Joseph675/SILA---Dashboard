/** Money rules shared by the sales screens. The SERVER is the authority; these only preview what it will compute. */

/** Rounds to 2 decimals the way the database does (half away from zero), avoiding float noise like 1.005. */
export function redondear2(valor: number): number {
  const signo = valor < 0 ? -1 : 1;
  return (signo * Math.round(Math.abs(valor) * 100 + 1e-9)) / 100;
}

export interface TotalesLinea {
  subtotal: number;
  iva: number;
  total: number;
}

/** Per line: `subtotal = round(cantidad × precio, 2)`, `IVA = round(subtotal × tarifa / 100, 2)`. */
export function totalesDeLinea(cantidad: number, precio: number, tarifaIva: number): TotalesLinea {
  const subtotal = redondear2(cantidad * precio);
  const iva = redondear2((subtotal * tarifaIva) / 100);
  return { subtotal, iva, total: redondear2(subtotal + iva) };
}

/** True when the number has at most 2 decimals. */
export function tieneMaximoDosDecimales(valor: number): boolean {
  return Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;
}
