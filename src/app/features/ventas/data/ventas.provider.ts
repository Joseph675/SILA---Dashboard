import { InjectionToken } from '@angular/core';
import type { VentasRepository } from './ventas.repository';

/** The only way components reach sales data. Bound in `core/data/data-providers.ts`. */
export const VENTAS_REPOSITORY = new InjectionToken<VentasRepository>('VENTAS_REPOSITORY');
