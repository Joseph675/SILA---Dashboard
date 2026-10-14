import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpCatalogosRepository } from './http-catalogos.repository';

describe('HttpCatalogosRepository · recetas', () => {
  let repo: HttpCatalogosRepository;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpCatalogosRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('obtenerReceta: GET /catalogos/productos/{id}/receta', () => {
    repo.obtenerReceta(7).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/catalogos/productos/7/receta');
    expect(req.request.method).toBe('GET');
    req.flush({ id_producto: 7, lineas: [] });
  });

  it('guardarReceta: PUT con la lista completa en {lineas}; [] la vacía', () => {
    repo.guardarReceta(7, [{ id_insumo: 1, cantidad: 0.5 }]).subscribe();
    const a = http.expectOne((r) => ruta(r.url) === '/api/v1/catalogos/productos/7/receta');
    expect(a.request.method).toBe('PUT');
    expect(a.request.body).toEqual({ lineas: [{ id_insumo: 1, cantidad: 0.5 }] });
    a.flush({});

    repo.guardarReceta(7, []).subscribe();
    const b = http.expectOne((r) => ruta(r.url) === '/api/v1/catalogos/productos/7/receta');
    expect(b.request.body).toEqual({ lineas: [] });
    b.flush({});
  });

  it('crearProducto: manda la receta dentro del cuerpo', () => {
    repo.crearProducto({ codigo_sku: 'AREQ', nombre: 'Arequipe', unidad_medida: 'UND', precio_base: 5000, tarifa_iva: 19, receta: [{ id_insumo: 1, cantidad: 0.5 }] }).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/catalogos/productos' && r.method === 'POST');
    expect(req.request.body.receta).toEqual([{ id_insumo: 1, cantidad: 0.5 }]);
    req.flush({}, { status: 201, statusText: 'Created' });
  });

  it('cambiarStockMinimoProducto: PATCH /catalogos/productos/{id}/stock-minimo con {stock_minimo}', () => {
    repo.cambiarStockMinimoProducto(7, 12.5).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/catalogos/productos/7/stock-minimo');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ stock_minimo: 12.5 });
    req.flush({});
  });

  it('crearProducto y actualizarProducto mandan stock_minimo cuando se da', () => {
    repo.crearProducto({ codigo_sku: 'AREQ', nombre: 'Arequipe', unidad_medida: 'UND', precio_base: 1, tarifa_iva: 0, stock_minimo: 5 }).subscribe();
    const a = http.expectOne((r) => ruta(r.url) === '/api/v1/catalogos/productos' && r.method === 'POST');
    expect(a.request.body.stock_minimo).toBe(5);
    a.flush({}, { status: 201, statusText: 'Created' });

    repo.actualizarProducto(7, { nombre: 'Arequipe', unidad_medida: 'UND', stock_minimo: 6 }).subscribe();
    const b = http.expectOne((r) => ruta(r.url) === '/api/v1/catalogos/productos/7' && r.method === 'PUT');
    expect(b.request.body.stock_minimo).toBe(6);
    b.flush({});
  });
});
