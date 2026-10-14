import { InjectionToken } from '@angular/core';
import type { InsumosRepository } from './insumos.repository';

/** The only way components reach supplies data. Bound in `core/data/data-providers.ts`. */
export const INSUMOS_REPOSITORY = new InjectionToken<InsumosRepository>('INSUMOS_REPOSITORY');
