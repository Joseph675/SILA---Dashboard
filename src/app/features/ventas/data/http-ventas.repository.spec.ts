import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpVentasRepository } from './http-ventas.repository';

describe('HttpVentasRepository', () => {
  let repo: HttpVentasRepository;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpVentasRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listar: GET /ventas con filtros, página y orden', () => {
    repo.listar({ texto: 'rosa', estado_pago: 'PENDIENTE', tipo_venta: 'CREDITO', desde: '2026-10-01', hasta: '2026-10-09', page: 0, size: 20, sort: 'fecha_venta,desc' }).subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/ventas');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('texto')).toBe('rosa');
    expect(req.request.params.get('estado_pago')).toBe('PENDIENTE');
    expect(req.request.params.get('tipo_venta')).toBe('CREDITO');
    expect(req.request.params.get('sort')).toBe('fecha_venta,desc');
    req.flush({ items: [], total: 0, page: 0, size: 20 });
  });

  it('detalle: GET /ventas/{id}', () => {
    repo.detalle(12).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/ventas/12');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('precios: GET /ventas/precios con id_cliente, texto y solo_con_stock', () => {
    repo.precios({ id_cliente: 5, texto: 'queso', solo_con_stock: true, page: 0, size: 30 }).subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/ventas/precios');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('id_cliente')).toBe('5');
    expect(req.request.params.get('texto')).toBe('queso');
    expect(req.request.params.get('solo_con_stock')).toBe('true');
    req.flush({ items: [], total: 0, page: 0, size: 30 });
  });

  it('crear: POST /ventas con Idempotency-Key y SIN precios ni totales en el cuerpo', () => {
    const cuerpo = {
      id_cliente: 5,
      tipo_venta: 'CONTADO' as const,
      lineas: [{ id_producto: 3, cantidad: 2 }],
      pagos: [{ metodo_pago: 'EFECTIVO' as const, monto: 23.8 }],
    };
    repo.crear(cuerpo, 'clave-venta-0001').subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/ventas');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-venta-0001');
    expect(req.request.body).toEqual(cuerpo);
    const texto = JSON.stringify(req.request.body);
    for (const prohibido of ['precio', 'iva', 'total', 'subtotal', 'cambio']) expect(texto).not.toContain(prohibido);
    req.flush({}, { status: 201, statusText: 'Created' });
  });

  it('anular: POST /ventas/{id}/anular con el motivo y Idempotency-Key', () => {
    repo.anular(12, 'Se registró con el cliente equivocado', 'clave-anular-01').subscribe();

    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/ventas/12/anular');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo: 'Se registró con el cliente equivocado' });
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-anular-01');
    req.flush({});
  });
});
