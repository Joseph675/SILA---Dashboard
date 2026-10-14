import { InjectionToken } from '@angular/core';
import type { DocumentosRepository } from './documentos.repository';

/** The only way components reach document data. Bound in `core/data/data-providers.ts`. */
export const DOCUMENTOS_REPOSITORY = new InjectionToken<DocumentosRepository>('DOCUMENTOS_REPOSITORY');
