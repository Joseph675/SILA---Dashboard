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

  describe('escrituras que EXIGEN la cabecera (red de seguridad)', () => {
    const FORMATO = /^[A-Za-z0-9._:-]{8,100}$/;
    const RUTAS = ['acopio/precios', 'acopio/pagos/3/anular', 'produccion/lotes', 'ventas', 'ventas/3/anular', 'cartera/abonos', 'insumos/compras', 'insumos/compras/2/anular', 'insumos/ajustes', 'finanzas/gastos', 'finanzas/gastos/4/anular', 'documentos', 'documentos/5/subido'];

    it.each(RUTAS)('un POST a %s sin clave explícita sale con un UUID', (path) => {
      api.post(path, {}).subscribe();
      const req = peticion(path);
      expect(req.request.headers.get('Idempotency-Key')).toMatch(FORMATO);
      req.flush({});
    });

    it.each(['put', 'patch'] as const)('un %s a /acopio sin clave explícita también la lleva', (metodo) => {
      api[metodo]('acopio/precios/1', {}).subscribe();
      const req = peticion('acopio/precios/1');
      expect(req.request.headers.get('Idempotency-Key')).toMatch(FORMATO);
      req.flush({});
    });

    it('un DELETE bajo /documentos sin clave explícita también la lleva', () => {
      api.delete('documentos/7').subscribe();
      const req = peticion('documentos/7');
      expect(req.request.headers.get('Idempotency-Key')).toMatch(FORMATO);
      req.flush({});
    });

    it('la clave EXPLÍCITA del llamador gana (es la del intento del usuario) y no se reemplaza', () => {
      api.post('acopio/precios', {}, { idempotencyKey: 'clave-del-usuario-1' }).subscribe();
      const req = peticion('acopio/precios');
      expect(req.request.headers.get('Idempotency-Key')).toBe('clave-del-usuario-1');
      req.flush({});
    });

    it('dos llamadas distintas generan claves distintas', () => {
      api.post('acopio/precios', {}).subscribe();
      api.post('acopio/precios', {}).subscribe();
      const claves = http.match((r) => ruta(r.url) === '/api/v1/acopio/precios').map((r) => r.request.headers.get('Idempotency-Key'));
      expect(claves[0]).not.toBe(claves[1]);
    });

    it('un reintento HTTP de la MISMA llamada (volver a suscribirse) conserva la clave', () => {
      const llamada = api.post('acopio/precios', {});
      llamada.subscribe({ error: () => undefined });
      const primera = peticion('acopio/precios');
      const clave = primera.request.headers.get('Idempotency-Key');
      primera.flush('fallo', { status: 500, statusText: 'Server Error' });

      llamada.subscribe();
      const segunda = peticion('acopio/precios');
      expect(segunda.request.headers.get('Idempotency-Key')).toBe(clave);
      segunda.flush({});
    });

    it('las lecturas y las rutas que no la piden no la llevan', () => {
      api.get('acopio/precios').subscribe();
      peticion('acopio/precios').flush({});
      api.post('catalogos/productos', {}).subscribe();
      const catalogos = peticion('catalogos/productos');
      expect(catalogos.request.headers.has('Idempotency-Key')).toBe(false);
      catalogos.flush({});
      api.put('insumos/1', {}).subscribe();
      const insumo = peticion('insumos/1');
      expect(insumo.request.headers.has('Idempotency-Key')).toBe(false);
      insumo.flush({});
    });
  });
});
