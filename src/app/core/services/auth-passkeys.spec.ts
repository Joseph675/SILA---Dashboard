import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { AuthResponse } from '../auth/auth.models';
import { AuthService } from './auth.service';

const OK: AuthResponse = { estado: 'OK', access_token: 'acceso', expires_in: 900, usuario: { id_usuario: 7, usuario: 'ana', nombre: 'Ana', email: 'a@example.com', rol: 'ADMIN', mfa_activo: true } };
const CRED_LOGIN = { id: 'c', rawId: 'AQ', type: 'public-key', response: { clientDataJSON: 'AA', authenticatorData: 'AA', signature: 'AA', userHandle: 'AA' }, clientExtensionResults: {} } as unknown as AuthenticationResponseJSON;
const CRED_REGISTRO = { id: 'c', rawId: 'AQ', type: 'public-key', response: { clientDataJSON: 'AA', attestationObject: 'AA' }, clientExtensionResults: {} } as unknown as RegistrationResponseJSON;

describe('AuthService · passkeys', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;
  const peticion = (paso: string) => http.expectOne((r) => ruta(r.url) === `/api/v1/auth/${paso}`);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('opciones de login: POST /auth/passkey/opciones con el token temporal, y las opciones llegan en camelCase SIN tocar', () => {
    let recibido: unknown;
    auth.opcionesPasskeyLogin('TEMP').subscribe((o) => (recibido = o));
    const req = peticion('passkey/opciones');

    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe('Bearer TEMP');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ publicKey: { challenge: 'AQID', rpId: 'localhost', allowCredentials: [{ type: 'public-key', id: 'AQ' }], userVerification: 'required' } });

    expect(recibido).toEqual({ publicKey: { challenge: 'AQID', rpId: 'localhost', allowCredentials: [{ type: 'public-key', id: 'AQ' }], userVerification: 'required' } });
  });

  it('verificar: POST /auth/passkey/verificar {credencial} con el token temporal; la credencial viaja con sus nombres del estándar y, si OK, abre la sesión', () => {
    auth.verificarPasskey(CRED_LOGIN, 'TEMP').subscribe();
    const req = peticion('passkey/verificar');

    expect(req.request.headers.get('Authorization')).toBe('Bearer TEMP');
    expect(req.request.body).toEqual({ credencial: CRED_LOGIN });
    // camelCase del estándar intacto: nada de client_data_json / raw_id.
    expect(JSON.stringify(req.request.body)).toContain('clientDataJSON');
    expect(JSON.stringify(req.request.body)).toContain('rawId');
    expect(JSON.stringify(req.request.body)).not.toMatch(/client_data|raw_id|authenticator_data|user_handle/);
    req.flush(OK);

    expect(auth.token).toBe('acceso');
    expect(auth.sesion()?.usuario).toBe('ana');
  });

  it('listar: GET /auth/passkeys', () => {
    let lista: unknown;
    auth.listarPasskeys().subscribe((l) => (lista = l));
    const req = peticion('passkeys');

    expect(req.request.method).toBe('GET');
    req.flush([{ id_passkey: 1, nombre: 'iPhone — Safari', fecha_creacion: '2026-10-14T01:00:00', fecha_ultimo_uso: null }]);
    expect(lista).toEqual([{ id_passkey: 1, nombre: 'iPhone — Safari', fecha_creacion: '2026-10-14T01:00:00', fecha_ultimo_uso: null }]);
  });

  it('opciones de registro: POST /auth/passkeys/opciones {codigo} (con el token de acceso, no el temporal)', () => {
    auth.opcionesRegistroPasskey('123456').subscribe();
    const req = peticion('passkeys/opciones');

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ codigo: '123456' });
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ publicKey: { challenge: 'AQ', rp: { name: 'SILA' }, user: { id: 'AQ', name: 'a', displayName: 'A' }, pubKeyCredParams: [] } });
  });

  it('registrar: POST /auth/passkeys {nombre, credencial} con la credencial en camelCase del estándar', () => {
    auth.registrarPasskey('iPhone — Safari', CRED_REGISTRO).subscribe();
    const req = peticion('passkeys');

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nombre: 'iPhone — Safari', credencial: CRED_REGISTRO });
    expect(JSON.stringify(req.request.body)).toContain('attestationObject');
    expect(JSON.stringify(req.request.body)).not.toMatch(/attestation_object|client_data/);
    req.flush({ id_passkey: 2, nombre: 'iPhone — Safari', fecha_creacion: '2026-10-14T01:00:00', fecha_ultimo_uso: null });
  });

  it('quitar: DELETE /auth/passkeys/{id}', () => {
    auth.quitarPasskey(5).subscribe();
    const req = peticion('passkeys/5');

    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
