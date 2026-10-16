import { InjectionToken } from '@angular/core';
import type { ArchivosRepository } from './archivos.repository';

/** The only way components reach the files. Bound in `core/data/data-providers.ts`. */
export const ARCHIVOS_REPOSITORY = new InjectionToken<ArchivosRepository>('ARCHIVOS_REPOSITORY');
