import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';

export interface ErrorAccionSensible {
  /** Where to show it: under a field, or as a general message under the form. */
  campo: 'codigo' | 'email' | null;
  mensaje: string;
  /** The code typed is useless now (wrong): clear it. */
  limpiarCodigo: boolean;
}

/**
 * Failures of the sensitive actions (edit my data, change password, new backup codes). The API only tells them apart by
 * code and text: 20013 "Codigo incorrecto" / "Ese codigo ya fue usado", 20014 locked, 20015 too many, 20006 e-mail in use.
 */
export function describirErrorSensible(errores: ApiErrorService, fallo: unknown): ErrorAccionSensible {
  const error = causaDe(fallo);
  if (isApiError(error)) {
    if (error.code === 20013 && /ya fue usado/i.test(error.message)) {
      return { campo: 'codigo', mensaje: 'Espera unos segundos a que la app genere uno nuevo.', limpiarCodigo: true };
    }
    if (error.code === 20013 && /codigo/i.test(error.message)) {
      return { campo: 'codigo', mensaje: 'El código es incorrecto. Revisa tu app e inténtalo de nuevo.', limpiarCodigo: true };
    }
    if (error.code === 20014) return { campo: null, mensaje: `Cuenta bloqueada. ${error.message}`, limpiarCodigo: true };
    if (error.code === 20015) return { campo: null, mensaje: 'Demasiados intentos, espera un minuto.', limpiarCodigo: false };
    if (error.code === 20006) return { campo: 'email', mensaje: 'Ese correo ya está en uso.', limpiarCodigo: false };
    if (error.code === 20001) return { campo: null, mensaje: error.message, limpiarCodigo: false };
  }
  return { campo: null, mensaje: errores.describe(fallo).mensaje, limpiarCodigo: false };
}
