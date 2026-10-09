import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpInventarioRepository } from './http-inventario.repository';

describe('HttpInventarioRepository', () => {
  let repo: HttpInventarioRepository;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpInventarioRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listar: GET /inventario con texto, solo_con_stock, página y orden', () => {
    repo.listar({ texto: 'queso', solo_con_stock: true, page: 0, size: 20, sort: 'producto,asc' }).subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/inventario');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('texto')).toBe('queso');
    expect(req.request.params.get('solo_con_stock')).toBe('true');
    expect(req.request.params.get('sort')).toBe('producto,asc');
    req.flush({ items: [], total: 0, page: 0, size: 20 });
  });

  it('resumen: GET /inventario/resumen', () => {
    let resumen: unknown;
    repo.resumen().subscribe((r) => (resumen = r));

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/inventario/resumen');
    expect(req.request.method).toBe('GET');
    req.flush({ total_productos: 4, productos_sin_stock: 1, valor_total: 1000 });
    expect(resumen).toEqual({ total_productos: 4, productos_sin_stock: 1, valor_total: 1000 });
  });

  it('alertasCaducidad: GET /inventario/alertas-caducidad con dias_maximos', () => {
    repo.alertasCaducidad({ dias_maximos: 30, page: 0, size: 10, sort: 'dias_restantes,asc' }).subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/inventario/alertas-caducidad');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('dias_maximos')).toBe('30');
    expect(req.request.params.has('dias_vencidos')).toBe(false);
    req.flush({ items: [], total: 0, page: 0, size: 10 });
  });
});
