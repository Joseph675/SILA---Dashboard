import { InjectionToken } from '@angular/core';
import type { ComprobantesRepository } from './comprobantes.repository';

/** The only way components reach voucher data. Bound in `core/data/data-providers.ts`. */
export const COMPROBANTES_REPOSITORY = new InjectionToken<ComprobantesRepository>('COMPROBANTES_REPOSITORY');
