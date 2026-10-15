import { TestBed } from '@angular/core/testing';
import { PasskeyError, PasskeyService } from './passkey.service';

const buf = (...n: number[]) => Uint8Array.from(n).buffer as ArrayBuffer;
const dom = (nombre: string) => new DOMException('x', nombre);

describe('PasskeyService', () => {
  let servicio: PasskeyService;
  let credenciales: { create: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    servicio = TestBed.inject(PasskeyService);
    credenciales = { create: vi.fn(), get: vi.fn() };
    vi.stubGlobal('navigator', { ...navigator, credentials: credenciales, userAgent: 'x' });
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('soportado()', () => {
    it('true solo si existe PublicKeyCredential Y hay un verificador integrado', async () => {
      vi.stubGlobal('PublicKeyCredential', { isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true) });
      vi.stubGlobal('window', Object.assign(Object.create(window), { PublicKeyCredential: (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential }));
      expect(await servicio.soportado()).toBe(true);
    });

    it('false si no hay verificador integrado (sin Face ID / huella / Windows Hello)', async () => {
      const pk = { isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(false) };
      vi.stubGlobal('window', Object.assign(Object.create(window), { PublicKeyCredential: pk }));
      expect(await servicio.soportado()).toBe(false);
    });

    it('false si el navegador no tiene WebAuthn', async () => {
      vi.stubGlobal('window', Object.assign(Object.create(window), { PublicKeyCredential: undefined }));
      expect(await servicio.soportado()).toBe(false);
    });

    it('false (sin error) si la consulta falla', async () => {
      const pk = { isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.reject(new Error('boom')) };
      vi.stubGlobal('window', Object.assign(Object.create(window), { PublicKeyCredential: pk }));
      expect(await servicio.soportado()).toBe(false);
    });
  });

  describe('crear() / obtener() con parser y toJSON() nativos', () => {
    beforeEach(() => {
      vi.stubGlobal('PublicKeyCredential', {
        parseCreationOptionsFromJSON: vi.fn(() => ({ challenge: buf(1), nativo: 'creacion' })),
        parseRequestOptionsFromJSON: vi.fn(() => ({ challenge: buf(1), nativo: 'solicitud' })),
      });
    });

    it('crear: pasa las opciones convertidas a navigator.credentials.create y devuelve credencial.toJSON()', async () => {
      credenciales.create.mockResolvedValue({ toJSON: () => ({ id: 'abc', response: { attestationObject: 'AA' } }) });
      const r = await servicio.crear({ publicKey: { challenge: 'AQ', rp: { name: 'SILA' }, user: { id: 'AQ', name: 'a', displayName: 'A' }, pubKeyCredParams: [] } });

      expect(credenciales.create).toHaveBeenCalledWith({ publicKey: expect.objectContaining({ nativo: 'creacion' }) });
      expect(r).toEqual({ id: 'abc', response: { attestationObject: 'AA' } });
    });

    it('obtener: devuelve la respuesta en JSON', async () => {
      credenciales.get.mockResolvedValue({ toJSON: () => ({ id: 'abc', response: { signature: 'AA' } }) });
      const r = await servicio.obtener({ publicKey: { challenge: 'AQ' } });

      expect(credenciales.get).toHaveBeenCalledWith({ publicKey: expect.objectContaining({ nativo: 'solicitud' }) });
      expect(r).toEqual({ id: 'abc', response: { signature: 'AA' } });
    });
  });

  describe('crear() / obtener() en un navegador viejo (sin parser ni toJSON)', () => {
    beforeEach(() => vi.stubGlobal('PublicKeyCredential', {}));

    it('convierte base64url ↔ ArrayBuffer a mano en los dos sentidos', async () => {
      credenciales.create.mockResolvedValue({
        id: 'ID',
        rawId: buf(1, 2, 3),
        type: 'public-key',
        response: { clientDataJSON: buf(4), attestationObject: buf(5, 6) },
        getClientExtensionResults: () => ({}),
      });
      const r = await servicio.crear({ publicKey: { challenge: 'AQID', rp: { name: 'SILA' }, user: { id: 'BAUG', name: 'a', displayName: 'A' }, pubKeyCredParams: [] } });

      // Ida: el servidor mandó base64url y el navegador recibe bytes.
      const enviado = credenciales.create.mock.calls[0][0].publicKey;
      expect(Array.from(new Uint8Array(enviado.challenge))).toEqual([1, 2, 3]);
      expect(Array.from(new Uint8Array(enviado.user.id))).toEqual([4, 5, 6]);
      // Vuelta: el navegador devolvió bytes y al servidor le llega base64url.
      expect(r).toMatchObject({ id: 'ID', rawId: 'AQID', type: 'public-key', response: { clientDataJSON: 'BA', attestationObject: 'BQY' }, clientExtensionResults: {} });
    });

    it('obtener: la firma y el authenticatorData vuelven en base64url', async () => {
      credenciales.get.mockResolvedValue({
        id: 'ID',
        rawId: buf(1),
        type: 'public-key',
        response: { clientDataJSON: buf(2), authenticatorData: buf(3), signature: buf(0xff, 0xfe), userHandle: null },
        getClientExtensionResults: () => ({}),
      });
      const r = (await servicio.obtener({ publicKey: { challenge: 'AQID', allowCredentials: [{ type: 'public-key', id: 'BAUG' }] } }))!;

      expect(Array.from(new Uint8Array(credenciales.get.mock.calls[0][0].publicKey.allowCredentials[0].id))).toEqual([4, 5, 6]);
      expect(r.response).toMatchObject({ clientDataJSON: 'Ag', authenticatorData: 'Aw', signature: '__4' });
    });
  });

  describe('cuando algo no sale bien', () => {
    beforeEach(() => vi.stubGlobal('PublicKeyCredential', {}));
    const opC = { publicKey: { challenge: 'AQ', rp: { name: 'x' }, user: { id: 'AQ', name: 'a', displayName: 'A' }, pubKeyCredParams: [] } };

    it('NotAllowedError (la persona cancela) NO es error: crear y obtener devuelven null', async () => {
      credenciales.create.mockRejectedValue(dom('NotAllowedError'));
      credenciales.get.mockRejectedValue(dom('NotAllowedError'));

      expect(await servicio.crear(opC)).toBeNull();
      expect(await servicio.obtener({ publicKey: { challenge: 'AQ' } })).toBeNull();
    });

    it('si el navegador devuelve null tampoco hay error', async () => {
      credenciales.get.mockResolvedValue(null);
      expect(await servicio.obtener({ publicKey: { challenge: 'AQ' } })).toBeNull();
    });

    it('InvalidStateError al registrar: «Este dispositivo ya está registrado.»', async () => {
      credenciales.create.mockRejectedValue(dom('InvalidStateError'));
      await expect(servicio.crear(opC)).rejects.toMatchObject({ name: 'PasskeyError', message: 'Este dispositivo ya está registrado.' });
    });

    it('SecurityError: explica que solo sirve en la dirección web oficial', async () => {
      credenciales.get.mockRejectedValue(dom('SecurityError'));
      await expect(servicio.obtener({ publicKey: { challenge: 'AQ' } })).rejects.toThrow(/dirección web oficial/);
    });

    it('un error desconocido sale como PasskeyError con un mensaje claro (nunca el texto técnico)', async () => {
      credenciales.get.mockRejectedValue(new Error('detalle técnico interno'));
      const fallo = await servicio.obtener({ publicKey: { challenge: 'AQ' } }).catch((e: unknown) => e);

      expect(fallo).toBeInstanceOf(PasskeyError);
      expect((fallo as PasskeyError).message).not.toContain('técnico');
      expect((fallo as PasskeyError).message).toContain('código');
    });
  });
});
