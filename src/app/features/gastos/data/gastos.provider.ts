import { InjectionToken } from '@angular/core';
import type { GastosRepository } from './gastos.repository';

/** The only way components reach expense data. Bound in `core/data/data-providers.ts`. */
export const GASTOS_REPOSITORY = new InjectionToken<GastosRepository>('GASTOS_REPOSITORY');
