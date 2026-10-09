import { InjectionToken } from '@angular/core';
import type { PreciosClienteRepository } from './precios-cliente.repository';

export const PRECIOS_CLIENTE_REPOSITORY = new InjectionToken<PreciosClienteRepository>('PRECIOS_CLIENTE_REPOSITORY');
