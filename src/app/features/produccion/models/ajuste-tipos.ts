import type { TipoAjuste } from './produccion.models';

export interface InfoTipoAjuste {
  valor: TipoAjuste;
  etiqueta: string;
  /** true = takes stock out. */
  resta: boolean;
  /** true = only an ADMIN may register it (the server answers 20008 to anyone else). */
  soloAdmin: boolean;
}

export const TIPOS_AJUSTE: readonly InfoTipoAjuste[] = [
  { valor: 'MERMA', etiqueta: 'Merma', resta: true, soloAdmin: false },
  { valor: 'DANO', etiqueta: 'Daño', resta: true, soloAdmin: false },
  { valor: 'VENCIMIENTO', etiqueta: 'Vencimiento', resta: true, soloAdmin: false },
  { valor: 'MUESTRA', etiqueta: 'Muestra', resta: true, soloAdmin: false },
  { valor: 'INGRESO_INICIAL', etiqueta: 'Ingreso inicial', resta: false, soloAdmin: true },
  { valor: 'CORRECCION_MAS', etiqueta: 'Corrección (+)', resta: false, soloAdmin: true },
  { valor: 'CORRECCION_MENOS', etiqueta: 'Corrección (−)', resta: true, soloAdmin: true },
];

export function etiquetaTipoAjuste(tipo: TipoAjuste): string {
  return TIPOS_AJUSTE.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
}

/** A product as the adjustment and lote dialogs need it; `stock` is shown only when it is known. */
export interface ProductoOpcion {
  id_producto: number;
  nombre: string;
  codigo_sku: string;
  unidad_medida: string;
  stock?: number;
  precio_base?: number;
}
