import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { ApiError } from '../api/api-error';
import type { AuthResponse, Sesion } from '../auth/auth.models';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from './error.interceptor';

@Component({ template: '' })
class PaginaVacia {}

const USUARIO: Sesion = { id_usuario: 1, usuario: 'ana.perez', nombre: 'Ana', email: 'a@example.com', rol: 'ADMIN', mfa_activo: true };
const OK = (token: string): AuthResponse => ({ estado: 'OK', access_token: token, expires_in: 900, usuario: USUARIO });
const VENCIDO = { code: 20013, message: 'Sesion no valida o vencida. Inicie sesion de nuevo.' };

describe('interceptores de autenticación', () => {
  let http: HttpClient;
  let controlador: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  const ruta = (url: string) => new URL(url, 'http://host').pathname;
  const llamadas = (path: string) => controlador.match((r) => ruta(r.url) === path);

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'catalogos', component: PaginaVacia },
          { path: 'login', component: PaginaVacia },
        ]),
      ],
    });
    http = TestBed.inject(HttpClient);
    controlador = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    // Una sesión ya iniciada, con su token de acceso en memoria.
    auth.iniciarSesion('ana.perez', 'x').subscribe();
    controlador.expectOne((r) => ruta(r.url) === '/api/v1/auth/login').flush(OK('token-viejo'));
    await router.navigateByUrl('/catalogos');
  });

  afterEach(() => controlador.verify());

  describe('authInterceptor', () => {
    it('agrega el token de acceso a las llamadas normales', () => {
      http.get('/api/v1/catalogos/clientes').subscribe();
      const [req] = llamadas('/api/v1/catalogos/clientes');
      expect(req.request.headers.get('Authorization')).toBe('Bearer token-viejo');
      req.flush({});
    });

    it('no lo manda a login, refresh ni logout', () => {
      for (const paso of ['login', 'refresh', 'logout']) {
        http.post(`/api/v1/auth/${paso}`, null).subscribe();
        const [req] = llamadas(`/api/v1/auth/${paso}`);
        expect(req.request.headers.has('Authorization')).toBe(false);
        req.flush({});
      }
    });

    it('respeta el Authorization que ya traiga la llamada (token temporal) y pone credenciales en /auth/*', () => {
      http.post('/api/v1/auth/mfa/verificar', {}, { headers: { Authorization: 'Bearer temporal-1' } }).subscribe();
      const [req] = llamadas('/api/v1/auth/mfa/verificar');
      expect(req.request.headers.get('Authorization')).toBe('Bearer temporal-1');
      expect(req.request.withCredentials).toBe(true);
      req.flush({});
    });
  });

  describe('errorInterceptor · token de acceso vencido (401 / 20013)', () => {
    it('renueva UNA vez y reintenta UNA vez con el token nuevo', () => {
      let recibido: unknown;
      http.get('/api/v1/catalogos/clientes').subscribe((r) => (recibido = r));

      llamadas('/api/v1/catalogos/clientes')[0].flush(VENCIDO, { status: 401, statusText: 'No autorizado' });
      const renovaciones = llamadas('/api/v1/auth/refresh');
      expect(renovaciones.length).toBe(1);
      renovaciones[0].flush(OK('token-nuevo'));

      const reintentos = llamadas('/api/v1/catalogos/clientes');
      expect(reintentos.length).toBe(1);
      expect(reintentos[0].request.headers.get('Authorization')).toBe('Bearer token-nuevo');
      reintentos[0].flush({ items: [] });

      expect(recibido).toEqual({ items: [] });
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('varias llamadas vencidas a la vez comparten una sola renovación', () => {
      http.get('/api/v1/catalogos/clientes').subscribe();
      http.get('/api/v1/catalogos/productos').subscribe();

      llamadas('/api/v1/catalogos/clientes')[0].flush(VENCIDO, { status: 401, statusText: 'No autorizado' });
      llamadas('/api/v1/catalogos/productos')[0].flush(VENCIDO, { status: 401, statusText: 'No autorizado' });
      const renovaciones = llamadas('/api/v1/auth/refresh');
      expect(renovaciones.length).toBe(1);
      renovaciones[0].flush(OK('token-nuevo'));

      llamadas('/api/v1/catalogos/clientes')[0].flush({});
      llamadas('/api/v1/catalogos/productos')[0].flush({});
    });

    it('si renovar falla: limpia la sesión, va a /login con la página de retorno y entrega el error', async () => {
      let error: ApiError | undefined;
      http.get('/api/v1/catalogos/clientes').subscribe({ error: (e) => (error = e) });

      llamadas('/api/v1/catalogos/clientes')[0].flush(VENCIDO, { status: 401, statusText: 'No autorizado' });
      llamadas('/api/v1/auth/refresh')[0].flush(VENCIDO, { status: 401, statusText: 'No autorizado' });
      // La navegación a /login arranca dentro del interceptor: se espera a que termine.
      await new Promise((resolver) => setTimeout(resolver));

      expect(error?.code).toBe(20013);
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.token).toBeNull();
      expect(router.url).toBe('/login?aviso=sesion-cerrada&return=%2Fcatalogos');
      expect(llamadas('/api/v1/catalogos/clientes').length).toBe(0);
    });

    it('si varias llamadas fallan a la vez, la sesión se cierra y se avisa UNA sola vez', async () => {
      const navegar = vi.spyOn(router, 'navigate');
      http.get('/api/v1/catalogos/clientes').subscribe({ error: () => undefined });
      http.get('/api/v1/catalogos/productos').subscribe({ error: () => undefined });

      llamadas('/api/v1/catalogos/clientes')[0].flush(VENCIDO, { status: 401, statusText: 'No autorizado' });
      llamadas('/api/v1/catalogos/productos')[0].flush(VENCIDO, { status: 401, statusText: 'No autorizado' });
      llamadas('/api/v1/auth/refresh')[0].flush(VENCIDO, { status: 401, statusText: 'No autorizado' });
      await new Promise((resolver) => setTimeout(resolver));

      expect(navegar).toHaveBeenCalledTimes(1);
      expect(navegar.mock.calls[0][1]).toEqual({ queryParams: { aviso: 'sesion-cerrada', return: '/catalogos' } });
    });

    it('si el reintento también da 401 no vuelve a renovar (sin bucles) y cierra la sesión', () => {
      let error: ApiError | undefined;
      http.get('/api/v1/catalogos/clientes').subscribe({ error: (e) => (error = e) });

      llamadas('/api/v1/catalogos/clientes')[0].flush(VENCIDO, { status: 401, statusText: 'No autorizado' });
      llamadas('/api/v1/auth/refresh')[0].flush(OK('token-nuevo'));
      llamadas('/api/v1/catalogos/clientes')[0].flush(VENCIDO, { status: 401, statusText: 'No autorizado' });

      expect(error?.code).toBe(20013);
      expect(llamadas('/api/v1/auth/refresh').length).toBe(0);
      expect(auth.isAuthenticated()).toBe(false);
    });
  });

  describe('errorInterceptor · errores de /auth/*', () => {
    it('un 401 en /auth/login se muestra tal cual y NO dispara una renovación', () => {
      let error: ApiError | undefined;
      http.post('/api/v1/auth/login', {}).subscribe({ error: (e) => (error = e) });

      llamadas('/api/v1/auth/login')[0].flush({ code: 20013, message: 'Usuario o clave incorrectos.' }, { status: 401, statusText: 'No autorizado' });

      expect(error).toEqual({ code: 20013, message: 'Usuario o clave incorrectos.' });
      expect(llamadas('/api/v1/auth/refresh').length).toBe(0);
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('un 401 en un paso con token temporal tampoco renueva', () => {
      let error: ApiError | undefined;
      http.post('/api/v1/auth/mfa/verificar', {}, { headers: { Authorization: 'Bearer temporal-1' } }).subscribe({ error: (e) => (error = e) });

      llamadas('/api/v1/auth/mfa/verificar')[0].flush({ code: 20013, message: 'Codigo incorrecto.' }, { status: 401, statusText: 'No autorizado' });

      expect(error?.message).toBe('Codigo incorrecto.');
      expect(llamadas('/api/v1/auth/refresh').length).toBe(0);
    });

    it('423 (cuenta bloqueada) y 429 (demasiados intentos) pasan con el mensaje del servidor', () => {
      const errores: ApiError[] = [];
      http.post('/api/v1/auth/login', {}).subscribe({ error: (e) => errores.push(e) });
      llamadas('/api/v1/auth/login')[0].flush({ code: 20014, message: 'Cuenta bloqueada. Intente en 15 minutos.' }, { status: 423, statusText: 'Locked' });
      http.post('/api/v1/auth/login', {}).subscribe({ error: (e) => errores.push(e) });
      llamadas('/api/v1/auth/login')[0].flush({ code: 20015, message: 'Demasiados intentos. Espere un minuto.' }, { status: 429, statusText: 'Too Many' });

      expect(errores.map((e) => e.code)).toEqual([20014, 20015]);
      expect(errores[0].message).toContain('15 minutos');
    });
  });

  describe('errorInterceptor · otros errores', () => {
    it('lee support_ref y fields del cuerpo, y no toca la sesión', () => {
      let error: ApiError | undefined;
      http.get('/api/v1/catalogos/clientes').subscribe({ error: (e) => (error = e) });
      llamadas('/api/v1/catalogos/clientes')[0].flush(
        { code: 20001, message: 'Hay campos invalidos.', support_ref: 12, fields: { email: 'Correo invalido.' } },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(error).toEqual({ code: 20001, message: 'Hay campos invalidos.', supportRef: 12, fields: { email: 'Correo invalido.' } });
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('un 500 sin cuerpo del API se convierte en 20999', () => {
      let error: ApiError | undefined;
      http.get('/api/v1/catalogos/clientes').subscribe({ error: (e) => (error = e) });
      llamadas('/api/v1/catalogos/clientes')[0].flush('<html>', { status: 500, statusText: 'Error' });

      expect(error?.code).toBe(20999);
    });
  });
});
