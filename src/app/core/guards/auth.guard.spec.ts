import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard, guestGuard } from './auth.guard';

describe('guards de sesión', () => {
  let auth: AuthService;
  let router: Router;

  const estado = (url: string) => ({ url }) as RouterStateSnapshot;
  const ejecutar = (guard: typeof authGuard, url = '/catalogos') =>
    runInInjectionContext(TestBed.inject(EnvironmentInjector), () => guard({} as ActivatedRouteSnapshot, estado(url)));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  it('authGuard: sin sesión manda a /login conservando la página pedida', () => {
    const resultado = ejecutar(authGuard, '/usuarios?pagina=2') as UrlTree;

    expect(resultado).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(resultado)).toBe('/login?return=%2Fusuarios%3Fpagina%3D2');
  });

  it('authGuard: sin sesión y sin página concreta manda a /login a secas', () => {
    expect(router.serializeUrl(ejecutar(authGuard, '/') as UrlTree)).toBe('/login');
  });

  it('authGuard: con sesión deja pasar', () => {
    auth.sesion.set({ id_usuario: 1, usuario: 'ana', nombre: 'Ana', email: 'a@example.com', rol: 'OPERATIVO', mfa_activo: false });

    expect(ejecutar(authGuard)).toBe(true);
  });

  it('guestGuard: sin sesión deja ver el login', () => {
    expect(ejecutar(guestGuard, '/login')).toBe(true);
  });

  it('guestGuard: con sesión manda al inicio', () => {
    auth.sesion.set({ id_usuario: 1, usuario: 'ana', nombre: 'Ana', email: 'a@example.com', rol: 'OPERATIVO', mfa_activo: false });

    expect(router.serializeUrl(ejecutar(guestGuard, '/login') as UrlTree)).toBe('/');
  });
});
