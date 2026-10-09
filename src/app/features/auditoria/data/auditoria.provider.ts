import { InjectionToken } from '@angular/core';
import type { AuditoriaRepository } from './auditoria.repository';

/** The only way components reach the audit logs; bound in `core/data/data-providers.ts`. */
export const AUDITORIA_REPOSITORY = new InjectionToken<AuditoriaRepository>('AUDITORIA_REPOSITORY');
