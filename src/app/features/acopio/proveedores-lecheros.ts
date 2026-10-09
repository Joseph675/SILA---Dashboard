import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { OpcionSelector } from '../../shared/ui/selector-buscable/selector-buscable.component';
import { CATALOGOS_REPOSITORY } from '../catalogos/data/catalogos.provider';

/**
 * Active milk providers (LECHERO) for the selectors, through the existing Catálogos repository.
 * SUPUESTO: AP-02. Only the first 100 are requested (the API's maximum page); a dairy has far fewer lecheros than that.
 * Must run in an injection context.
 */
export function cargarProveedoresLecheros() {
  const repo = inject(CATALOGOS_REPOSITORY);
  const recurso = rxResource({
    stream: () => repo.listarProveedores({ tipo_proveedor: 'LECHERO', activo: true, page: 0, size: 100, sort: 'nombre,asc' }),
  });
  const opciones = computed<OpcionSelector[]>(() => (recurso.hasValue() ? recurso.value().items.map((p) => ({ valor: p.id_proveedor, etiqueta: p.nombre })) : []));
  return { opciones, cargando: recurso.isLoading, hayError: computed(() => !!recurso.error()), recargar: () => recurso.reload() };
}
