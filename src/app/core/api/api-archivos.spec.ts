import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { AuthService } from '../services/auth.service';
import type { AuthResponse } from '../auth/auth.models';
import { ApiService } from './api.service';
import { nombreDeCabeceras } from './archivo-cabeceras';

@Component({ template: '' })
class Vacia {}

const OK = (token: string): AuthResponse => ({ estado: 'OK', access_token: token, expires_in: 900, usuario: { id_usuario: 1, usuario: 'ana', nombre: 'Ana', email: 'a@example.com', rol: 'ADMIN', mfa_activo: true } });
const cabeceras = (h: Record<string, string>) => ({ get: (n: string) => h[Object.keys(h).find((k) => k.toLowerCase() === n.toLowerCase()) ?? ''] ?? null });
const bytes = (texto: string, tipo = 'application/pdf') => new Blob([texto], { type: tipo });

describe('nombreDeCabeceras', () => {
  it('lee filename*=UTF-8\'\' y lo decodifica (tildes, eñes y espacios)', () => {
    const h = cabeceras({ 'Content-Disposition': `attachment; filename="VENTA-123.pdf"; filename*=UTF-8''Recibo%20Mar%C3%ADa%20Pe%C3%B1a%20%231.pdf` });
    expect(nombreDeCabeceras(h)).toBe('Recibo María Peña #1.pdf');
  });

  it('sin filename* usa filename="…"', () => {
    expect(nombreDeCabeceras(cabeceras({ 'Content-Disposition': 'attachment; filename="comprobante.pdf"' }))).toBe('comprobante.pdf');
    expect(nombreDeCabeceras(cabeceras({ 'Content-Disposition': 'attachment; filename=simple.pdf' }))).toBe('simple.pdf');
  });

  it('sin Content-Disposition usa X-Archivo-Nombre (con %-codificación)', () => {
    expect(nombreDeCabeceras(cabeceras({ 'X-Archivo-Nombre': 'Informe%20a%C3%B1o.pdf' }))).toBe('Informe año.pdf');
  });

  it('una ruta nunca llega como nombre: se queda con el último tramo', () => {
    expect(nombreDeCabeceras(cabeceras({ 'Content-Disposition': `attachment; filename*=UTF-8''..%2F..%2Fetc%2Fpasswd` }))).toBe('passwd');
    expect(nombreDeCabeceras(cabeceras({ 'Content-Disposition': 'attachment; filename="C:\\\\temp\\\\x.pdf"' }))).toBe('x.pdf');
  });

  it('un %-código roto no tumba: pasa a la siguiente fuente; sin nada, null', () => {
    expect(nombreDeCabeceras(cabeceras({ 'Content-Disposition': `attachment; filename*=UTF-8''%E0%A4%A`, 'X-Archivo-Nombre': 'ok.pdf' }))).toBe('ok.pdf');
    expect(nombreDeCabeceras(cabeceras({}))).toBeNull();
  });
});

