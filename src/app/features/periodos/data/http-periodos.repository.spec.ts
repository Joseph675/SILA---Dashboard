import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Periodo } from '../models/periodos.models';
import { CUENTAS_EN_CERO } from '../testing/periodo.fixture';
import { HttpPeriodosRepository } from './http-periodos.repository';

const PERIODO: Periodo = {
  ...CUENTAS_EN_CERO,
  id_periodo: 19,
  anio: 2026,
  mes: 10,
  quincena: 1,
  fecha_inicio: '2026-10-01',
  fecha_fin: '2026-10-15',
  estado: 'ABIERTA',
  ingresos_ventas: 0,
  costo_produccion: 0,
  gastos_operativos: 0,
  cartera_castigada: 0,
  resultado_estimado: 0,
};

describe('HttpPeriodosRepository', () => {
  let repo: HttpPeriodosRepository;
  let http: HttpTestingController;

  /** Path of a request, whatever host `environment.apiBaseUrl` points to. */
  const ruta = (url: string) => new URL(url, 'http://host').pathname;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpPeriodosRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar: GET /api/v1/periodos con año, estado, página, tamaño y orden', () => {
    let respuesta: unknown;
    repo.listar({ anio: 2026, estado: 'ABIERTA', page: 0, size: 50, sort: 'fecha_inicio,asc' }).subscribe((r) => (respuesta = r));

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/periodos');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('anio')).toBe('2026');
    expect(req.request.params.get('estado')).toBe('ABIERTA');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('50');
    expect(req.request.params.get('sort')).toBe('fecha_inicio,asc');
    req.flush({ items: [PERIODO], total: 1, page: 0, size: 50 });

    expect(respuesta).toEqual({ items: [PERIODO], total: 1, page: 0, size: 50 });
  });

  it('listar: no envía los filtros que no se usaron', () => {
    repo.listar({ page: 1, size: 10 }).subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/periodos');
    expect(req.request.params.has('anio')).toBe(false);
    expect(req.request.params.has('estado')).toBe(false);
    expect(req.request.params.has('sort')).toBe(false);
    req.flush({ items: [], total: 0, page: 1, size: 10 });
  });

  it('anios: GET /api/v1/periodos/anios y devuelve un arreglo simple', () => {
    let anios: number[] = [];
    repo.anios().subscribe((r) => (anios = r));

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/periodos/anios');
    expect(req.request.method).toBe('GET');
    req.flush([2026, 2027]);

    expect(anios).toEqual([2026, 2027]);
  });

  it('actual: GET /api/v1/periodos/actual', () => {
    let actual: Periodo | undefined;
    repo.actual().subscribe((r) => (actual = r));

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/periodos/actual');
    expect(req.request.method).toBe('GET');
    req.flush(PERIODO);

    expect(actual).toEqual(PERIODO);
  });

  it('crearAnio: POST /api/v1/periodos/anio/{anio} sin cuerpo', () => {
    let resultado: unknown;
    repo.crearAnio(2027).subscribe((r) => (resultado = r));

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/periodos/anio/2027');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush({ anio: 2027, creados: 24 });

    expect(resultado).toEqual({ anio: 2027, creados: 24 });
  });

  it('cerrar: PATCH /api/v1/periodos/{id}/estado con {estado: CERRADA} y sin motivo', () => {
    repo.cerrar(19).subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/periodos/19/estado');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ estado: 'CERRADA' });
    req.flush({ ...PERIODO, estado: 'CERRADA' });
  });

  it('reabrir: PATCH /api/v1/periodos/{id}/estado con {estado: ABIERTA, motivo}', () => {
    repo.reabrir(19, 'Corrección de una venta mal fechada').subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/periodos/19/estado');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ estado: 'ABIERTA', motivo: 'Corrección de una venta mal fechada' });
    req.flush(PERIODO);
  });
});
