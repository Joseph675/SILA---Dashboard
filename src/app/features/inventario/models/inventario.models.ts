import type { NivelAlerta } from '../../produccion/models/produccion.models';

export interface ItemInventario {
  id_producto: number;
  codigo_sku: string;
  producto: string;
  unidad_medida: string;
  stock_actual: number;
  precio_base: number;
  valor_venta_inventario: number;
}

export interface InventarioQuery {
  texto?: string;
  solo_con_stock?: boolean;
}

export interface ResumenInventario {
  total_productos: number;
  productos_sin_stock: number;
  /** At SALE price, not cost. */
  valor_total: number;
}

export interface AlertaCaducidad {
  codigo_lote: string;
  producto: string;
  /** What the lote produced, NOT what is left unsold (stock is per product). */
  cantidad_producida: number;
  fecha_vencimiento: string;
  /** Negative: already expired. */
  dias_restantes: number;
  /** Null when more than 7 days remain: the lote is listed because of the chosen window, not because it is critical. */
  nivel_alerta: NivelAlerta | null;
}

export interface AlertasCaducidadQuery {
  /** 0-60, server default 7. */
  dias_maximos?: number;
  /** 0-365, server default 30. */
  dias_vencidos?: number;
}
