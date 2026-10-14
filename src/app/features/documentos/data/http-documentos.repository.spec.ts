import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpDocumentosRepository } from './http-documentos.repository';

describe('HttpDocumentosRepository', () => {
  let repo: HttpDocumentosRepository;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpDocumentosRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listar: GET /documentos con tipo, entidad, estado, página y orden', () => {
    repo.listar({ tipo_entidad: 'RECEPCION_LECHE', id_entidad: 45, estado_carga: 'ERROR', page: 0, size: 10, sort: 'fecha_registro,desc' }).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/documentos');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('tipo_entidad')).toBe('RECEPCION_LECHE');
    expect(req.request.params.get('id_entidad')).toBe('45');
    expect(req.request.params.get('estado_carga')).toBe('ERROR');
    req.flush({ items: [], total: 0, page: 0, size: 10 });
  });

  it('pendientes: GET /documentos/pendientes (arreglo simple) con ?estado= opcional', () => {
    let lista: unknown;
    repo.pendientes('ERROR').subscribe((r) => (lista = r));
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/documentos/pendientes');
    expect(req.request.params.get('estado')).toBe('ERROR');
    req.flush([{ id_documento: 1 }]);
    expect(lista).toEqual([{ id_documento: 1 }]);
  });

  it('crear: POST /documentos con Idempotency-Key', () => {
    const cuerpo = { tipo_entidad: 'RECEPCION_LECHE' as const, id_entidad: 45, nombre_archivo: 'recepcion-45.pdf' };
    repo.crear(cuerpo, 'clave-doc-0001').subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/documentos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-doc-0001');
    req.flush({}, { status: 201, statusText: 'Created' });
  });

  it('marcarSubido y marcarError: POST /documentos/{id}/subido y /error con Idempotency-Key', () => {
    repo.marcarSubido(3, { drive_file_id: 'abc', drive_url: 'https://drive.google.com/file/d/abc' }, 'clave-subido-01').subscribe();
    const a = http.expectOne((r) => ruta(r.url) === '/api/v1/documentos/3/subido');
    expect(a.request.method).toBe('POST');
    expect(a.request.body).toEqual({ drive_file_id: 'abc', drive_url: 'https://drive.google.com/file/d/abc' });
    expect(a.request.headers.get('Idempotency-Key')).toBe('clave-subido-01');
    a.flush({});

    repo.marcarError(3, 'Sin conexión con Drive', 'clave-error-001').subscribe();
    const b = http.expectOne((r) => ruta(r.url) === '/api/v1/documentos/3/error');
    expect(b.request.body).toEqual({ mensaje: 'Sin conexión con Drive' });
    expect(b.request.headers.get('Idempotency-Key')).toBe('clave-error-001');
    b.flush({});
  });
});
