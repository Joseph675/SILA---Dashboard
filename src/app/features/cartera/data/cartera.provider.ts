import { InjectionToken } from '@angular/core';
import type { CarteraRepository } from './cartera.repository';

export const CARTERA_REPOSITORY = new InjectionToken<CarteraRepository>('CARTERA_REPOSITORY');
