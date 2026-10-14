export type UnidadInsumo = 'KG' | 'GR' | 'LT' | 'ML' | 'UND' | 'PAQ';
export const UNIDADES_INSUMO: readonly UnidadInsumo[] = ['KG', 'GR', 'LT', 'ML', 'UND', 'PAQ'];

export interface Insumo {
  id_insumo: number;
  codigo: string;
  nombre: string;
  unidad_medida: UnidadInsumo;
  /** Weighted average cost per unit; every purchase recomputes it. */
  costo_promedio: number;
  stock_actual: number;
  stock_minimo: number;
  valor_inventario: number;
  bajo_minimo: boolean;
  productos_que_lo_usan: number;
  activo: boolean;
}

export interface InsumosQuery {
  texto?: string;
  activo?: boolean;
  /** `true` = only the ones at or under the minimum. */
  bajo_minimo?: boolean;
}

export interface InsumoGuardar {
  codigo?: string;
  nombre: string;
  unidad_medida: UnidadInsumo;
  stock_minimo: number;
}

export interface ResumenInsumos {
  total_insumos: number;
  bajo_minimo: number;
  valor_total: number;
}

export type EstadoCompra = 'VIGENTE' | 'ANULADA';

export interface Compra {
  id_compra: number;
  id_insumo: number;
  codigo: string;
  insumo: string;
  unidad_medida: string;
  id_proveedor: number | null;
  proveedor: string | null;
  id_periodo: number;
  /** `AAAA-MM-DD`. */
  fecha: string;
  cantidad: number;
  /** What the invoice says; the unit cost is computed from it. */
  valor_total: number;
  costo_unitario: number;
  referencia: string | null;
  estado: EstadoCompra;
  motivo_anulacion: string | null;
  usuario_registro: string;
  /** UTC, no zone. */
  fecha_registro: string;
}

export interface ComprasQuery {
  id_insumo?: number;
  id_proveedor?: number;
  estado?: EstadoCompra;
  desde?: string;
  hasta?: string;
}

export interface NuevaCompra {
  id_insumo: number;
  id_proveedor?: number;
  cantidad: number;
  valor_total: number;
  referencia?: string;
  fecha?: string;
}

export type TipoAjusteInsumo = 'MERMA' | 'DANO' | 'VENCIMIENTO' | 'CORRECCION_MAS' | 'CORRECCION_MENOS';

export interface AjusteInsumo {
  id_ajuste: number;
  id_insumo: number;
  codigo: string;
  insumo: string;
  unidad_medida: string;
  tipo_ajuste: TipoAjusteInsumo;
  /** Signed: negative takes stock out. */
  cantidad_delta: number;
  valor_delta: number;
  observacion: string;
  usuario_registro: string;
  /** UTC, no zone. */
  fecha_registro: string;
}

export interface AjustesInsumoQuery {
  id_insumo?: number;
  tipo_ajuste?: TipoAjusteInsumo;
  desde?: string;
  hasta?: string;
}

export interface NuevoAjusteInsumo {
  id_insumo: number;
  tipo_ajuste: TipoAjusteInsumo;
  /** Always positive: the type decides the sign. */
  cantidad: number;
  observacion: string;
}

/** What a lote consumed of an insumo, with the cost frozen at that moment. */
export interface ConsumoLote {
  id_consumo: number;
  id_lote: number;
  codigo_lote: string;
  id_insumo: number;
  codigo: string;
  insumo: string;
  unidad_medida: string;
  cantidad: number;
  costo_unitario: number;
  valor: number;
}

export interface TipoAjusteInfo {
  valor: TipoAjusteInsumo;
  etiqueta: string;
  resta: boolean;
  soloAdmin: boolean;
}

export const TIPOS_AJUSTE_INSUMO: readonly TipoAjusteInfo[] = [
  { valor: 'MERMA', etiqueta: 'Merma', resta: true, soloAdmin: false },
  { valor: 'DANO', etiqueta: 'Daño', resta: true, soloAdmin: false },
  { valor: 'VENCIMIENTO', etiqueta: 'Vencimiento', resta: true, soloAdmin: false },
  { valor: 'CORRECCION_MAS', etiqueta: 'Corrección (+)', resta: false, soloAdmin: true },
  { valor: 'CORRECCION_MENOS', etiqueta: 'Corrección (−)', resta: true, soloAdmin: true },
];

export function etiquetaTipoAjusteInsumo(tipo: TipoAjusteInsumo): string {
  return TIPOS_AJUSTE_INSUMO.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
}
