import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import type { RespuestaArchivo } from '../../core/api/archivo-cabeceras';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ARCHIVOS_REPOSITORY } from './data/archivos.provider';
import { estabilizar, limpio, polyfillDialog } from './pruebas.comunes';
import { VerDocumentoPageComponent } from './ver-documento-page.component';
import { VisorArchivosComponent } from './visor-archivos.component';
import { VisorArchivosService } from './visor-archivos.service';

const pdf = (extra: Partial<RespuestaArchivo> = {}): RespuestaArchivo => ({ blob: new Blob(['%PDF'], { type: 'application/pdf' }), nombre: 'Acta.pdf', idArchivo: 7, claveGenerada: null, ...extra });
const png = (): RespuestaArchivo => ({ blob: new Blob(['\x89PNG'], { type: 'image/png' }), nombre: 'foto.png', idArchivo: 8, claveGenerada: null });

describe('Visor de archivos', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: Record<string, any>;
  let visor: VisorArchivosService;
  let urls: string[];

  beforeAll(polyfillDialog);
  beforeEach(() => {
    urls = [];
    let n = 0;
    URL.createObjectURL = vi.fn(() => {
      const u = `blob:prueba-${n++}`;
      urls.push(u);
      return u;
    });
    URL.revokeObjectURL = vi.fn();
    repo = { contenido: vi.fn(() => of(pdf())) };
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: ARCHIVOS_REPOSITORY, useValue: repo }] });
    visor = TestBed.inject(VisorArchivosService);
  });
  afterEach(() => vi.restoreAllMocks());

  it('un PDF se abre en una pestaña NUEVA con la URL blob, sin vínculo de vuelta (opener = null)', async () => {
    const ventana = { opener: {} as unknown };
    const abrir = vi.spyOn(window, 'open').mockReturnValue(ventana as Window);
    await visor.ver(7, 'Acta.pdf');

    expect(repo['contenido']).toHaveBeenCalledWith(7);
    expect(abrir).toHaveBeenCalledWith('blob:prueba-0', '_blank');
    expect(ventana.opener).toBeNull();
    expect(visor.imagen()).toBeNull();
    expect(visor.bloqueado()).toBeNull();
  });

  it('un PDF NUNCA se incrusta en la página (ni iframe, ni object, ni embed)', async () => {
    vi.spyOn(window, 'open').mockReturnValue({} as Window);
    await visor.ver(7);
    const f = TestBed.createComponent(VisorArchivosComponent);
    await estabilizar(f);

    expect(document.querySelector('iframe, object, embed')).toBeNull();
    expect((f.nativeElement as HTMLElement).querySelector('iframe, object, embed')).toBeNull();
  });

  it('si el navegador bloquea la pestaña, queda un botón «Abrir» con la URL (rel=noopener)', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    await visor.ver(7, 'Acta.pdf');
    const f = TestBed.createComponent(VisorArchivosComponent);
    await estabilizar(f);
    const enlace = (f.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('[data-testid=abrir-pdf]')!;

    expect(visor.bloqueado()).toEqual({ url: 'blob:prueba-0', nombre: 'Acta.pdf' });
    expect(enlace.getAttribute('href')).toBe('blob:prueba-0');
    expect(enlace.target).toBe('_blank');
    expect(enlace.rel).toContain('noopener');
  });

  it('una imagen va al visor propio (<img> con la URL blob), no a otra pestaña', async () => {
    repo['contenido'].mockReturnValue(of(png()));
    const abrir = vi.spyOn(window, 'open');
    await visor.ver(8, 'foto.png');
    const f = TestBed.createComponent(VisorArchivosComponent);
    await estabilizar(f);
    const img = (f.nativeElement as HTMLElement).querySelector<HTMLImageElement>('[data-testid=visor-imagen]')!;

    expect(abrir).not.toHaveBeenCalled();
    expect(img.getAttribute('src')).toBe('blob:prueba-0');
    expect(img.alt).toContain('foto.png');
  });

  it('al cerrar el visor se libera la URL blob', async () => {
    repo['contenido'].mockReturnValue(of(png()));
    await visor.ver(8);
    visor.cerrar();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prueba-0');
    expect(visor.imagen()).toBeNull();
  });

  it('abrir otra imagen libera la anterior', async () => {
    repo['contenido'].mockReturnValue(of(png()));
    await visor.ver(8);
    await visor.ver(9);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prueba-0');
    expect(visor.imagen()!.url).toBe('blob:prueba-1');
  });

  it('el PDF de una pestaña abierta se libera pasado un rato, no antes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      vi.spyOn(window, 'open').mockReturnValue({} as Window);
      await visor.ver(7);
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000 + 10);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prueba-0');
    } finally {
      vi.useRealTimers();
    }
  });

  it('un error (p. ej. 404) se avisa con el mensaje del servidor y no abre nada', async () => {
    repo['contenido'].mockReturnValue(throwError(() => ({ code: 20007, message: 'El archivo no existe.' })));
    const error = vi.spyOn(TestBed.inject(ToastService), 'error');
    const abrir = vi.spyOn(window, 'open');
    await visor.ver(7);

    expect(error).toHaveBeenCalledWith('El archivo no existe.', undefined);
    expect(abrir).not.toHaveBeenCalled();
    expect(visor.cargando()).toBe(false);
  });

  it('mientras uno carga, otro clic no pide el archivo dos veces', async () => {
    let soltar!: (r: RespuestaArchivo) => void;
    repo['contenido'].mockReturnValue(new (await import('rxjs')).Observable<RespuestaArchivo>((s) => { soltar = (r) => { s.next(r); s.complete(); }; }));
    vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const primero = visor.ver(7);
    await visor.ver(7);
    soltar(pdf());
    await primero;

    expect(repo['contenido']).toHaveBeenCalledTimes(1);
  });
});

