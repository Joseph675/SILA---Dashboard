import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { AuthResponse, Sesion } from '../auth/auth.models';
import { AuthService } from './auth.service';

const USUARIO: Sesion = { id_usuario: 7, usuario: 'ana.perez', nombre: 'Ana Pérez', email: 'ana@example.com', rol: 'ADMIN', mfa_activo: true };
const OK: AuthResponse = { estado: 'OK', access_token: 'token-de-acceso', expires_in: 900, usuario: USUARIO };

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  const ruta = (url: string) => new URL(url, 'http://host').pathname;
  const peticion = (paso: string) => http.expectOne((r) => ruta(r.url) === `/api/v1/auth/${paso}`);

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('pasos del inicio de sesión', () => {
    it('login: envía usuario y clave con credenciales y, si está todo bien, guarda token y sesión', () => {
      let respuesta: AuthResponse | undefined;
      auth.iniciarSesion('ana.perez', 'una-clave-larga').subscribe((r) => (respuesta = r));

      const req = peticion('login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ usuario: 'ana.perez', clave: 'una-clave-larga' });
      expect(req.request.withCredentials).toBe(true);
      req.flush(OK);

      expect(respuesta?.estado).toBe('OK');
      expect(auth.token).toBe('token-de-acceso');
      expect(auth.sesion()).toEqual(USUARIO);
      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.rol()).toBe('ADMIN');
    });

    it('un estado pendiente (CAMBIAR_CLAVE) NO crea sesión ni guarda el token temporal', () => {
      auth.iniciarSesion('ana.perez', 'temporal').subscribe();
      peticion('login').flush({ estado: 'CAMBIAR_CLAVE', token_temporal: 'temporal-1' } satisfies AuthResponse);

      expect(auth.token).toBeNull();
      expect(auth.sesion()).toBeNull();
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('cambiar clave con token temporal: lo manda en Authorization y devuelve el siguiente paso', () => {
      let respuesta: AuthResponse | undefined;
      auth.cambiarClave('temporal', 'clave-nueva-larga', 'temporal-1').subscribe((r) => (respuesta = r));

      const req = peticion('cambiar-clave');
      expect(req.request.headers.get('Authorization')).toBe('Bearer temporal-1');
      expect(req.request.body).toEqual({ clave_actual: 'temporal', clave_nueva: 'clave-nueva-larga' });
      expect(req.request.withCredentials).toBe(true);
      req.flush({ estado: 'MFA_ENROLAR', token_temporal: 'temporal-2' } satisfies AuthResponse);

      expect(respuesta).toEqual({ estado: 'MFA_ENROLAR', token_temporal: 'temporal-2' });
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('configurar y activar el segundo factor con token temporal terminan en OK', () => {
      let config: unknown;
      auth.configurarMfa('temporal-2').subscribe((c) => (config = c));
      const configurar = peticion('mfa/configurar');
      expect(configurar.request.headers.get('Authorization')).toBe('Bearer temporal-2');
      configurar.flush({ secreto: 'ABCDEFGH', otpauth_uri: 'otpauth://totp/SILA:ana?secret=ABCDEFGH' });
      expect(config).toEqual({ secreto: 'ABCDEFGH', otpauth_uri: 'otpauth://totp/SILA:ana?secret=ABCDEFGH' });

      auth.activarMfa('123456', 'temporal-2').subscribe();
      const activar = peticion('mfa/activar');
      expect(activar.request.body).toEqual({ codigo: '123456' });
      activar.flush(OK);

      expect(auth.token).toBe('token-de-acceso');
      expect(auth.sesion()?.usuario).toBe('ana.perez');
    });

    it('verificar el código del segundo factor termina en OK', () => {
      auth.verificarMfa('654321', 'temporal-3').subscribe();
      const req = peticion('mfa/verificar');
      expect(req.request.headers.get('Authorization')).toBe('Bearer temporal-3');
      expect(req.request.body).toEqual({ codigo: '654321' });
      req.flush(OK);

      expect(auth.isAuthenticated()).toBe(true);
    });
  });

  describe('con sesión iniciada', () => {
    beforeEach(() => {
      auth.iniciarSesion('ana.perez', 'x').subscribe();
      peticion('login').flush(OK);
    });

    it('cambiar la clave con el token de acceso (CLAVE_CAMBIADA) cierra la sesión local', () => {
      auth.cambiarClave('vieja', 'nueva-clave-larga').subscribe();
      const req = peticion('cambiar-clave');
      // Sin token temporal: la cabecera la pone el interceptor con el token de acceso.
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({ estado: 'CLAVE_CAMBIADA' } satisfies AuthResponse);

      expect(auth.token).toBeNull();
      expect(auth.sesion()).toBeNull();
    });

    it('activar el segundo factor con el token de acceso (MFA_ACTIVADO) lo marca en la sesión', () => {
      auth.sesion.set({ ...USUARIO, mfa_activo: false });
      auth.activarMfa('111111').subscribe();
      peticion('mfa/activar').flush({ estado: 'MFA_ACTIVADO' } satisfies AuthResponse);

      expect(auth.sesion()?.mfa_activo).toBe(true);
      expect(auth.token).toBe('token-de-acceso');
    });

    it('hasRole: ADMIN incluye OPERATIVO; un OPERATIVO no incluye ADMIN', () => {
      expect(auth.hasRole('ADMIN')).toBe(true);
      expect(auth.hasRole('OPERATIVO')).toBe(true);
      auth.sesion.set({ ...USUARIO, rol: 'OPERATIVO' });
      expect(auth.hasRole('ADMIN')).toBe(false);
      expect(auth.hasRole('OPERATIVO')).toBe(true);
    });

    it('cerrarSesión limpia todo aunque la llamada falle', () => {
      let terminado = false;
      auth.cerrarSesion().subscribe(() => (terminado = true));
      peticion('logout').flush({ code: 20999, message: 'x' }, { status: 500, statusText: 'Error' });

      expect(terminado).toBe(true);
      expect(auth.token).toBeNull();
      expect(auth.sesion()).toBeNull();
    });

    it('cerrarSesión llama a /auth/logout con credenciales y limpia', () => {
      auth.cerrarSesion().subscribe();
      const req = peticion('logout');
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(auth.isAuthenticated()).toBe(false);
    });
  });

  describe('renovar (single-flight)', () => {
    it('dos llamadas simultáneas hacen UNA sola petición HTTP y comparten el resultado', () => {
      const resultados: AuthResponse[] = [];
      auth.renovar().subscribe((r) => resultados.push(r));
      auth.renovar().subscribe((r) => resultados.push(r));
      auth.renovar().subscribe((r) => resultados.push(r));

      const req = peticion('refresh');
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ ...OK, access_token: 'token-nuevo' });

      expect(resultados.length).toBe(3);
      expect(auth.token).toBe('token-nuevo');
    });

    it('cuando termina, la siguiente renovación hace una petición nueva', () => {
      auth.renovar().subscribe();
      peticion('refresh').flush(OK);

      auth.renovar().subscribe();
      peticion('refresh').flush({ ...OK, access_token: 'segundo' });

      expect(auth.token).toBe('segundo');
    });

    it('si falla, todos los que esperaban reciben el error y se puede volver a intentar', () => {
      const errores: unknown[] = [];
      auth.renovar().subscribe({ error: (e) => errores.push(e) });
      auth.renovar().subscribe({ error: (e) => errores.push(e) });
      peticion('refresh').flush({ code: 20013, message: 'vencida' }, { status: 401, statusText: 'No autorizado' });

      expect(errores.length).toBe(2);
      expect(auth.isAuthenticated()).toBe(false);

      auth.renovar().subscribe();
      peticion('refresh').flush(OK);
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('restaurarSesion: con cookie válida deja la sesión y devuelve true', async () => {
      const promesa = auth.restaurarSesion();
      peticion('refresh').flush(OK);

      expect(await promesa).toBe(true);
      expect(auth.sesion()).toEqual(USUARIO);
    });

    it('restaurarSesion: sin cookie válida falla en silencio y deja sin sesión', async () => {
      const promesa = auth.restaurarSesion();
      peticion('refresh').flush({ code: 20013, message: 'vencida' }, { status: 401, statusText: 'No autorizado' });

      expect(await promesa).toBe(false);
      expect(auth.isAuthenticated()).toBe(false);
    });
  });

  describe('nada se guarda en el navegador', () => {
    it('un inicio de sesión completo no escribe en localStorage, sessionStorage ni cookies', () => {
      const escrituras = vi.spyOn(Storage.prototype, 'setItem');
      auth.iniciarSesion('ana.perez', 'x').subscribe();
      peticion('login').flush({ estado: 'MFA_REQUERIDO', token_temporal: 'temporal-3' } satisfies AuthResponse);
      auth.verificarMfa('123456', 'temporal-3').subscribe();
      peticion('mfa/verificar').flush(OK);

      expect(auth.isAuthenticated()).toBe(true);
      expect(escrituras).not.toHaveBeenCalled();
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
      expect(document.cookie).toBe('');
      escrituras.mockRestore();
    });
  });

  describe('renovar entre pestañas (Web Locks)', () => {
    afterEach(() => {
      Reflect.deleteProperty(navigator, 'locks');
    });

    /** A lock manager that grants one request at a time, like the real one. */
    function instalarCandados() {
      const concedidos: string[] = [];
      let cola: Promise<unknown> = Promise.resolve();
      const request = vi.fn((nombre: string, ...resto: unknown[]) => {
        const callback = resto[resto.length - 1] as (lock: { name: string }) => Promise<void>;
        const turno = cola.then(() => {
          concedidos.push(nombre);
          return callback({ name: nombre });
        });
        cola = turno.catch(() => undefined);
        return turno;
      });
      Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
      return { request, concedidos };
    }

    it('dos renovaciones simultáneas producen UNA sola llamada HTTP, dentro del candado «sila-refresh»', async () => {
      const { request, concedidos } = instalarCandados();
      const resultados: AuthResponse[] = [];
      auth.renovar().subscribe((r) => resultados.push(r));
      auth.renovar().subscribe((r) => resultados.push(r));

      const req = await vi.waitFor(() => peticion('refresh'));
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ ...OK, access_token: 'token-nuevo' });
      await vi.waitFor(() => expect(resultados.length).toBe(2));

      expect(request).toHaveBeenCalledTimes(1);
      expect(concedidos).toEqual(['sila-refresh']);
      expect(auth.token).toBe('token-nuevo');
    });

    it('la llamada HTTP solo sale cuando se concede el candado (otra pestaña lo tiene primero)', async () => {
      let soltarOtraPestana!: () => void;
      const otraPestana = new Promise<void>((resolver) => (soltarOtraPestana = resolver));
      const request = vi.fn(async (_nombre: string, ...resto: unknown[]) => {
        await otraPestana; // la otra pestaña tiene el candado
        return (resto[resto.length - 1] as () => Promise<void>)();
      });
      Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });

      auth.renovar().subscribe();
      await Promise.resolve();
      http.expectNone((r) => ruta(r.url) === '/api/v1/auth/refresh');

      soltarOtraPestana();
      const req = await vi.waitFor(() => peticion('refresh'));
      req.flush(OK);
    });

    it('si la renovación falla dentro del candado, el error llega a quien esperaba', async () => {
      instalarCandados();
      const errores: unknown[] = [];
      auth.renovar().subscribe({ error: (e) => errores.push(e) });

      const req = await vi.waitFor(() => peticion('refresh'));
      req.flush({ code: 20013, message: 'vencida' }, { status: 401, statusText: 'No autorizado' });
      await vi.waitFor(() => expect(errores.length).toBe(1));
    });
  });
});

