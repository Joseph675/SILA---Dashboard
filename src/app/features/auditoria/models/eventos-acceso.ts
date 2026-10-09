import type { ChipTono } from '../../../shared/ui/status-chip/status-chip.component';

export interface EventoAcceso {
  codigo: string;
  etiqueta: string;
  /** What it means, for the tooltip. */
  descripcion: string;
  /** peligro / alerta = needs attention; neutro = normal activity. Always shown with an icon and text. */
  tono: ChipTono;
}

/** The events of the contract (`GET /auditoria/accesos`), with their risk level. */
export const EVENTOS_ACCESO: readonly EventoAcceso[] = [
  { codigo: 'LOGIN_OK', etiqueta: 'Inicio de sesión', descripcion: 'Ingresó correctamente.', tono: 'neutro' },
  { codigo: 'LOGIN_FALLIDO', etiqueta: 'Inicio de sesión fallido', descripcion: 'Usuario o clave incorrectos.', tono: 'alerta' },
  { codigo: 'MFA_FALLIDO', etiqueta: 'Segundo factor fallido', descripcion: 'Código del segundo factor incorrecto.', tono: 'alerta' },
  { codigo: 'CUENTA_BLOQUEADA', etiqueta: 'Cuenta bloqueada', descripcion: 'La cuenta se bloqueó por demasiados intentos fallidos.', tono: 'peligro' },
  {
    codigo: 'USUARIO_DESCONOCIDO',
    etiqueta: 'Usuario desconocido',
    descripcion: 'Intento de ingreso con un nombre de usuario que no existe: posible ataque.',
    tono: 'peligro',
  },
  { codigo: 'LIMITE_FRECUENCIA', etiqueta: 'Límite de frecuencia', descripcion: 'Demasiados intentos en poco tiempo desde la misma dirección.', tono: 'peligro' },
  {
    codigo: 'REFRESH_REUSO',
    etiqueta: 'Renovación reutilizada',
    descripcion: 'Un token de renovación se usó dos veces: posible robo de sesión; la sesión fue cerrada.',
    tono: 'peligro',
  },
  { codigo: 'LOGOUT', etiqueta: 'Cierre de sesión', descripcion: 'La persona cerró su sesión.', tono: 'neutro' },
  { codigo: 'CLAVE_CAMBIADA', etiqueta: 'Clave cambiada', descripcion: 'La persona cambió su clave.', tono: 'neutro' },
  { codigo: 'MFA_ACTIVADO', etiqueta: 'Segundo factor activado', descripcion: 'Se activó el segundo factor.', tono: 'neutro' },
  { codigo: 'CODIGO_RESPALDO_USADO', etiqueta: 'Código de respaldo usado', descripcion: 'Entró con un código de respaldo.', tono: 'neutro' },
  { codigo: 'CODIGOS_RESPALDO_REGENERADOS', etiqueta: 'Códigos de respaldo nuevos', descripcion: 'Se generaron códigos de respaldo nuevos.', tono: 'neutro' },
  { codigo: 'SESION_CERRADA', etiqueta: 'Sesión cerrada', descripcion: 'Se cerró una sesión.', tono: 'neutro' },
  { codigo: 'SESIONES_CERRADAS', etiqueta: 'Sesiones cerradas', descripcion: 'Se cerraron varias sesiones.', tono: 'neutro' },
];

const POR_CODIGO = new Map(EVENTOS_ACCESO.map((e) => [e.codigo, e]));

/** An event the dashboard does not know yet is still shown, with its code and no emphasis. */
export function eventoAcceso(codigo: string): EventoAcceso {
  return POR_CODIGO.get(codigo) ?? { codigo, etiqueta: codigo, descripcion: codigo, tono: 'neutro' };
}
