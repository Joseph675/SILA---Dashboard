import type { Notificacion } from '../../notificaciones/models/notificaciones.models';
import type { EstadoPeriodo } from '../../periodos/models/periodos.models';

/** What happened TODAY (Colombia day). Annulled sales do not add up. */
export interface TableroHoy {
  /** With IVA: `ventas_contado + ventas_credito`. */
  ventas_total: number;
  ventas_cantidad: number;
  ventas_contado: number;
  ventas_credito: number;
  /** What came in and went out of the cash box today (a credit sale does not come in; the abonos do). */
  caja_ingresos: number;
  caja_egresos: number;
  /** Can be negative. */
  caja_neta: number;
  /** Approved liters only. */
  litros_recibidos: number;
  litros_rechazados: number;
  lotes_producidos: number;
}

/** The quincena that contains today, with the same figures as `GET /periodos`. */
export interface TableroQuincena {
  id_periodo: number;
  anio: number;
  mes: number;
  quincena: number;
  /** `AAAA-MM-DD`. */
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoPeriodo;
  ingresos_ventas: number;
  total_vendido: number;
  total_cobrado: number;
  costo_produccion: number;
  gastos_operativos: number;
  cartera_castigada: number;
  resultado_estimado: number;
  caja_neta: number;
  leche_litros: number;
  leche_por_pagar: number;
}

export interface TableroCartera {
  saldo_total: number;
  saldo_vencido: number;
  clientes_con_saldo: number;
  clientes_en_mora: number;
}

export interface TableroInventario {
  /** At sale price (stock × base price). */
  valor_productos: number;
  productos_bajo_minimo: number;
  productos_agotados: number;
  /** At average cost. */
  valor_insumos: number;
  insumos_bajo_minimo: number;
  /** Expire in 7 days or less and have not expired yet. */
  lotes_por_vencer: number;
}

export interface TableroLecheros {
  /** All that is owed to the milk suppliers (history, not only this quincena). */
  saldo_por_pagar: number;
  proveedores_con_saldo: number;
}

export interface TableroAlertas {
  /** The same totals as the bell (`GET /notificaciones`). */
  total: number;
  criticas: number;
  /** At most 5, the critical ones first. */
  principales: Notificacion[];
}

export interface VentaDia {
  /** `AAAA-MM-DD`. */
  fecha: string;
  total: number;
  cantidad: number;
}

/** `GET /tablero`: a read-only snapshot, the same for ADMIN and OPERATIVO. */
export interface Tablero {
  /** Today in Colombia, `AAAA-MM-DD`. */
  fecha: string;
  hoy: TableroHoy;
  /** `null` when today falls in no quincena that was created. */
  quincena: TableroQuincena | null;
  cartera: TableroCartera;
  inventario: TableroInventario;
  lecheros: TableroLecheros;
  alertas: TableroAlertas;
  /** Always 7 rows, from 6 days ago to today (the last one); days without sales come with 0. */
  ventas_semana: VentaDia[];
}
