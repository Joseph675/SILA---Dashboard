import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpTableroRepository } from './http-tablero.repository';

describe('HttpTableroRepository', () => {
  let repo: HttpTableroRepository;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpTableroRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('obtener: UNA sola llamada GET /tablero, sin parámetros ni cuerpo', () => {
    let recibido: unknown;
    repo.obtener().subscribe((t) => (recibido = t));
    const req = http.expectOne((r) => ruta(r.url) === '/api/v1/tablero');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ fecha: '2026-10-14', quincena: null, ventas_semana: [] });
    expect(recibido).toMatchObject({ fecha: '2026-10-14', quincena: null });
  });

  it('un error del servidor llega como error del observable (no se traga)', () => {
    let fallo: unknown;
    repo.obtener().subscribe({ error: (e) => (fallo = e) });
    http.expectOne((r) => ruta(r.url) === '/api/v1/tablero').flush({ code: 20099, message: 'boom' }, { status: 500, statusText: 'x' });
    expect(fallo).toBeTruthy();
  });
});
