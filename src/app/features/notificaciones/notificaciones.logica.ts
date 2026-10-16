import type { IconName } from '../../shared/ui/icon/icon.component';
import type { Notificacion } from './models/notificaciones.models';

/** The alerts whose `clave` the person has not seen. A solved alert that comes back with the SAME clave is not announced again. */
export function sinVer(items: readonly Notificacion[], vistas: ReadonlySet<string>): Notificacion[] {
  return items.filter((n) => !vistas.has(n.clave));
}

/** Adds the keys to the seen set, keeping at most `maximo` (the oldest are dropped first). Returns a new set. */
export function marcarVistas(vistas: ReadonlySet<string>, claves: readonly string[], maximo = 1000): Set<string> {
  const siguiente = new Set(vistas);
  for (const clave of claves) {
    siguiente.delete(clave);
    siguiente.add(clave);
  }
  while (siguiente.size > maximo) siguiente.delete(siguiente.values().next().value as string);
  return siguiente;
}

export interface Destino {
  ruta: (string | number)[];
  queryParams?: Record<string, string>;
}

/** Where an alert takes the person (by the `entidad` it points at). */
export function destinoDe(n: Pick<Notificacion, 'entidad' | 'id_entidad'>): Destino {
  switch (n.entidad) {
    case 'INSUMO':
      return { ruta: ['/insumos'] };
    case 'PRODUCTO':
      return { ruta: ['/inventario'] };
    case 'LOTE':
      return { ruta: ['/produccion'], queryParams: { pestana: 'lotes' } };
    case 'CLIENTE':
      return { ruta: ['/cartera'] };
    case 'PERIODO':
      return { ruta: n.id_entidad !== null ? ['/periodos', n.id_entidad] : ['/periodos'] };
    case 'DOCUMENTO':
      return { ruta: ['/archivos'] };
    default:
      return { ruta: ['/'] };
  }
}

/** Icon by the kind of alert (not by color alone: severity is also written in text). */
export function iconoDe(tipo: string): IconName {
  if (tipo.startsWith('INSUMO')) return 'lucidePackage';
  if (tipo.startsWith('PRODUCTO')) return 'lucideWarehouse';
  if (tipo.startsWith('LOTE')) return 'lucideFactory';
  if (tipo.startsWith('CARTERA')) return 'lucideWallet';
  if (tipo === 'PERIODO_SIN_CERRAR') return 'lucideCalendarRange';
  if (tipo === 'LECHE_POR_PAGAR') return 'lucideMilk';
  if (tipo.startsWith('DOCUMENTO')) return 'lucideFileText';
  return 'lucideBell';
}
