import { Injectable } from '@angular/core';

/**
 * Error contract of the API. `code` is the Oracle application error
 * (RAISE_APPLICATION_ERROR -20001..-20999, sent as a positive number).
 */
export interface ApiError {
  code: number;
  message: string;
  /** Row id in the error log table, shown to the user for support (code 20999). */
  supportRef?: number;
  /** Only on 20001 from the API's form validation: field name -> reason. */
  fields?: Record<string, string>;
}

/** Code used locally for failures that carry no Oracle code (no connection, proxy errors...). */
export const ERROR_SIN_CODIGO = 0;

export function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && typeof (error as ApiError).code === 'number' && typeof (error as ApiError).message === 'string';
}

/** Angular resources wrap non-Error values; the ApiError then travels in `cause`. */
export function causaDe(fallo: unknown): unknown {
  return fallo instanceof Error && fallo.cause !== undefined ? fallo.cause : fallo;
}

/**
 * A temporary login token that expired or was altered. The API answers it like any
 * other 401 / 20013 and tells them apart only by the text ("Sesion no valida o
 * vencida..." vs "Codigo incorrecto." / "La clave actual no es correcta.").
 */
export function esSesionVencida(fallo: unknown): boolean {
  const error = causaDe(fallo);
  return isApiError(error) && error.code === 20013 && /sesion no valida|vencida/i.test(error.message);
}

/** What the UI should do with an error besides showing its message. */
export type ErrorAction = 'MOSTRAR' | 'SIN_PERMISO' | 'SOPORTE' | 'SESION';

export interface ErrorDescription {
  mensaje: string;
  accion: ErrorAction;
  supportRef?: number;
}

/**
 * Fixed user-facing text per code. Codes left out (20006, 20010...) mean
 * different things depending on the procedure, so the server message is shown.
 */
const MENSAJES: Record<number, string> = {
  20001: 'Hay datos inválidos. Revisa los campos marcados.',
  20002: 'Stock insuficiente para completar la operación.',
  20003: 'El cliente no tiene cupo de crédito suficiente.',
  20004: 'La quincena está cerrada. No se pueden registrar movimientos en ella.',
  20005: 'El abono no es válido o supera la deuda del cliente.',
  20008: 'No tienes permiso para realizar esta acción.',
  20012: 'No hay una resolución de facturación vigente.',
  20016: 'Hay otra solicitud igual en proceso. Espera un momento.',
  20017: 'Esa operación ya se envió con datos distintos. Vuelve a empezar.',
  // 20013 (no autenticado), 20014 (cuenta bloqueada: solo en pasos con la clave ya demostrada, NO en el login) y
  // 20015 (demasiados intentos) no están aquí a propósito: se muestra el mensaje del servidor.
};

/** Single place that turns any failure into a message and a UI action. */
@Injectable({ providedIn: 'root' })
export class ApiErrorService {
  describe(fallo: unknown): ErrorDescription {
    const error = causaDe(fallo);
    if (!isApiError(error)) {
      return { mensaje: 'No se pudo completar la operación. Intenta de nuevo.', accion: 'MOSTRAR' };
    }
    if (error.code === 20999) {
      return {
        mensaje: error.supportRef ? `Error interno. Referencia de soporte: ${error.supportRef}` : 'Error interno.',
        accion: 'SOPORTE',
        supportRef: error.supportRef,
      };
    }
    if (error.code === 20001 && error.fields && Object.keys(error.fields).length > 0) {
      const detalle = Object.entries(error.fields)
        .map(([campo, motivo]) => `${campo}: ${motivo}`)
        .join('; ');
      return { mensaje: `${MENSAJES[20001]} ${detalle}`, accion: 'MOSTRAR' };
    }
    // TODO: once the "sin permiso" page exists, the caller should navigate there for SIN_PERMISO.
    return { mensaje: MENSAJES[error.code] ?? error.message, accion: error.code === 20008 ? 'SIN_PERMISO' : error.code === 20013 ? 'SESION' : 'MOSTRAR' };
  }
}
