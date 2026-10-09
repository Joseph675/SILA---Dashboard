import { InjectionToken } from '@angular/core';
import type { PeriodosRepository } from './periodos.repository';

/**
 * The only way components reach period data. Bound to the HTTP
 * implementation in `core/data/data-providers*.ts`.
 */
export const PERIODOS_REPOSITORY = new InjectionToken<PeriodosRepository>('PERIODOS_REPOSITORY');
