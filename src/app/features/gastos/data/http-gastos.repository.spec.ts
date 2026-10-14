import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpGastosRepository } from './http-gastos.repository';

describe('HttpGastosRepository', () => {
  let repo: HttpGastosRepository;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpGastosRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listar: GET /finanzas/gastos con todos los filtros, página y orden', () => {
    repo.listar({ id_periodo: 19, id_categoria: 1, texto: 'diesel', estado: 'VIGENTE', desde: '2026-10-01', hasta: '2026-10-13', page: 0, size: 20, sort: 'fecha_gasto,desc' }).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/finanzas/gastos');
    expect(req.request.method).toBe('GET');
    for (const [k, v] of Object.entries({ id_periodo: '19', id_categoria: '1', texto: 'diesel', estado: 'VIGENTE', desde: '2026-10-01', hasta: '2026-10-13', sort: 'fecha_gasto,desc' })) expect(req.request.params.get(k)).toBe(v);
    req.flush({ items: [], total: 0, page: 0, size: 20 });
  });

  it('resumen: GET /finanzas/gastos/resumen con los MISMOS filtros (y sin página ni orden)', () => {
    repo.resumen({ id_periodo: 19, id_categoria: 1, texto: 'diesel', estado: 'VIGENTE', desde: '2026-10-01', hasta: '2026-10-13' }).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/finanzas/gastos/resumen');
    expect(req.request.params.get('id_periodo')).toBe('19');
    expect(req.request.params.get('texto')).toBe('diesel');
    expect(req.request.params.has('page')).toBe(false);
    req.flush({ total: 0, cantidad: 0 });
  });

  it('porCategoria: GET /finanzas/gastos/por-categoria (la ruta nueva) con id_periodo opcional', () => {
    repo.porCategoria(19).subscribe();
    const a = http.expectOne((r) => ruta(r.url) === '/api/v1/finanzas/gastos/por-categoria');
    expect(a.request.params.get('id_periodo')).toBe('19');
    a.flush([]);

    repo.porCategoria().subscribe();
    const b = http.expectOne((r) => ruta(r.url) === '/api/v1/finanzas/gastos/por-categoria');
    expect(b.request.params.has('id_periodo')).toBe(false);
    b.flush([]);
  });

  it('categorias: GET /finanzas/categorias con soloActivas=true solo cuando se piden las activas', () => {
    repo.categorias(true).subscribe();
    const a = http.expectOne((r) => ruta(r.url) === '/api/v1/finanzas/categorias');
    expect(a.request.params.get('soloActivas')).toBe('true');
    a.flush([]);

    repo.categorias(false).subscribe();
    const b = http.expectOne((r) => ruta(r.url) === '/api/v1/finanzas/categorias');
    expect(b.request.params.has('soloActivas')).toBe(false);
    b.flush([]);
  });

  it('crear: POST /finanzas/gastos con Idempotency-Key', () => {
    const cuerpo = { id_categoria: 1, concepto: 'Diésel para el camión', monto: 85000.5, fecha_gasto: '2026-10-13' };
    repo.crear(cuerpo, 'clave-gasto-0001').subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/finanzas/gastos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-gasto-0001');
    req.flush({}, { status: 201, statusText: 'Created' });
  });

  it('anular: POST /finanzas/gastos/{id}/anular con motivo e Idempotency-Key', () => {
    repo.anular(7, 'Se digitó un monto equivocado', 'clave-anular-gst').subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/finanzas/gastos/7/anular');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo: 'Se digitó un monto equivocado' });
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-anular-gst');
    req.flush({});
  });
});
