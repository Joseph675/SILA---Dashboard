import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { PERIODOS_REPOSITORY } from './data/periodos.provider';
import { etiquetaQuincena } from './periodos.format';

/** A resource that has not answered yet. After the first answer it is never "loading" again (it "reloads"). */
function pendiente(estado: string): boolean {
  return estado === 'loading' || estado === 'idle';
}

/**
 * The quincenas for a filter selector (the latest 50, newest first) and the id of the current one, if today has one.
 * `iniciado` turns true once both lookups answered, so a list can start with the right default and load once.
 * Must run in an injection context.
 */
export function cargarQuincenas() {
  const repo = inject(PERIODOS_REPOSITORY);
  const lista = rxResource({ stream: () => repo.listar({ page: 0, size: 50, sort: 'fecha_inicio,desc' }) });
  /** Fails with 20007 when today has no quincena; that is normal here (the filter just starts on «todas»). */
  const actual = rxResource({ stream: () => repo.actual() });
  return {
    opciones: computed(() => (lista.hasValue() ? lista.value().items : []).map((p) => ({ id_periodo: p.id_periodo, etiqueta: `${p.anio} · ${etiquetaQuincena(p.mes, p.quincena)}` }))),
    actualId: computed(() => (actual.hasValue() ? actual.value().id_periodo : null)),
    iniciado: computed(() => !pendiente(lista.status()) && !pendiente(actual.status())),
  };
}
