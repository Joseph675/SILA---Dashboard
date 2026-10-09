import { InjectionToken } from '@angular/core';
import type { AcopioRepository } from './acopio.repository';

/** The only way components reach milk-reception data. Bound in `core/data/data-providers.ts`. */
export const ACOPIO_REPOSITORY = new InjectionToken<AcopioRepository>('ACOPIO_REPOSITORY');
