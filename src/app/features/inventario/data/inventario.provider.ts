import { InjectionToken } from '@angular/core';
import type { InventarioRepository } from './inventario.repository';

/** The only way components reach inventory data. Bound in `core/data/data-providers.ts`. */
export const INVENTARIO_REPOSITORY = new InjectionToken<InventarioRepository>('INVENTARIO_REPOSITORY');
