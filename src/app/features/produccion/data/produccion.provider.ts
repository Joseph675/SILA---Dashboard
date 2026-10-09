import { InjectionToken } from '@angular/core';
import type { ProduccionRepository } from './produccion.repository';

/** The only way components reach production data. Bound in `core/data/data-providers.ts`. */
export const PRODUCCION_REPOSITORY = new InjectionToken<ProduccionRepository>('PRODUCCION_REPOSITORY');
