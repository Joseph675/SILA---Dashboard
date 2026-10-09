import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpPreciosClienteRepository } from './http-precios-cliente.repository';

describe('HttpPreciosClienteRepository', () => {
  let repo: HttpPreciosClienteRepository;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpPreciosClienteRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listar: GET /precios-cliente con cliente y activo', () => {
    repo.listar({ id_cliente: 5, activo: true, page: 0, size: 20, sort: 'producto,asc' }).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/precios-cliente');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('id_cliente')).toBe('5');
    expect(req.request.params.get('activo')).toBe('true');
    req.flush({ items: [], total: 0, page: 0, size: 20 });
  });

  it('fijar: PUT /precios-cliente con cliente, producto y precio', () => {
    repo.fijar({ id_cliente: 5, id_producto: 3, precio: 12 }).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/precios-cliente');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ id_cliente: 5, id_producto: 3, precio: 12 });
    req.flush({});
  });

  it('desactivar: PATCH /precios-cliente/{id}/estado con {activo: false}', () => {
    repo.desactivar(4).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/precios-cliente/4/estado');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ activo: false });
    req.flush({});
  });
});