describe('Ver documento (.sila)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: Record<string, any>;
  let visor: { mostrar: ReturnType<typeof vi.fn> };
  let descargado: string[];

  beforeEach(() => {
    descargado = [];
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      descargado.push(this.download);
    });
    repo = { descifrar: vi.fn(() => of(pdf())) };
    visor = { mostrar: vi.fn() };
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), provideRouter([]), { provide: ARCHIVOS_REPOSITORY, useValue: repo }, { provide: VisorArchivosService, useValue: visor }] });
  });
  afterEach(() => vi.restoreAllMocks());

  async function crear() {
    const f = TestBed.createComponent(VerDocumentoPageComponent);
    await estabilizar(f);
    const el = f.nativeElement as HTMLElement;
    const elegir = async (...archivos: File[]) => {
      const input = el.querySelector<HTMLInputElement>('[data-testid=input-sila]')!;
      Object.defineProperty(input, 'files', { configurable: true, value: archivos });
      input.dispatchEvent(new Event('change'));
      await estabilizar(f);
    };
    return { f, el, elegir, q: (s: string) => el.querySelector<HTMLElement>(s) };
  }
  const sila = (nombre = 'a1b2c3.sila', tamano = 2000) => new File([new Uint8Array(tamano)], nombre);

  it('explica qué hacer con el archivo que termina en .sila', async () => {
    const { q } = await crear();
    expect(limpio(q('[data-testid=explicacion]')!.textContent)).toContain('descárguelo (termina en .sila) y súbalo aquí para verlo');
    expect(q('[data-testid=input-sila]')!.getAttribute('accept')).toBe('.sila');
  });

  it('lo manda al servidor, lo muestra como cualquier archivo y deja «Descargar el original»', async () => {
    const { elegir, q } = await crear();
    await elegir(sila());

    expect(repo['descifrar']).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: 'a1b2c3.sila' }));
    expect(visor.mostrar).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Acta.pdf' }), 'documento');
    expect(limpio(q('[data-testid=resultado-sila]')!.textContent)).toContain('Acta.pdf');
    q('[data-testid=descargar-original]')!.click();
    expect(descargado).toEqual(['Acta.pdf']);
  });

  it('con X-Archivo-Id ofrece «Ir al archivo» (abre su detalle); sin él, no', async () => {
    const { elegir, q } = await crear();
    await elegir(sila());
    expect(q('[data-testid=ir-al-archivo]')!.getAttribute('href')).toBe('/archivos?documento=7');

    repo['descifrar'].mockReturnValue(of(pdf({ idArchivo: null, nombre: 'recuperado-1a2b3c4d.pdf' })));
    await elegir(sila('otro.sila'));
    expect(q('[data-testid=ir-al-archivo]')).toBeNull();
    expect(limpio(q('[data-testid=resultado-sila]')!.textContent)).toContain('recuperado-1a2b3c4d.pdf');
  });

  it('un archivo que no es .sila o pesa más de 11 MB no sale del navegador', async () => {
    const { elegir, q } = await crear();
    await elegir(new File(['x'], 'foto.png'));
    expect(limpio(q('[data-testid=error-sila]')!.textContent)).toContain('.sila');
    await elegir(sila('grande.sila', 11 * 1024 * 1024 + 1));
    expect(limpio(q('[data-testid=error-sila]')!.textContent)).toBe('El archivo supera 11 MB.');
    expect(repo['descifrar']).not.toHaveBeenCalled();
  });

  it('422: «no es de SILA, está alterado o no coincide» (el mensaje del servidor) y no queda nada en pantalla', async () => {
    repo['descifrar'].mockReturnValue(throwError(() => ({ code: 20018, message: 'Este archivo no es de SILA, está alterado o no coincide con lo registrado.' })));
    const { elegir, q } = await crear();
    await elegir(sila());

    expect(limpio(q('[data-testid=error-sila]')!.textContent)).toBe('Este archivo no es de SILA, está alterado o no coincide con lo registrado.');
    expect(q('[data-testid=resultado-sila]')).toBeNull();
    expect(visor.mostrar).not.toHaveBeenCalled();
  });

  it('un archivo nuevo borra el resultado anterior; al salir de la pantalla no queda nada guardado', async () => {
    const { f, elegir, q } = await crear();
    await elegir(sila());
    expect(q('[data-testid=resultado-sila]')).toBeTruthy();
    f.destroy();

    expect((f.componentInstance as unknown as { resultado: () => unknown }).resultado()).toBeNull();
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('Acta');
  });
});
