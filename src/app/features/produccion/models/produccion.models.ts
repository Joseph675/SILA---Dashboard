export type NivelAlerta = 'VENCIDO' | 'CRITICO' | 'PROXIMO';

export interface Lote {
  id_lote: number;
  codigo_lote: string;
  id_producto: number;
  producto: string;
  codigo_sku: string;
  unidad_medida: string;
  /** `AAAA-MM-DD`. */
  fecha_produccion: string;
  litros_leche_usados: number;
  cantidad_obtenida: number;
  porcentaje_rendimiento: number;
  costo_total: number;
  costo_unitario: number;
  fecha_vencimiento: string;
  dias_restantes: number;
  /** Only when 7 days or fewer remain. */
  nivel_alerta: NivelAlerta | null;
  usuario_registro: string;
  /** UTC, no zone. */
  fecha_registro: string;
}

export interface LotesQuery {
  texto?: string;
  id_producto?: number;
  desde?: string;
  hasta?: string;
}

export interface NuevoLote {
  id_producto: number;
  litros_leche_usados: number;
  cantidad_obtenida: number;
  costo_por_litro: number;
  fecha_produccion?: string;
  fecha_vencimiento?: string;
}

export type TipoAjuste = 'MERMA' | 'DANO' | 'VENCIMIENTO' | 'MUESTRA' | 'INGRESO_INICIAL' | 'CORRECCION_MAS' | 'CORRECCION_MENOS';

export interface Ajuste {
  id_ajuste: number;
  id_producto: number;
  producto: string;
  codigo_sku: string;
  unidad_medida: string;
  tipo_ajuste: TipoAjuste;
  /** Signed: negative takes stock out. */
  cantidad_delta: number;
  observacion: string;
  usuario_registro: string;
  /** UTC, no zone. */
  fecha_registro: string;
}

export interface AjustesQuery {
  id_producto?: number;
  tipo_ajuste?: TipoAjuste;
  /** UTC days over `fecha_registro`. */
  desde?: string;
  hasta?: string;
}

export interface NuevoAjuste {
  id_producto: number;
  tipo_ajuste: TipoAjuste;
  /** Always positive: the type decides the sign. */
  cantidad: number;
  observacion: string;
}
