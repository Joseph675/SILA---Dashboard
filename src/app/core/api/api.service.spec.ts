import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api.service';
import { nuevaClaveIdempotencia } from './idempotencia';

describe('ApiService · Idempotency-Key', () => {
  let api: ApiService;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;
  const peticion = (path: string) => http.expectOne((r) => ruta(r.url) === `/api/v1/${path}`);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('post con idempotencyKey envía la cabecera Idempotency-Key', () => {
    api.post('ventas', { id_cliente: 1 }, { idempotencyKey: 'clave-de-prueba-1' }).subscribe();

    const req = peticion('ventas');
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-de-prueba-1');
    expect(req.request.body).toEqual({ id_cliente: 1 });
    req.flush({});
  });

  it.each(['put', 'patch'] as const)('%s también la envía', (metodo) => {
    api[metodo]('cartera/3', {}, { idempotencyKey: 'clave-de-prueba-2' }).subscribe();

    const req = peticion('cartera/3');
    expect(req.request.method).toBe(metodo.toUpperCase());
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-de-prueba-2');
    req.flush({});
  });

  it('delete también la envía', () => {
    api.delete('facturacion/9', { idempotencyKey: 'clave-de-prueba-3' }).subscribe();

    const req = peticion('facturacion/9');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-de-prueba-3');
    req.flush({});
  });

  it('sin la opción no manda la cabecera (no se inventa una clave)', () => {
    api.post('catalogos/clientes', {}).subscribe();

    const req = peticion('catalogos/clientes');
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    req.flush({});
  });

  it('la clave convive con otras cabeceras y con withCredentials', () => {
    api.post('auth/x', null, { idempotencyKey: 'clave-de-prueba-4', headers: { 'X-Otra': '1' }, withCredentials: true }).subscribe();

    const req = peticion('auth/x');
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-de-prueba-4');
    expect(req.request.headers.get('X-Otra')).toBe('1');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  describe('nuevaClaveIdempotencia', () => {
    it('cumple el formato del contrato (8 a 100 caracteres A-Z a-z 0-9 . _ : -)', () => {
      expect(nuevaClaveIdempotencia()).toMatch(/^[A-Za-z0-9._:-]{8,100}$/);
    });

    it('una clave NUEVA cada vez: nunca se repite entre acciones', () => {
      const claves = new Set(Array.from({ length: 200 }, () => nuevaClaveIdempotencia()));
      expect(claves.size).toBe(200);
    });
  });
});
