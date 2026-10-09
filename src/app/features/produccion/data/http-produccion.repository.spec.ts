import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpProduccionRepository } from './http-produccion.repository';

describe('HttpProduccionRepository', () => {
  let repo: HttpProduccionRepository;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpProduccionRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listarLotes: GET /produccion/lotes con texto, producto, fechas, página y orden', () => {
    repo.listarLotes({ texto: 'QSO', id_producto: 3, desde: '2026-10-01', hasta: '2026-10-09', page: 0, size: 20, sort: 'fecha_produccion,desc' }).subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/produccion/lotes');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('texto')).toBe('QSO');
    expect(req.request.params.get('id_producto')).toBe('3');
    expect(req.request.params.get('desde')).toBe('2026-10-01');
    expect(req.request.params.get('hasta')).toBe('2026-10-09');
    expect(req.request.params.get('sort')).toBe('fecha_produccion,desc');
    req.flush({ items: [], total: 0, page: 0, size: 20 });
  });

  it('crearLote: POST /produccion/lotes con el cuerpo y la cabecera Idempotency-Key', () => {
    const cuerpo = { id_producto: 3, litros_leche_usados: 50, cantidad_obtenida: 40, costo_por_litro: 0, fecha_produccion: '2026-10-09' };
    repo.crearLote(cuerpo, 'clave-de-prueba-2').subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/produccion/lotes');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-de-prueba-2');
    req.flush({}, { status: 201, statusText: 'Created' });
  });

  it('listarAjustes: GET /produccion/ajustes con producto, tipo, fechas, página y orden', () => {
    repo.listarAjustes({ id_producto: 3, tipo_ajuste: 'MERMA', desde: '2026-10-01', page: 0, size: 20, sort: 'fecha_registro,desc' }).subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/produccion/ajustes');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('id_producto')).toBe('3');
    expect(req.request.params.get('tipo_ajuste')).toBe('MERMA');
    expect(req.request.params.has('hasta')).toBe(false);
    req.flush({ items: [], total: 0, page: 0, size: 20 });
  });

  it('crearAjuste: POST /produccion/ajustes con cantidad positiva y la cabecera Idempotency-Key', () => {
    const cuerpo = { id_producto: 3, tipo_ajuste: 'MERMA' as const, cantidad: 5, observacion: 'Se cayó una tina' };
    repo.crearAjuste(cuerpo, 'clave-de-prueba-3').subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/produccion/ajustes');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-de-prueba-3');
    req.flush({}, { status: 201, statusText: 'Created' });
  });
});
