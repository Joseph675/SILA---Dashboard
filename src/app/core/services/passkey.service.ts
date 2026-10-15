import { Injectable } from '@angular/core';
import { credencialAJson, opcionesCreacion, opcionesSolicitud, type OpcionesCreacion, type OpcionesSolicitud } from '../auth/webauthn';

/** Something went wrong with the device's Face ID / fingerprint that is NOT the person cancelling. The message is for the screen. */
export class PasskeyError extends Error {
  constructor(
    mensaje: string,
    readonly causa?: unknown,
  ) {
    super(mensaje);
    this.name = 'PasskeyError';
  }
}

/** The person closed the system dialog (or it timed out): not an error, the screen goes back softly. */
function esCancelacion(error: unknown): boolean {
  return error instanceof DOMException ? error.name === 'NotAllowedError' || error.name === 'AbortError' : false;
}

function aPasskeyError(error: unknown, registrando: boolean): PasskeyError {
  const nombre = error instanceof DOMException ? error.name : '';
  switch (nombre) {
    case 'InvalidStateError':
      return new PasskeyError(registrando ? 'Este dispositivo ya está registrado.' : 'Este dispositivo no tiene una llave registrada para tu cuenta.', error);
    case 'SecurityError':
      return new PasskeyError('Face ID / huella solo funciona en la dirección web oficial de SILA, por una conexión segura (https).', error);
    case 'NotSupportedError':
      return new PasskeyError('Este dispositivo no permite usar Face ID / huella con SILA.', error);
    default:
      return new PasskeyError('No se pudo usar Face ID / huella. Inténtalo de nuevo o usa un código.', error);
  }
}

/**
 * The browser side of the passkeys. The answers go to the server through `AuthService`; this class only talks to
 * `navigator.credentials`. The face / fingerprint never leaves the phone: the system dialog unlocks a private key that stays
 * in its secure chip, and only a signature (or, when registering, a public key) travels.
 */
@Injectable({ providedIn: 'root' })
export class PasskeyService {
  /** The browser has WebAuthn AND a built-in way to verify the person (Face ID, Touch ID, fingerprint, Windows Hello). */
  async soportado(): Promise<boolean> {
    try {
      return typeof window !== 'undefined' && !!window.PublicKeyCredential && (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) === true;
    } catch {
      return false;
    }
  }

  /**
   * Registers this device. Resolves with the credential in JSON (what the server expects as `credencial`), or `null`
   * if the person cancelled the system dialog. Other failures throw `PasskeyError`.
   */
  async crear(opciones: OpcionesCreacion): Promise<RegistrationResponseJSON | null> {
    try {
      const cred = await navigator.credentials.create({ publicKey: opcionesCreacion(opciones.publicKey) });
      return cred ? (credencialAJson(cred as PublicKeyCredential) as RegistrationResponseJSON) : null;
    } catch (error) {
      if (esCancelacion(error)) return null;
      throw aPasskeyError(error, true);
    }
  }

  /** Signs the server's challenge with the key of this device. `null` = the person cancelled. */
  async obtener(opciones: OpcionesSolicitud): Promise<AuthenticationResponseJSON | null> {
    try {
      const cred = await navigator.credentials.get({ publicKey: opcionesSolicitud(opciones.publicKey) });
      return cred ? (credencialAJson(cred as PublicKeyCredential) as AuthenticationResponseJSON) : null;
    } catch (error) {
      if (esCancelacion(error)) return null;
      throw aPasskeyError(error, false);
    }
  }
}
