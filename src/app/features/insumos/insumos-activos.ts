import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { OpcionSelector } from '../../shared/ui/selector-buscable/selector-buscable.component';
import { INSUMOS_REPOSITORY } from './data/insumos.provider';
import type { Insumo } from './models/insumos.models';

/**
 * Active insumos for selectors and forms. SUPUESTO: IR-02. Only the first 100 (the API's maximum page) are requested.
 * Must run in an injection context.
 */
export function cargarInsumosActivos() {
  const repo = inject(INSUMOS_REPOSITORY);
  const recurso = rxResource({ stream: () => repo.listar({ activo: true, page: 0, size: 100, sort: 'nombre,asc' }) });
  const insumos = computed<Insumo[]>(() => (recurso.hasValue() ? recurso.value().items : []));
  const opciones = computed<OpcionSelector[]>(() => insumos().map((i) => ({ valor: i.id_insumo, etiqueta: `${i.nombre} (${i.codigo})` })));
  return { insumos, opciones, cargando: recurso.isLoading, hayError: computed(() => !!recurso.error()), recargar: () => recurso.reload() };
}
