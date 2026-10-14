import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpInsumosRepository } from './http-insumos.repository';

describe('HttpInsumosRepository', () => {
  let repo: HttpInsumosRepository;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpInsumosRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listar: GET /insumos con texto, activo, bajo_minimo, página y orden', () => {
    repo.listar({ texto: 'azu', activo: true, bajo_minimo: true, page: 0, size: 20, sort: 'nombre,asc' }).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/insumos');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('bajo_minimo')).toBe('true');
    expect(req.request.params.get('activo')).toBe('true');
    expect(req.request.params.get('sort')).toBe('nombre,asc');
    req.flush({ items: [], total: 0, page: 0, size: 20 });
  });

  it('resumen: GET /insumos/resumen', () => {
    repo.resumen().subscribe();
    http.expectOne((r) => ruta(r.url) === '/api/v1/insumos/resumen').flush({});
  });

  it('crear / actualizar / cambiarEstado: POST /insumos, PUT /insumos/{id}, PATCH /insumos/{id}/estado', () => {
    repo.crear({ codigo: 'AZUCAR', nombre: 'Azúcar', unidad_medida: 'KG', stock_minimo: 5 }).subscribe();
    const a = http.expectOne((r) => ruta(r.url) === '/api/v1/insumos');
    expect(a.request.method).toBe('POST');
    expect(a.request.body).toEqual({ codigo: 'AZUCAR', nombre: 'Azúcar', unidad_medida: 'KG', stock_minimo: 5 });
    a.flush({}, { status: 201, statusText: 'Created' });

    repo.actualizar(1, { nombre: 'Azúcar refinada', unidad_medida: 'KG', stock_minimo: 8 }).subscribe();
    const b = http.expectOne((r) => ruta(r.url) === '/api/v1/insumos/1');
    expect(b.request.method).toBe('PUT');
    expect(b.request.body).toEqual({ nombre: 'Azúcar refinada', unidad_medida: 'KG', stock_minimo: 8 });
    b.flush({});

    repo.cambiarEstado(1, false).subscribe();
    const c = http.expectOne((r) => ruta(r.url) === '/api/v1/insumos/1/estado');
    expect(c.request.method).toBe('PATCH');
    expect(c.request.body).toEqual({ activo: false });
    c.flush({});
  });

  it('listarCompras: GET /insumos/compras con insumo, proveedor, estado y fechas', () => {
    repo.listarCompras({ id_insumo: 1, id_proveedor: 4, estado: 'VIGENTE', desde: '2026-10-01', hasta: '2026-10-13', page: 0, size: 20 }).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/insumos/compras');
    expect(req.request.params.get('id_proveedor')).toBe('4');
    expect(req.request.params.get('estado')).toBe('VIGENTE');
    expect(req.request.params.has('sort')).toBe(false);
    req.flush({ items: [], total: 0, page: 0, size: 20 });
  });

  it('crearCompra: POST /insumos/compras con valor_total y Idempotency-Key', () => {
    const cuerpo = { id_insumo: 1, id_proveedor: 4, cantidad: 10, valor_total: 40000, referencia: 'F-1', fecha: '2026-10-13' };
    repo.crearCompra(cuerpo, 'clave-compra-001').subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/insumos/compras');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-compra-001');
    req.flush({}, { status: 201, statusText: 'Created' });
  });

  it('anularCompra: POST /insumos/compras/{id}/anular con motivo', () => {
    repo.anularCompra(3, 'Factura duplicada por error', 'clave-anular-ins').subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/insumos/compras/3/anular');
    expect(req.request.body).toEqual({ motivo: 'Factura duplicada por error' });
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-anular-ins');
    req.flush({});
  });

  it('listarAjustes / crearAjuste: GET con filtros y POST con Idempotency-Key', () => {
    repo.listarAjustes({ id_insumo: 1, tipo_ajuste: 'MERMA', page: 0, size: 20 }).subscribe();
    const a = http.expectOne((r) => ruta(r.url) === '/api/v1/insumos/ajustes');
    expect(a.request.params.get('tipo_ajuste')).toBe('MERMA');
    a.flush({ items: [], total: 0, page: 0, size: 20 });

    const cuerpo = { id_insumo: 1, tipo_ajuste: 'MERMA' as const, cantidad: 2, observacion: 'Se derramó una bolsa' };
    repo.crearAjuste(cuerpo, 'clave-ajuste-ins').subscribe();
    const b = http.expectOne((r) => ruta(r.url) === '/api/v1/insumos/ajustes' && r.method === 'POST');
    expect(b.request.body).toEqual(cuerpo);
    expect(b.request.headers.get('Idempotency-Key')).toBe('clave-ajuste-ins');
    b.flush({}, { status: 201, statusText: 'Created' });
  });

  it('consumosDeLote: GET /insumos/consumos?id_lote= (arreglo simple)', () => {
    let lista: unknown;
    repo.consumosDeLote(35).subscribe((r) => (lista = r));
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/insumos/consumos');
    expect(req.request.params.get('id_lote')).toBe('35');
    req.flush([{ id_consumo: 1 }]);
    expect(lista).toEqual([{ id_consumo: 1 }]);
  });
});
