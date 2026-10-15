import {
  base64urlABuffer,
  bufferABase64url,
  credencialAJson,
  opcionesCreacion,
  opcionesCreacionManual,
  opcionesSolicitud,
  opcionesSolicitudManual,
  registroAJsonManual,
  sugerirNombreDispositivo,
  verificacionAJsonManual,
} from './webauthn';

const bytes = (...n: number[]) => new Uint8Array(n);
const aArray = (b: ArrayBuffer) => Array.from(new Uint8Array(b));
/** A real ArrayBuffer (never a view's buffer), so `toEqual` compares what the browser would see. */
const buf = (...n: number[]) => bytes(...n).buffer as ArrayBuffer;

describe('base64url ↔ bytes', () => {
  it('bytes → base64url usa «-» y «_», sin «=»', () => {
    // 0xfb 0xff 0xfe es «+//+» en base64 normal.
    expect(bufferABase64url(buf(0xfb, 0xff, 0xfe))).toBe('-__-');
    expect(bufferABase64url(buf(1, 2, 3, 4))).toBe('AQIDBA');
    expect(bufferABase64url(buf())).toBe('');
  });

  it('base64url → bytes, con o sin relleno', () => {
    expect(aArray(base64urlABuffer('-__-'))).toEqual([0xfb, 0xff, 0xfe]);
    expect(aArray(base64urlABuffer('AQIDBA'))).toEqual([1, 2, 3, 4]);
    expect(aArray(base64urlABuffer('AQIDBA=='))).toEqual([1, 2, 3, 4]);
    expect(aArray(base64urlABuffer(''))).toEqual([]);
  });

  it('ida y vuelta conserva TODOS los valores de byte (0–255)', () => {
    const todos = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(aArray(base64urlABuffer(bufferABase64url(todos)))).toEqual(Array.from(todos));
    expect(bufferABase64url(base64urlABuffer('3q2-7w'))).toBe('3q2-7w');
  });

  it('acepta una vista parcial (subarray) sin llevarse los bytes de al lado', () => {
    const vista = bytes(9, 9, 1, 2, 3, 9).subarray(2, 5);
    expect(bufferABase64url(vista)).toBe('AQID');
  });

  it('un texto que no es base64url lanza error', () => {
    expect(() => base64urlABuffer('no es base64!')).toThrow();
    expect(() => base64urlABuffer('ab+/')).toThrow();
  });
});

describe('opciones: JSON → lo que pide el navegador (conversión manual)', () => {
  it('registro: challenge, user.id y excludeCredentials[].id pasan a bytes; lo demás queda como viene', () => {
    const json = {
      challenge: 'AQID',
      rp: { name: 'SILA', id: 'localhost' },
      user: { id: 'BAUG', name: 'ana', displayName: 'Ana' },
      pubKeyCredParams: [{ type: 'public-key' as const, alg: -7 }],
      excludeCredentials: [{ type: 'public-key' as const, id: 'BwgJ', transports: ['internal' as const] }],
      authenticatorSelection: { userVerification: 'required' as const, residentKey: 'preferred' as const },
      timeout: 180000,
      attestation: 'none' as const,
    };
    const o = opcionesCreacionManual(json);

    expect(aArray(o.challenge as ArrayBuffer)).toEqual([1, 2, 3]);
    expect(aArray(o.user.id as ArrayBuffer)).toEqual([4, 5, 6]);
    expect(aArray(o.excludeCredentials![0].id as ArrayBuffer)).toEqual([7, 8, 9]);
    expect(o.excludeCredentials![0].transports).toEqual(['internal']);
    expect(o.user).toMatchObject({ name: 'ana', displayName: 'Ana' });
    expect(o.rp).toEqual({ name: 'SILA', id: 'localhost' });
    expect(o.authenticatorSelection).toEqual({ userVerification: 'required', residentKey: 'preferred' });
    expect(o.timeout).toBe(180000);
    expect(o.pubKeyCredParams).toEqual([{ type: 'public-key', alg: -7 }]);
  });

  it('registro sin excludeCredentials no inventa la lista', () => {
    const o = opcionesCreacionManual({ challenge: 'AQID', rp: { name: 'SILA' }, user: { id: 'BAUG', name: 'a', displayName: 'A' }, pubKeyCredParams: [] });
    expect('excludeCredentials' in o).toBe(false);
  });

  it('verificación: challenge y allowCredentials[].id pasan a bytes', () => {
    const o = opcionesSolicitudManual({ challenge: '-__-', rpId: 'localhost', allowCredentials: [{ type: 'public-key', id: 'AQIDBA' }], userVerification: 'required' });

    expect(aArray(o.challenge as ArrayBuffer)).toEqual([0xfb, 0xff, 0xfe]);
    expect(aArray(o.allowCredentials![0].id as ArrayBuffer)).toEqual([1, 2, 3, 4]);
    expect(o.rpId).toBe('localhost');
    expect(o.userVerification).toBe('required');
  });

  it('verificación sin allowCredentials (credenciales descubribles) no la inventa', () => {
    expect('allowCredentials' in opcionesSolicitudManual({ challenge: 'AQID' })).toBe(false);
  });
});

