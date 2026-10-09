import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpCarteraRepository } from './http-cartera.repository';

describe('HttpCarteraRepository', () => {
  let repo: HttpCarteraRepository;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpCarteraRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('clientes: GET /cartera/clientes con filtros, página y orden', () => {
    repo.clientes({ texto: 'rosa', estado_credito: 'EN_MORA', solo_con_deuda: false, mora_minima: 5, page: 0, size: 20, sort: 'saldo_deudor,desc' }).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/cartera/clientes');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('estado_credito')).toBe('EN_MORA');
    expect(req.request.params.get('solo_con_deuda')).toBe('false');
    expect(req.request.params.get('mora_minima')).toBe('5');
    req.flush({ items: [], total: 0, page: 0, size: 20 });
  });

  it('resumen: GET /cartera/resumen', () => {
    repo.resumen().subscribe();
    http.expectOne((r) => ruta(r.url) === '/api/v1/cartera/resumen').flush({});
  });

  it('ventasPendientes: GET /cartera/clientes/{id}/ventas-pendientes (arreglo simple)', () => {
    let lista: unknown;
    repo.ventasPendientes(5).subscribe((r) => (lista = r));
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/cartera/clientes/5/ventas-pendientes');
    expect(req.request.method).toBe('GET');
    req.flush([{ id_venta: 1 }]);
    expect(lista).toEqual([{ id_venta: 1 }]);
  });

  it('abonos: GET /cartera/abonos con cliente, medio, recibo y fechas', () => {
    repo.abonos({ id_cliente: 5, metodo_pago: 'TARJETA', id_recibo: 9, desde: '2026-10-01', page: 0, size: 20 }).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/cartera/abonos');
    expect(req.request.params.get('metodo_pago')).toBe('TARJETA');
    expect(req.request.params.get('id_recibo')).toBe('9');
    req.flush({ items: [], total: 0, page: 0, size: 20 });
  });

  it('registrarAbono: POST /cartera/abonos con Idempotency-Key', () => {
    const cuerpo = { id_cliente: 5, monto: 500, metodo_pago: 'EFECTIVO' as const };
    repo.registrarAbono(cuerpo, 'clave-abono-001').subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/cartera/abonos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-abono-001');
    req.flush({}, { status: 201, statusText: 'Created' });
  });

  it('castigar: POST /cartera/castigos con motivo e Idempotency-Key', () => {
    const cuerpo = { id_cliente: 5, motivo: 'Cliente desaparecido hace un año' };
    repo.castigar(cuerpo, 'clave-castigo-01').subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/cartera/castigos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-castigo-01');
    req.flush({});
  });
});
