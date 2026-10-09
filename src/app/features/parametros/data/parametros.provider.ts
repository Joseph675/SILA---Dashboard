import { InjectionToken } from '@angular/core';
import type { ParametrosRepository } from './parametros.repository';

export const PARAMETROS_REPOSITORY = new InjectionToken<ParametrosRepository>('PARAMETROS_REPOSITORY');