describe('ApiService · archivos (blob y multipart)', () => {
  let api: ApiService;
  let http: HttpTestingController;
  let auth: AuthService;
  const ruta = (url: string) => new URL(url, 'http://host').pathname;
  const peticion = (path: string) => http.expectOne((r) => ruta(r.url) === `/api/v1/${path}`);

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])), provideHttpClientTesting(), provideRouter([{ path: 'login', component: Vacia }, { path: '', component: Vacia }])],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    auth.iniciarSesion('ana', 'x').subscribe();
    http.expectOne((r) => ruta(r.url) === '/api/v1/auth/login').flush(OK('token-viejo'));
    await TestBed.inject(Router).navigateByUrl('/');
  });
  afterEach(() => http.verify());

  describe('getBlob', () => {
    it('devuelve los bytes con el nombre, el id y SIN clave generada', async () => {
      const promesa = firstValueFrom(api.getBlob('archivos/7/contenido'));
      const req = peticion('archivos/7/contenido');
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      expect(req.request.headers.has('Idempotency-Key')).toBe(false);
      req.flush(bytes('%PDF-1.7'), { headers: { 'Content-Disposition': `attachment; filename="a.pdf"; filename*=UTF-8''Cobro%20n%C3%BAmero%201.pdf`, 'X-Archivo-Id': '7' } });
      const r = await promesa;

      expect(r.nombre).toBe('Cobro número 1.pdf');
      expect(r.idArchivo).toBe(7);
      expect(r.claveGenerada).toBeNull();
      expect(await r.blob.text()).toBe('%PDF-1.7');
    });

    it('envía el token de acceso', () => {
      api.getBlob('archivos/7/contenido').subscribe();
      const req = peticion('archivos/7/contenido');
      expect(req.request.headers.get('Authorization')).toBe('Bearer token-viejo');
      req.flush(bytes('x'));
    });
  });

  describe('postBlob', () => {
    it('lee X-Clave-Generada y X-Archivo-Id; el cuerpo viaja en JSON y sin Idempotency-Key', async () => {
      const promesa = firstValueFrom(api.postBlob('archivos/9/descarga', { modo_clave: 'ALEATORIA' }));
      const req = peticion('archivos/9/descarga');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ modo_clave: 'ALEATORIA' });
      expect(req.request.headers.has('Idempotency-Key')).toBe(false);
      req.flush(bytes('%PDF'), { headers: { 'X-Archivo-Id': '9', 'X-Archivo-Nombre': 'Recibo%20%C3%B1.pdf', 'X-Clave-Generada': 'K7MQ-4XPD-9TRB' } });
      const r = await promesa;

      expect(r.claveGenerada).toBe('K7MQ-4XPD-9TRB');
      expect(r.idArchivo).toBe(9);
      expect(r.nombre).toBe('Recibo ñ.pdf');
    });

    it('un X-Archivo-Id raro no inventa un id', async () => {
      const promesa = firstValueFrom(api.postBlob('archivos/9/descarga', {}));
      peticion('archivos/9/descarga').flush(bytes('x'), { headers: { 'X-Archivo-Id': 'abc' } });
      expect((await promesa).idArchivo).toBeNull();
    });
  });

  describe('postFormData', () => {
    it('manda el FormData tal cual y NO fija Content-Type (lo pone el navegador con su boundary)', () => {
      const datos = new FormData();
      datos.append('archivo', new File(['%PDF'], 'a.pdf', { type: 'application/pdf' }));
      datos.append('id_carpeta', '3');
      api.postFormData('archivos', datos).subscribe();
      const req = peticion('archivos');

      expect(req.request.body).toBe(datos);
      expect(req.request.headers.has('Content-Type')).toBe(false);
      expect(req.request.headers.has('Idempotency-Key')).toBe(false);
      req.flush({});
    });

    it('postFormDataBlob responde bytes con sus cabeceras', async () => {
      const datos = new FormData();
      datos.append('archivo', new File(['x'], 'a.sila'));
      const promesa = firstValueFrom(api.postFormDataBlob('archivos/descifrar', datos));
      const req = peticion('archivos/descifrar');
      expect(req.request.responseType).toBe('blob');
      req.flush(bytes('%PDF'), { headers: { 'X-Archivo-Id': '5', 'X-Archivo-Nombre': 'orig.pdf' } });

      expect(await promesa).toMatchObject({ nombre: 'orig.pdf', idArchivo: 5 });
    });
  });

  describe('errores con el cuerpo dentro de un Blob', () => {
    async function fallo(promesa: Promise<unknown>): Promise<{ code: number; message: string }> {
      return promesa.then(
        () => {
          throw new Error('debía fallar');
        },
        (e) => e,
      );
    }

    it('un 422 con JSON dentro del blob llega como ApiError con su code y message (no como «error de conexión»)', async () => {
      const promesa = fallo(firstValueFrom(api.postFormData('archivos', new FormData())));
      peticion('archivos').flush({ code: 20018, message: 'El archivo no es un PDF válido.' }, { status: 422, statusText: 'Unprocessable' });
      expect(await promesa).toEqual({ code: 20018, message: 'El archivo no es un PDF válido.' });

      const blobPromesa = fallo(firstValueFrom(api.getBlob('archivos/7/contenido')));
      peticion('archivos/7/contenido').flush(bytes(JSON.stringify({ code: 20018, message: 'No se admite este archivo.' }), 'application/json'), { status: 422, statusText: 'Unprocessable' });
      expect(await blobPromesa).toEqual({ code: 20018, message: 'No se admite este archivo.' });
    });

    it('un 503 del antivirus (20019) también', async () => {
      const promesa = fallo(firstValueFrom(api.postBlob('archivos/9/descarga', {})));
      peticion('archivos/9/descarga').flush(bytes(JSON.stringify({ code: 20019, message: 'El antivirus no responde.' }), 'application/json'), { status: 503, statusText: 'Unavailable' });

      expect(await promesa).toEqual({ code: 20019, message: 'El antivirus no responde.' });
    });

    it('un 400 con campos (la clave fuera de largo) conserva `fields`', async () => {
      const promesa = firstValueFrom(api.postBlob('archivos/9/descarga', { modo_clave: 'ESCRITA', clave: 'ab' })).catch((e) => e);
      peticion('archivos/9/descarga').flush(bytes(JSON.stringify({ code: 20001, message: 'Datos inválidos', fields: { clave: 'Entre 4 y 64 caracteres' } }), 'application/json'), { status: 400, statusText: 'Bad Request' });

      expect(await promesa).toEqual({ code: 20001, message: 'Datos inválidos', fields: { clave: 'Entre 4 y 64 caracteres' } });
    });

    it('un 413 sin JSON (el proxy responde HTML) dice que supera el tamaño máximo', async () => {
      const promesa = fallo(firstValueFrom(api.postFormData('archivos', new FormData())));
      peticion('archivos').flush('<html>413</html>', { status: 413, statusText: 'Payload Too Large' });

      expect((await promesa).message).toContain('10 MB');
    });

    it('un error sin cuerpo legible no se confunde con «sin conexión» (503 sin JSON → error interno)', async () => {
      const promesa = fallo(firstValueFrom(api.getBlob('archivos/7/contenido')));
      peticion('archivos/7/contenido').flush(bytes('Bad gateway', 'text/plain'), { status: 502, statusText: 'Bad Gateway' });

      expect(await promesa).toEqual({ code: 20999, message: 'Error interno del servidor.' });
    });

    it('401 con el token vencido (20013) dentro de un blob: renueva el token UNA vez y reintenta con el nuevo', async () => {
      const promesa = firstValueFrom(api.getBlob('archivos/7/contenido'));
      peticion('archivos/7/contenido').flush(bytes(JSON.stringify({ code: 20013, message: 'Sesion no valida o vencida.' }), 'application/json'), { status: 401, statusText: 'Unauthorized' });
      await Promise.resolve();
      await new Promise((r) => setTimeout(r));
      http.expectOne((r) => ruta(r.url) === '/api/v1/auth/refresh').flush(OK('token-nuevo'));
      await new Promise((r) => setTimeout(r));
      const reintento = peticion('archivos/7/contenido');
      expect(reintento.request.headers.get('Authorization')).toBe('Bearer token-nuevo');
      reintento.flush(bytes('%PDF'), { headers: { 'X-Archivo-Id': '7' } });

      expect((await promesa).idArchivo).toBe(7);
    });
  });
});
