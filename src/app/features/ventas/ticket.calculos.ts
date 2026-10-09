import { TotalesLinea, redondear2, tieneMaximoDosDecimales, totalesDeLinea } from '../../shared/utils/dinero';
import type { MetodoPago, NuevaVenta, TipoVenta } from './models/ventas.models';

/** One line of the ticket being built. The quantity stays as typed until it is validated. */
export interface LineaTicket {
  id_producto: number;
  codigo_sku: string;
  producto: string;
  unidad_medida: string;
  cantidadTexto: string;
  precio_unitario: number;
  precio_base: number;
  /** An agreed price applies (`precio_pactado` of the API is not null). */
  pactado: boolean;
  tarifa_iva: number;
  stock: number;
}

export interface PagoFila {
  uid: number;
  metodo: MetodoPago;
  montoTexto: string;
  referencia: string;
}

/** Accepts `1.5` and `1,5`. NaN when it is not a number. */
export function aNumero(texto: string): number {
  const limpio = texto.trim().replace(',', '.');
  return limpio === '' ? NaN : Number(limpio);
}

/** The quantity of a line if it is greater than 0 with at most 2 decimals; otherwise `null`. */
export function cantidadValida(texto: string): number | null {
  const n = aNumero(texto);
  return Number.isFinite(n) && n > 0 && tieneMaximoDosDecimales(n) ? n : null;
}

export interface TotalesTicket {
  lineas: TotalesLinea[];
  subtotal: number;
  iva: number;
  total: number;
}

/** What the server will compute, previewed with the same rule: per line, round the subtotal and then the IVA. */
export function totalesTicket(lineas: readonly LineaTicket[]): TotalesTicket {
  const calculadas = lineas.map((l) => totalesDeLinea(cantidadValida(l.cantidadTexto) ?? 0, l.precio_unitario, l.tarifa_iva));
  const suma = (campo: keyof TotalesLinea) => redondear2(calculadas.reduce((acc, t) => acc + t[campo], 0));
  return { lineas: calculadas, subtotal: suma('subtotal'), iva: suma('iva'), total: suma('total') };
}

/** The amount of a payment row if it is greater than 0 with at most 2 decimals; otherwise `null`. */
export function montoDePago(fila: PagoFila): number | null {
  const n = aNumero(fila.montoTexto);
  return Number.isFinite(n) && n > 0 && tieneMaximoDosDecimales(n) ? n : null;
}

export function totalPagado(pagos: readonly PagoFila[]): number {
  return redondear2(pagos.reduce((acc, p) => acc + (montoDePago(p) ?? 0), 0));
}

/** Positive: still to pay. Negative: the payments exceed the total. Zero: complete. */
export function faltante(total: number, pagos: readonly PagoFila[]): number {
  return redondear2(total - totalPagado(pagos));
}

/** Cash that is applied to the sale (what goes in `pagos`). */
export function efectivoAplicado(pagos: readonly PagoFila[]): number {
  return redondear2(pagos.filter((p) => p.metodo === 'EFECTIVO').reduce((acc, p) => acc + (montoDePago(p) ?? 0), 0));
}

/**
 * Change to give back: cash received minus the cash applied to the sale, when positive.
 * It is a screen calculation only: it is never sent and never saved.
 */
export function cambioDe(recibidoTexto: string, pagos: readonly PagoFila[]): number {
  const recibido = aNumero(recibidoTexto);
  if (!Number.isFinite(recibido)) return 0;
  return Math.max(0, redondear2(recibido - efectivoAplicado(pagos)));
}

/**
 * Body of `POST /ventas`: only product and quantity per line and, for CONTADO, the applied payments.
 * NEVER prices, IVA, totals or change: the server computes them.
 */
export function armarVenta(idCliente: number, tipo: TipoVenta, lineas: readonly LineaTicket[], pagos: readonly PagoFila[]): NuevaVenta {
  const cuerpo: NuevaVenta = {
    id_cliente: idCliente,
    tipo_venta: tipo,
    lineas: lineas.map((l) => ({ id_producto: l.id_producto, cantidad: cantidadValida(l.cantidadTexto) ?? 0 })),
  };
  if (tipo === 'CONTADO') {
    cuerpo.pagos = pagos.map((p) => {
      const referencia = p.referencia.trim();
      return { metodo_pago: p.metodo, monto: montoDePago(p) ?? 0, ...(referencia ? { referencia } : {}) };
    });
  }
  return cuerpo;
}
