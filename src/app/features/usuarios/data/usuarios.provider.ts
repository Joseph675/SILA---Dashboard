import { InjectionToken } from '@angular/core';
import type { UsuariosRepository } from './usuarios.repository';

/** The only way components reach user data; bound in `core/data/data-providers.ts`. */
export const USUARIOS_REPOSITORY = new InjectionToken<UsuariosRepository>('USUARIOS_REPOSITORY');
