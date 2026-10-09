import { computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';
import { ApiErrorService } from '../../core/api/api-error';
import { PAGE_SIZE_OPTIONS, Page, PageQuery } from '../../core/api/page.models';

export interface ListadoOpciones<F extends object, T> {
  /** Current filters; any change goes back to page 0. */
  filtros: () => F;
  cargar: (query: PageQuery & F) => Observable<Page<T>>;
  /** Initial `campo,dir` sort. Empty = no `sort` is sent (endpoints that define none). */
  sort: string;
  /** Initial page size; defaults to the first of `PAGE_SIZE_OPTIONS`. */
  tamanoInicial?: number;
  /** While it returns false nothing is requested (e.g. a filter that is still being resolved). */
  habilitado?: () => boolean;
}

/**
 * Server-paged list state for a screen: page, size, sort and filters feed an
 * rxResource, so a new request cancels the previous one. Must run in an
 * injection context (a component field initializer).
 */
export function crearListado<F extends object, T>(opciones: ListadoOpciones<F, T>) {
  const errores = inject(ApiErrorService);

  const sort = signal(opciones.sort);
  const size = signal<number>(opciones.tamanoInicial ?? PAGE_SIZE_OPTIONS[0]);
  const page = linkedSignal({
    source: () => ({ filtros: opciones.filtros(), sort: sort(), size: size() }),
    computation: () => 0,
  });

  const recurso = rxResource({
    params: () => (opciones.habilitado && !opciones.habilitado() ? undefined : { ...opciones.filtros(), page: page(), size: size(), sort: sort() || undefined }),
    stream: ({ params }) => opciones.cargar(params),
  });

  /** Keeps the last page on screen while the next one loads (value() is empty meanwhile). */
  const datos = linkedSignal<Page<T> | undefined, Page<T> | undefined>({
    source: () => (recurso.hasValue() ? recurso.value() : undefined),
    computation: (nuevo, anterior) => nuevo ?? (recurso.error() ? undefined : anterior?.value),
  });

  return {
    datos,
    cargando: recurso.isLoading,
    error: computed(() => (recurso.error() ? errores.describe(recurso.error()).mensaje : null)),
    sort,
    irAPagina: (indice: number) => page.set(indice),
    cambiarTamano: (tamano: number) => size.set(tamano),
    recargar: () => recurso.reload(),
  };
}
