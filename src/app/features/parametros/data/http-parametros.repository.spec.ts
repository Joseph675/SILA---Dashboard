import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpParametrosRepository } from './http-parametros.repository';

describe('HttpParametrosRepository', () => {
  let repo: HttpParametrosRepository;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpParametrosRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listar: GET /parametros (arreglo simple)', () => {
    let lista: unknown;
    repo.listar().subscribe((r) => (lista = r));
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/parametros');
    expect(req.request.method).toBe('GET');
    req.flush([{ clave: 'PLAZO_CREDITO_DIAS', valor: 30, minimo: 0, maximo: 365, descripcion: 'x' }]);
    expect(lista).toHaveLength(1);
  });

  it('actualizar: PUT /parametros/{clave} con {valor} y sin Idempotency-Key', () => {
    repo.actualizar('PLAZO_CREDITO_DIAS', 45).subscribe();
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/parametros/PLAZO_CREDITO_DIAS');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ valor: 45 });
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    req.flush({});
  });
});
