import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpAcopioRepository } from './http-acopio.repository';

describe('HttpAcopioRepository', () => {
  let repo: HttpAcopioRepository;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpAcopioRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listarRecepciones: GET /acopio/recepciones con filtros, página y orden', () => {
    repo.listarRecepciones({ id_proveedor: 3, estado_calidad: 'RECHAZADO', desde: '2026-10-01', hasta: '2026-10-09', page: 0, size: 20, sort: 'fecha,desc' }).subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/acopio/recepciones');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('id_proveedor')).toBe('3');
    expect(req.request.params.get('estado_calidad')).toBe('RECHAZADO');
    expect(req.request.params.get('desde')).toBe('2026-10-01');
    expect(req.request.params.get('hasta')).toBe('2026-10-09');
    expect(req.request.params.get('sort')).toBe('fecha,desc');
    req.flush({ items: [], total: 0, page: 0, size: 20 });
  });

  it('listarRecepciones: no envía los filtros que no se usaron', () => {
    repo.listarRecepciones({ id_proveedor: undefined, page: 1, size: 10 }).subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/acopio/recepciones');
    expect(req.request.params.has('id_proveedor')).toBe(false);
    expect(req.request.params.has('sort')).toBe(false);
    req.flush({ items: [], total: 0, page: 1, size: 10 });
  });

  it('crearRecepcion: POST /acopio/recepciones con el cuerpo y la cabecera Idempotency-Key', () => {
    repo.crearRecepcion({ id_proveedor: 3, litros: 100.5, temperatura: 8, acidez: 16, fecha: '2026-10-09' }, 'clave-de-prueba-1').subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/acopio/recepciones');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ id_proveedor: 3, litros: 100.5, temperatura: 8, acidez: 16, fecha: '2026-10-09' });
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-de-prueba-1');
    req.flush({}, { status: 201, statusText: 'Created' });
  });

  it('umbrales: GET /acopio/umbrales', () => {
    let umbrales: unknown;
    repo.umbrales().subscribe((r) => (umbrales = r));

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/acopio/umbrales');
    expect(req.request.method).toBe('GET');
    req.flush({ temperatura_max: 10, acidez_max: 18 });
    expect(umbrales).toEqual({ temperatura_max: 10, acidez_max: 18 });
  });

  it('calidad: GET /acopio/calidad con página y orden', () => {
    repo.calidad({ page: 0, size: 20, sort: 'proveedor,asc' }).subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/acopio/calidad');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('sort')).toBe('proveedor,asc');
    req.flush({ items: [], total: 0, page: 0, size: 20 });
  });

  it('pagoLecheros: GET /acopio/pago-lecheros con quincena y proveedor', () => {
    repo.pagoLecheros({ id_periodo: 19, id_proveedor: 3, page: 0, size: 20 }).subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/acopio/pago-lecheros');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('id_periodo')).toBe('19');
    expect(req.request.params.get('id_proveedor')).toBe('3');
    req.flush({ items: [], total: 0, page: 0, size: 20 });
  });

  it('listarPrecios / saldos / listarPagos: GET con sus filtros', () => {
    repo.listarPrecios({ id_proveedor: 3, solo_vigentes: true, page: 0, size: 20 }).subscribe();
    const a = http.expectOne((r) => ruta(r.url) === '/api/v1/acopio/precios');
    expect(a.request.params.get('solo_vigentes')).toBe('true');
    a.flush({ items: [], total: 0, page: 0, size: 20 });

    repo.saldos({ solo_con_saldo: true, page: 0, size: 20, sort: 'saldo,desc' }).subscribe();
    const b = http.expectOne((r) => ruta(r.url) === '/api/v1/acopio/saldos');
    expect(b.request.params.get('solo_con_saldo')).toBe('true');
    expect(b.request.params.get('sort')).toBe('saldo,desc');
    b.flush({ items: [], total: 0, page: 0, size: 20 });

    repo.listarPagos({ id_proveedor: 3, estado: 'VIGENTE', page: 0, size: 10 }).subscribe();
    const c = http.expectOne((r) => ruta(r.url) === '/api/v1/acopio/pagos');
    expect(c.request.params.get('estado')).toBe('VIGENTE');
    expect(c.request.params.has('sort')).toBe(false);
    c.flush({ items: [], total: 0, page: 0, size: 10 });
  });

  it('fijarPrecio: POST /acopio/precios con el cuerpo y la Idempotency-Key', () => {
    repo.fijarPrecio({ id_proveedor: 3, precio_litro: 1900, vigente_desde: '2026-10-09' }, 'clave-precio-001').subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/acopio/precios');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-precio-001');
    expect(req.request.body).toEqual({ id_proveedor: 3, precio_litro: 1900, vigente_desde: '2026-10-09' });
    req.flush({}, { status: 201, statusText: 'Created' });
  });

  it('registrarPago y anularPago: POST con Idempotency-Key', () => {
    const cuerpo = { id_proveedor: 3, id_periodo_liquidado: 19, monto: 1000, metodo_pago: 'EFECTIVO' as const };
    repo.registrarPago(cuerpo, 'clave-pago-0001').subscribe();
    const a = http.expectOne((r) => ruta(r.url) === '/api/v1/acopio/pagos');
    expect(a.request.method).toBe('POST');
    expect(a.request.body).toEqual(cuerpo);
    expect(a.request.headers.get('Idempotency-Key')).toBe('clave-pago-0001');
    a.flush({}, { status: 201, statusText: 'Created' });

    repo.anularPago(9, 'Se pagó dos veces', 'clave-anular-pago').subscribe();
    const b = http.expectOne((r) => ruta(r.url) === '/api/v1/acopio/pagos/9/anular');
    expect(b.request.body).toEqual({ motivo: 'Se pagó dos veces' });
    expect(b.request.headers.get('Idempotency-Key')).toBe('clave-anular-pago');
    b.flush({});
  });
});
