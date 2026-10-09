export type Rol = 'ADMIN' | 'OPERATIVO';

/** `UsuarioSesion` of the contract: who is signed in. */
export interface Sesion {
  id_usuario: number;
  usuario: string;
  nombre: string;
  email: string;
  rol: Rol;
  mfa_activo: boolean;
}

/**
 * Step the API asks for next. `CLAVE_CAMBIADA` and `MFA_ACTIVADO` are the
 * answers of the same calls made with an access token (not a temporary one).
 */
export type EstadoAuth = 'OK' | 'CAMBIAR_CLAVE' | 'MFA_REQUERIDO' | 'MFA_ENROLAR' | 'CLAVE_CAMBIADA' | 'MFA_ACTIVADO';

export interface AuthResponse {
  estado: EstadoAuth;
  /** Only with a pending step; valid 5 min and for that step only. Never stored. */
  token_temporal?: string;
  access_token?: string;
  expires_in?: number;
  usuario?: Sesion;
  /** 10 one-use backup codes, only in the answer that ACTIVATES the second factor. Shown once, never stored. */
  codigos_respaldo?: string[];
  /** Only after signing in with a backup code: how many are left. */
  codigos_restantes?: number;
}

/** Answer of `POST /auth/mfa/configurar`: the QR is drawn from `otpauth_uri`. */
export interface MfaConfig {
  secreto: string;
  otpauth_uri: string;
}

/** `GET /auth/mfa/respaldo` */
export interface RespaldoEstado {
  restantes: number;
}

/** `POST /auth/mfa/respaldo/regenerar` */
export interface CodigosRespaldo {
  codigos_respaldo: string[];
}

/** One open session (a refresh-token family). `actual` only on "my sessions". Times are UTC without a zone. */
export interface SesionAbierta {
  familia: string;
  iniciada: string;
  ultima_actividad: string;
  ip: string;
  user_agent: string;
  actual?: boolean;
}

/** `cerrar-otras` / `cerrar-todas` */
export interface SesionesCerradas {
  cerradas: number;
}


/** `PUT /auth/yo`: edit my own name and e-mail. Asks for the current second-factor code (or a backup code). */
export interface ActualizarPerfilRequest {
  nombre: string;
  email: string;
  codigo: string;
}

/** `POST /auth/cambiar-clave`. `codigo` only with an ACCESS token (signed in); the first-login step (temporary token) does not send it. */
export interface CambiarClaveRequest {
  clave_actual: string;
  clave_nueva: string;
  codigo?: string;
}

/** `POST /auth/mfa/respaldo/regenerar` */
export interface RegenerarRequest {
  clave_actual: string;
  codigo: string;
}
