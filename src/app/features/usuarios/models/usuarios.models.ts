import type { PageQuery } from '../../../core/api/page.models';
import type { Rol } from '../../../core/auth/auth.models';

/*
 * Field names are exactly the API's (snake_case). Timestamps arrive in UTC
 * without a zone (`2026-10-09T03:45:05`): show them with `formatoFechaHora`.
 * The password hash and the MFA secret are never part of this view.
 */

export const ROLES: readonly Rol[] = ['ADMIN', 'OPERATIVO'];

export interface Usuario {
  id_usuario: number;
  usuario: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  debe_cambiar_clave: boolean;
  mfa_activo: boolean;
  bloqueado: boolean;
  bloqueado_minutos: number;
  ultimo_login: string | null;
  fecha_cambio_clave: string | null;
  fecha_creacion: string;
}

/** `usuario`: 3-100 characters in lowercase, `a-z 0-9 _ . @ -`. `nombre`: 3-120. `email`: up to 150. */
export interface UsuarioCrear {
  usuario: string;
  nombre: string;
  email: string;
  rol: Rol;
}

/** Changing the role closes that person's sessions. */
export interface UsuarioActualizar {
  nombre: string;
  email: string;
  rol: Rol;
}

/** Answer of create and reset-password. `clave_temporal` is shown ONCE and never stored. */
export interface UsuarioConClaveTemporal {
  usuario: Usuario;
  clave_temporal: string;
}

export interface UsuariosQuery extends PageQuery {
  texto?: string;
  activo?: boolean;
  rol?: Rol;
}
