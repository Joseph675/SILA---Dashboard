import { InjectionToken } from '@angular/core';
import type { CatalogosRepository } from './catalogos.repository';

/**
 * The only way components reach catalog data. Bound to the HTTP
 * implementation in `core/data/data-providers*.ts`.
 */
export const CATALOGOS_REPOSITORY = new InjectionToken<CatalogosRepository>('CATALOGOS_REPOSITORY');
