import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpComprobantesRepository } from './http-comprobantes.repository';

describe('HttpComprobantesRepository', () => {
  let repo: HttpComprobantesRepository;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpComprobantesRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listar: GET /comprobantes con todos los filtros, página y orden', () => {
    repo.listar({ tipo: 'VENTA', sentido: 'INGRESO', estado: 'VIGENTE', id_periodo: 19, texto: 'pérez', desde: '2026-10-01', hasta: '2026-10-13', page: 1, size: 20, sort: 'monto,desc' }).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/comprobantes');
    expect(req.request.method).toBe('GET');
    for (const [k, v] of Object.entries({ tipo: 'VENTA', sentido: 'INGRESO', estado: 'VIGENTE', id_periodo: '19', texto: 'pérez', desde: '2026-10-01', hasta: '2026-10-13', page: '1', size: '20', sort: 'monto,desc' })) {
      expect(req.request.params.get(k)).toBe(v);
    }
    req.flush({ items: [], total: 0, page: 1, size: 20 });
  });

  it('listar: un filtro vacío no viaja', () => {
    repo.listar({ tipo: undefined, page: 0, size: 10 }).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/comprobantes');
    expect(req.request.params.has('tipo')).toBe(false);
    req.flush({ items: [], total: 0, page: 0, size: 10 });
  });

  it('resumen: GET /comprobantes/resumen con los filtros y sin página ni orden', () => {
    repo.resumen({ tipo: 'GASTO', sentido: 'EGRESO', id_periodo: 19, texto: 'diesel', desde: '2026-10-01', hasta: '2026-10-13' }).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/comprobantes/resumen');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('tipo')).toBe('GASTO');
    expect(req.request.params.get('id_periodo')).toBe('19');
    expect(req.request.params.has('page')).toBe(false);
    expect(req.request.params.has('estado')).toBe(false);
    req.flush({ ingresos: 0, egresos: 85000, neto: -85000, cantidad: 1 });
  });

  it('detalle: GET /comprobantes/{tipo}/{id} (para un abono, el id es el recibo)', () => {
    let recibido: unknown;
    repo.detalle('ABONO', 77).subscribe((d) => (recibido = d));
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/comprobantes/ABONO/77');
    expect(req.request.method).toBe('GET');
    req.flush({ comprobante: { numero: 'ABONO #77' }, lineas: [], pagos: [], subtotal: null, iva: null });
    expect(recibido).toMatchObject({ subtotal: null, iva: null });
  });
});
