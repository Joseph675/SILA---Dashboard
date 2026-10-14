import { InjectionToken } from '@angular/core';
import type { TableroRepository } from './tablero.repository';

/** The only way components reach the dashboard figures. Bound in `core/data/data-providers.ts`. */
export const TABLERO_REPOSITORY = new InjectionToken<TableroRepository>('TABLERO_REPOSITORY');
