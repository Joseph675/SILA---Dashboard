/**
 * WebAuthn helpers (Face ID / fingerprint passkeys). The server speaks the standard JSON form (camelCase, binaries as
 * base64url); the browser wants `ArrayBuffer`s. Browsers that have `parseCreationOptionsFromJSON` /
 * `parseRequestOptionsFromJSON` / `toJSON()` do the conversion themselves; older ones (Safari, Chrome before ~129) get the
 * manual one below. Nothing here is converted to snake_case: the standard names (`clientDataJSON`, `rawId`…) go as they are.
 */

export interface OpcionesCreacion {
  publicKey: PublicKeyCredentialCreationOptionsJSON;
}
export interface OpcionesSolicitud {
  publicKey: PublicKeyCredentialRequestOptionsJSON;
}

// ---------- base64url <-> bytes ----------

/** `AQID` / `AQ-_` (with or without `=` padding) -> bytes. Anything that is not base64url throws. */
export function base64urlABuffer(texto: string): ArrayBuffer {
  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(texto)) throw new Error('base64url inválido');
  const base64 = texto.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
}

/** Bytes -> base64url WITHOUT padding (what WebAuthn JSON uses). */
export function bufferABase64url(datos: ArrayBuffer | ArrayBufferView): string {
  const bytes = datos instanceof ArrayBuffer ? new Uint8Array(datos) : new Uint8Array(datos.buffer, datos.byteOffset, datos.byteLength);
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------- options: JSON -> what `navigator.credentials` takes ----------

/** Manual conversion of the creation options (`challenge`, `user.id`, `excludeCredentials[].id`). */
export function opcionesCreacionManual(json: PublicKeyCredentialCreationOptionsJSON): PublicKeyCredentialCreationOptions {
  const { challenge, user, excludeCredentials, extensions: _extensions, ...resto } = json;
  return {
    ...resto,
    challenge: base64urlABuffer(challenge),
    user: { ...user, id: base64urlABuffer(user.id) },
    ...(excludeCredentials ? { excludeCredentials: excludeCredentials.map((c) => ({ ...c, id: base64urlABuffer(c.id) })) } : {}),
  } as PublicKeyCredentialCreationOptions;
}

/** Manual conversion of the request options (`challenge`, `allowCredentials[].id`). */
export function opcionesSolicitudManual(json: PublicKeyCredentialRequestOptionsJSON): PublicKeyCredentialRequestOptions {
  const { challenge, allowCredentials, extensions: _extensions, ...resto } = json;
  return {
    ...resto,
    challenge: base64urlABuffer(challenge),
    ...(allowCredentials ? { allowCredentials: allowCredentials.map((c) => ({ ...c, id: base64urlABuffer(c.id) })) } : {}),
  } as PublicKeyCredentialRequestOptions;
}

/** The browser's own parser when it exists, the manual one otherwise. */
export function opcionesCreacion(json: PublicKeyCredentialCreationOptionsJSON): PublicKeyCredentialCreationOptions {
  return typeof PublicKeyCredential !== 'undefined' && typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function'
    ? PublicKeyCredential.parseCreationOptionsFromJSON(json)
    : opcionesCreacionManual(json);
}

export function opcionesSolicitud(json: PublicKeyCredentialRequestOptionsJSON): PublicKeyCredentialRequestOptions {
  return typeof PublicKeyCredential !== 'undefined' && typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function'
    ? PublicKeyCredential.parseRequestOptionsFromJSON(json)
    : opcionesSolicitudManual(json);
}

// ---------- credential: what the browser returns -> JSON for the server ----------

/** Manual conversion of a registration result: `{id, rawId, type, response: {clientDataJSON, attestationObject, …}, clientExtensionResults}`. */
export function registroAJsonManual(cred: PublicKeyCredential): RegistrationResponseJSON {
  const r = cred.response as AuthenticatorAttestationResponse;
  const authenticatorData = typeof r.getAuthenticatorData === 'function' ? r.getAuthenticatorData() : undefined;
  const transports = typeof r.getTransports === 'function' ? r.getTransports() : undefined;
  return {
    id: cred.id,
    rawId: bufferABase64url(cred.rawId),
    type: 'public-key',
    ...(cred.authenticatorAttachment ? { authenticatorAttachment: cred.authenticatorAttachment } : {}),
    response: {
      clientDataJSON: bufferABase64url(r.clientDataJSON),
      attestationObject: bufferABase64url(r.attestationObject),
      ...(authenticatorData ? { authenticatorData: bufferABase64url(authenticatorData) } : {}),
      ...(transports ? { transports } : {}),
    },
    clientExtensionResults: cred.getClientExtensionResults() as AuthenticationExtensionsClientOutputsJSON,
  } as RegistrationResponseJSON;
}

/** Manual conversion of a sign-in result: `response: {clientDataJSON, authenticatorData, signature, userHandle}`. */
export function verificacionAJsonManual(cred: PublicKeyCredential): AuthenticationResponseJSON {
  const r = cred.response as AuthenticatorAssertionResponse;
  return {
    id: cred.id,
    rawId: bufferABase64url(cred.rawId),
    type: 'public-key',
    ...(cred.authenticatorAttachment ? { authenticatorAttachment: cred.authenticatorAttachment } : {}),
    response: {
      clientDataJSON: bufferABase64url(r.clientDataJSON),
      authenticatorData: bufferABase64url(r.authenticatorData),
      signature: bufferABase64url(r.signature),
      ...(r.userHandle ? { userHandle: bufferABase64url(r.userHandle) } : {}),
    },
    clientExtensionResults: cred.getClientExtensionResults() as AuthenticationExtensionsClientOutputsJSON,
  } as AuthenticationResponseJSON;
}

/** `toJSON()` when the browser has it; the manual conversion otherwise. */
export function credencialAJson(cred: PublicKeyCredential): RegistrationResponseJSON | AuthenticationResponseJSON {
  if (typeof cred.toJSON === 'function') return cred.toJSON();
  return 'attestationObject' in cred.response ? registroAJsonManual(cred) : verificacionAJsonManual(cred);
}

// ---------- device name ----------

/** A friendly default for the device name from the user agent: `iPhone — Safari`, `Windows — Chrome`… (1–60 characters). */
export function sugerirNombreDispositivo(userAgent: string): string {
  const ua = userAgent ?? '';
  const sistema = /iPhone/i.test(ua) ? 'iPhone' : /iPad/i.test(ua) ? 'iPad' : /Android/i.test(ua) ? 'Android' : /Windows/i.test(ua) ? 'Windows' : /Macintosh|Mac OS X/i.test(ua) ? 'Mac' : /CrOS/i.test(ua) ? 'Chromebook' : /Linux/i.test(ua) ? 'Linux' : 'Mi dispositivo';
  const navegador = /Edg\//i.test(ua) ? 'Edge' : /OPR\/|Opera/i.test(ua) ? 'Opera' : /Firefox|FxiOS/i.test(ua) ? 'Firefox' : /Chrome|CriOS/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : '';
  return (navegador ? `${sistema} — ${navegador}` : sistema).slice(0, 60);
}
