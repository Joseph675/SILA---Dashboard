import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { HttpArchivosRepository } from './http-archivos.repository';

describe('HttpArchivosRepository', () => {
  let repo: HttpArchivosRepository;
  let http: HttpTestingController;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;
  /** The query string that REALLY goes out (HttpClient keeps a hand-made `?ruta=…` in the URL, not in `params`). */
  const consulta = (req: { request: { urlWithParams: string } }) => new URL(req.request.urlWithParams, 'http://host').searchParams;
  const peticion = (path: string) => http.expectOne((r) => ruta(r.url) === `/api/v1/${path}`);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpArchivosRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  describe('explorador', () => {
    it('la raíz: GET /archivos/explorador sin arbol ni ruta', () => {
      repo.explorador({ page: 0, size: 20, sort: 'fecha,desc' }).subscribe();
      const req = peticion('archivos/explorador');

      expect(consulta(req).has('arbol')).toBe(false);
      expect(consulta(req).has('ruta')).toBe(false);
      expect(consulta(req).get('size')).toBe('20');
      req.flush({ arbol: null, ruta: [], carpetas: [{ clave: 'TIPO', nombre: 'Por tipo', cantidad: 12 }], archivos: { items: [], total: 0, page: 0, size: 20 }, puede_subir: false });
    });

    it('un nivel con ruta REPETIDA: ?arbol=TIPO&ruta=VENTA&ruta=2026 (cada clave en su parámetro)', () => {
      repo.explorador({ arbol: 'TIPO', ruta: ['VENTA', '2026'], page: 1, size: 10, sort: 'monto,asc', incluir_archivados: true }).subscribe();
      const req = peticion('archivos/explorador');

      expect(consulta(req).getAll('ruta')).toEqual(['VENTA', '2026']);
      expect(consulta(req).get('arbol')).toBe('TIPO');
      expect(consulta(req).get('incluir_archivados')).toBe('true');
      expect(consulta(req).get('page')).toBe('1');
      expect(consulta(req).get('sort')).toBe('monto,asc');
      req.flush({});
    });

    it('una clave con caracteres especiales viaja codificada y vuelve igual', () => {
      repo.explorador({ arbol: 'MANUAL', ruta: ['a&b=c', '10-1'], page: 0, size: 10 }).subscribe();
      const req = peticion('archivos/explorador');

      expect(consulta(req).getAll('ruta')).toEqual(['a&b=c', '10-1']);
      expect(consulta(req).getAll('arbol')).toEqual(['MANUAL']);
      req.flush({});
    });

    it('devuelve las migas (ruta con nombres) y puede_subir tal cual', async () => {
      const promesa = firstValueFrom(repo.explorador({ arbol: 'MANUAL', ruta: ['3'], page: 0, size: 10 }));
      peticion('archivos/explorador').flush({ arbol: 'MANUAL', ruta: [{ clave: '3', nombre: 'Contratos', cantidad: 2 }], carpetas: [], archivos: { items: [], total: 0, page: 0, size: 10 }, puede_subir: true });
      const r = await promesa;

      expect(r.ruta.map((e) => e.nombre)).toEqual(['Contratos']);
      expect(r.puede_subir).toBe(true);
    });
  });

  describe('lecturas', () => {
    it('listar: GET /archivos con los filtros', () => {
      repo.listar({ page: 0, size: 20, sort: 'fecha,desc', texto: 'maría', origen: 'COMPROBANTE', tipo: 'VENTA', version: 'ANULADO', archivado: false, estado_drive: 'ERROR', desde: '2026-10-01', hasta: '2026-10-31' }).subscribe();
      const req = peticion('archivos');

      for (const [k, v] of Object.entries({ texto: 'maría', origen: 'COMPROBANTE', tipo: 'VENTA', version: 'ANULADO', archivado: 'false', estado_drive: 'ERROR', desde: '2026-10-01', hasta: '2026-10-31' })) expect(req.request.params.get(k)).toBe(v);
      req.flush({ items: [], total: 0, page: 0, size: 20 });
    });

    it('obtener, deComprobante y opcionesDescarga', () => {
      repo.obtener(7).subscribe();
      expect(peticion('archivos/7').request.method).toBe('GET');
      http.match(() => true).forEach((r) => r.flush({}));
      repo.deComprobante('ABONO', 55).subscribe();
      peticion('archivos/comprobante/ABONO/55').flush([]);
      repo.opcionesDescarga(7).subscribe();
      peticion('archivos/7/opciones-descarga').flush({});
    });

    it('carpetas: id_padre e incluir_archivadas solo si se piden', () => {
      repo.carpetas().subscribe();
      const a = peticion('archivos/carpetas');
      expect(a.request.params.has('id_padre')).toBe(false);
      expect(a.request.params.has('incluir_archivadas')).toBe(false);
      a.flush([]);
      repo.carpetas(4, true).subscribe();
      const b = peticion('archivos/carpetas');
      expect(b.request.params.get('id_padre')).toBe('4');
      expect(b.request.params.get('incluir_archivadas')).toBe('true');
      b.flush([]);
    });

    it('accesos: GET /archivos/accesos con filtros', () => {
      repo.accesos({ page: 0, size: 20, usuario: 'ana', accion: 'DESCARGAR', id_documento: 7 }).subscribe();
      const req = peticion('archivos/accesos');
      expect(req.request.params.get('accion')).toBe('DESCARGAR');
      expect(req.request.params.get('id_documento')).toBe('7');
      req.flush({ items: [], total: 0, page: 0, size: 20 });
    });
  });

  describe('contenido y descarga con clave (binarios)', () => {
    it('contenido: GET como blob', async () => {
      const promesa = firstValueFrom(repo.contenido(7));
      const req = peticion('archivos/7/contenido');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['%PDF'], { type: 'application/pdf' }), { headers: { 'X-Archivo-Id': '7' } });
      expect((await promesa).idArchivo).toBe(7);
    });

    it('ESCRITA manda modo_clave y la clave; DOCUMENTO y ALEATORIA mandan SOLO el modo', () => {
      repo.descargar(7, 'ESCRITA', 'mi-clave').subscribe();
      const a = peticion('archivos/7/descarga');
      expect(a.request.body).toEqual({ modo_clave: 'ESCRITA', clave: 'mi-clave' });
      a.flush(new Blob(['x']));
      repo.descargar(7, 'DOCUMENTO', 'no-debe-viajar').subscribe();
      const b = peticion('archivos/7/descarga');
      expect(b.request.body).toEqual({ modo_clave: 'DOCUMENTO' });
      b.flush(new Blob(['x']));
      repo.descargar(7, 'ALEATORIA').subscribe();
      const c = peticion('archivos/7/descarga');
      expect(c.request.body).toEqual({ modo_clave: 'ALEATORIA' });
      c.flush(new Blob(['x']), { headers: { 'X-Clave-Generada': 'K7MQ-4XPD-9TRB' } });
    });

    it('la clave NUNCA va en la URL', () => {
      repo.descargar(7, 'ESCRITA', 'secreta-123').subscribe();
      const req = peticion('archivos/7/descarga');
      expect(req.request.urlWithParams).not.toContain('secreta');
      req.flush(new Blob(['x']));
    });
  });

  describe('escrituras', () => {
    it('subir: multipart con «archivo» e «id_carpeta», sin Idempotency-Key ni Content-Type', () => {
      const f = new File(['%PDF'], 'contrato.pdf', { type: 'application/pdf' });
      repo.subir(f, 3).subscribe();
      const req = peticion('archivos');
      const datos = req.request.body as FormData;

      expect(req.request.method).toBe('POST');
      expect((datos.get('archivo') as File).name).toBe('contrato.pdf');
      expect(datos.get('id_carpeta')).toBe('3');
      expect(req.request.headers.has('Idempotency-Key')).toBe(false);
      expect(req.request.headers.has('Content-Type')).toBe(false);
      req.flush({});
    });

    it('subir a la raíz de «Mis carpetas»: sin id_carpeta', () => {
      repo.subir(new File(['x'], 'a.png')).subscribe();
      const req = peticion('archivos');
      expect((req.request.body as FormData).has('id_carpeta')).toBe(false);
      req.flush({});
    });

    it('archivar: POST /archivos/{id}/archivar {motivo}; carpetas: crear y archivar', () => {
      repo.archivar(7, 'Ya no sirve').subscribe();
      const a = peticion('archivos/7/archivar');
      expect(a.request.body).toEqual({ motivo: 'Ya no sirve' });
      a.flush({});
      repo.crearCarpeta('Contratos', null).subscribe();
      const b = peticion('archivos/carpetas');
      expect(b.request.body).toEqual({ id_padre: null, nombre: 'Contratos' });
      b.flush({});
      repo.archivarCarpeta(4, 'Duplicada').subscribe();
      const c = peticion('archivos/carpetas/4/archivar');
      expect(c.request.body).toEqual({ motivo: 'Duplicada' });
      c.flush({});
    });

    it('NINGUNA ruta de archivos manda Idempotency-Key', () => {
      repo.archivar(7, 'motivo largo').subscribe();
      const a = peticion('archivos/7/archivar');
      expect(a.request.headers.has('Idempotency-Key')).toBe(false);
      a.flush({});
      repo.crearCarpeta('X', 1).subscribe();
      const b = peticion('archivos/carpetas');
      expect(b.request.headers.has('Idempotency-Key')).toBe(false);
      b.flush({});
      repo.driveSincronizar().subscribe();
      const c = peticion('archivos/drive/sincronizar');
      expect(c.request.headers.has('Idempotency-Key')).toBe(false);
      c.flush({});
    });

    it('descifrar: multipart con «archivo» y respuesta binaria', async () => {
      const promesa = firstValueFrom(repo.descifrar(new File(['x'], 'ab12.sila')));
      const req = peticion('archivos/descifrar');
      expect(req.request.responseType).toBe('blob');
      expect(((req.request.body as FormData).get('archivo') as File).name).toBe('ab12.sila');
      req.flush(new Blob(['%PDF']), { headers: { 'X-Archivo-Nombre': 'orig.pdf' } });
      expect((await promesa).nombre).toBe('orig.pdf');
    });
  });

  describe('Drive', () => {
    it('estado, autorizar, sincronizar y desconectar', () => {
      repo.driveEstado().subscribe();
      expect(peticion('archivos/drive/estado').request.method).toBe('GET');
      http.match(() => true).forEach((r) => r.flush({}));
      repo.driveAutorizar().subscribe();
      expect(peticion('archivos/drive/autorizar').request.method).toBe('GET');
      http.match(() => true).forEach((r) => r.flush({ url: 'https://accounts.google.com/x' }));
      repo.driveSincronizar().subscribe();
      expect(peticion('archivos/drive/sincronizar').request.method).toBe('POST');
      http.match(() => true).forEach((r) => r.flush({}));
      repo.driveDesconectar().subscribe();
      expect(peticion('archivos/drive/desconectar').request.method).toBe('POST');
      http.match(() => true).forEach((r) => r.flush({}));
    });
  });
});