describe('opciones: usa el parser del navegador cuando existe', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('con parseCreationOptionsFromJSON / parseRequestOptionsFromJSON los usa tal cual', () => {
    const parseC = vi.fn(() => ({ marca: 'nativo-creacion' }));
    const parseR = vi.fn(() => ({ marca: 'nativo-solicitud' }));
    vi.stubGlobal('PublicKeyCredential', { parseCreationOptionsFromJSON: parseC, parseRequestOptionsFromJSON: parseR });
    const c = { challenge: 'AQID', rp: { name: 'x' }, user: { id: 'BAUG', name: 'a', displayName: 'A' }, pubKeyCredParams: [] };

    expect(opcionesCreacion(c)).toEqual({ marca: 'nativo-creacion' });
    expect(opcionesSolicitud({ challenge: 'AQID' })).toEqual({ marca: 'nativo-solicitud' });
    expect(parseC).toHaveBeenCalledWith(c);
  });

  it('sin parser (Safari / Chrome viejos) convierte a mano', () => {
    vi.stubGlobal('PublicKeyCredential', {});
    const o = opcionesSolicitud({ challenge: 'AQID' });
    expect(aArray(o.challenge as ArrayBuffer)).toEqual([1, 2, 3]);
  });

  it('sin PublicKeyCredential en absoluto también convierte a mano', () => {
    vi.stubGlobal('PublicKeyCredential', undefined);
    expect(aArray(opcionesSolicitud({ challenge: 'AQID' }).challenge as ArrayBuffer)).toEqual([1, 2, 3]);
  });
});

describe('credencial: lo que devuelve el navegador → JSON para el servidor', () => {
  const extensiones = { credProps: { rk: true } };

  function registro(extra: Record<string, unknown> = {}) {
    return {
      id: 'id-credencial',
      rawId: buf(1, 2, 3, 4),
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response: {
        clientDataJSON: buf(10, 11),
        attestationObject: buf(0xfb, 0xff, 0xfe),
        getTransports: () => ['internal', 'hybrid'],
        getAuthenticatorData: () => buf(7, 7),
      },
      getClientExtensionResults: () => extensiones,
      ...extra,
    } as unknown as PublicKeyCredential;
  }

  function verificacion(userHandle: ArrayBuffer | null) {
    return {
      id: 'id-credencial',
      rawId: buf(1, 2, 3, 4),
      type: 'public-key',
      authenticatorAttachment: null,
      response: { clientDataJSON: buf(10, 11), authenticatorData: buf(20, 21), signature: buf(0xff, 0xfe), userHandle },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential;
  }

  it('registro (manual): {id, rawId, type, response: {clientDataJSON, attestationObject…}, clientExtensionResults}', () => {
    const j = registroAJsonManual(registro());

    expect(j).toEqual({
      id: 'id-credencial',
      rawId: 'AQIDBA',
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response: { clientDataJSON: 'Cgs', attestationObject: '-__-', authenticatorData: 'Bwc', transports: ['internal', 'hybrid'] },
      clientExtensionResults: extensiones,
    });
  });

  it('registro (manual) sin métodos opcionales: no inventa transports ni authenticatorData', () => {
    const cred = registro({ authenticatorAttachment: null });
    (cred.response as unknown as Record<string, unknown>)['getTransports'] = undefined;
    (cred.response as unknown as Record<string, unknown>)['getAuthenticatorData'] = undefined;
    const j = registroAJsonManual(cred);

    expect(Object.keys(j.response).sort()).toEqual(['attestationObject', 'clientDataJSON']);
    expect('authenticatorAttachment' in j).toBe(false);
  });

  it('verificación (manual): {id, rawId, type, response: {clientDataJSON, authenticatorData, signature, userHandle}, …}', () => {
    const j = verificacionAJsonManual(verificacion(buf(5, 6)));

    expect(j).toEqual({
      id: 'id-credencial',
      rawId: 'AQIDBA',
      type: 'public-key',
      response: { clientDataJSON: 'Cgs', authenticatorData: 'FBU', signature: '__4', userHandle: 'BQY' },
      clientExtensionResults: {},
    });
  });

  it('verificación sin userHandle: no lo manda (nunca «null»)', () => {
    expect('userHandle' in verificacionAJsonManual(verificacion(null)).response).toBe(false);
  });

  it('credencialAJson usa toJSON() cuando el navegador lo tiene', () => {
    const toJSON = vi.fn(() => ({ id: 'nativo' }));
    expect(credencialAJson({ ...registro(), toJSON } as unknown as PublicKeyCredential)).toEqual({ id: 'nativo' });
  });

  it('credencialAJson sin toJSON() elige la conversión por el tipo de respuesta', () => {
    expect(credencialAJson(registro())).toHaveProperty('response.attestationObject', '-__-');
    expect(credencialAJson(verificacion(null))).toHaveProperty('response.signature', '__4');
  });
});

describe('sugerirNombreDispositivo', () => {
  const casos: [string, string][] = [
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'iPhone — Safari'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1', 'iPhone — Chrome'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36', 'Android — Chrome'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0', 'Windows — Edge'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'Mac — Safari'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0', 'Linux — Firefox'],
    ['', 'Mi dispositivo'],
  ];
  it.each(casos)('%s → %s', (ua, esperado) => expect(sugerirNombreDispositivo(ua)).toBe(esperado));
});
