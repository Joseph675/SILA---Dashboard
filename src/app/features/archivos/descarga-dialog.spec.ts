import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import type { RespuestaArchivo } from '../../core/api/archivo-cabeceras';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ARCHIVOS_REPOSITORY } from './data/archivos.provider';
import { DescargaDialogComponent } from './descarga-dialog.component';
import { OPCIONES_CON_DOCUMENTO, OPCIONES_SIN_DOCUMENTO, archivoDe, estabilizar, limpio, polyfillDialog } from './pruebas.comunes';

const respuesta = (extra: Partial<RespuestaArchivo> = {}): RespuestaArchivo => ({ blob: new Blob(['%PDF'], { type: 'application/pdf' }), nombre: 'VENTA-7-protegido.pdf', idArchivo: 7, claveGenerada: null, ...extra });

describe('Descargar con clave', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: Record<string, any>;
  let descargado: string[];

  beforeAll(polyfillDialog);

  beforeEach(() => {
    descargado = [];
    URL.createObjectURL = vi.fn(() => 'blob:prueba');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      descargado.push(this.download);
    });
    repo = { opcionesDescarga: vi.fn(() => of(OPCIONES_CON_DOCUMENTO)), descargar: vi.fn(() => of(respuesta())) };
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: ARCHIVOS_REPOSITORY, useValue: repo }] });
  });
  afterEach(() => vi.restoreAllMocks());

  async function abrir(): Promise<{ f: ComponentFixture<DescargaDialogComponent>; el: HTMLElement; cerrado: ReturnType<typeof vi.fn> }> {
    const f = TestBed.createComponent(DescargaDialogComponent);
    const cerrado = vi.fn();
    f.componentInstance.cerrar.subscribe(cerrado);
    f.componentRef.setInput('archivo', archivoDe(7));
    await estabilizar(f);
    return { f, el: f.nativeElement as HTMLElement, cerrado };
  }
  const q = (el: HTMLElement, sel: string) => el.querySelector<HTMLElement>(sel);
  const modo = (el: HTMLElement, m: string) => q(el, `[data-testid=modo-${m}]`) as HTMLInputElement;
  const boton = (el: HTMLElement) => q(el, '[data-testid=descargar]') as HTMLButtonElement;
  async function escribir(f: ComponentFixture<unknown>, el: HTMLElement, valor: string) {
    const input = q(el, '[data-testid=clave-escrita]') as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    await estabilizar(f);
  }

  describe('qué opciones se ofrecen', () => {
    it('pide las opciones de ESE archivo', async () => {
      await abrir();
      expect(repo['opcionesDescarga']).toHaveBeenCalledExactlyOnceWith(7);
    });

    it('con documento disponible: la opción del documento viene elegida, con su pista y la explicación de cómo escribirlo', async () => {
      const { el } = await abrir();

      expect(modo(el, 'documento').disabled).toBe(false);
      expect(modo(el, 'documento').checked).toBe(true);
      expect(limpio(q(el, '[data-testid=pista]')!.textContent)).toBe('900***567');
      expect(limpio(el.textContent)).toContain('Documento de identidad de Tienda La Esquina');
      expect(limpio(el.textContent)).toContain('solo letras y números, sin puntos ni guiones (900.123.456-7 → 9001234567)');
    });

    it('SIN documento disponible: la opción sale DESHABILITADA con el motivo del servidor debajo, y queda elegida la aleatoria', async () => {
      repo['opcionesDescarga'].mockReturnValue(of(OPCIONES_SIN_DOCUMENTO));
      const { el } = await abrir();

      expect(modo(el, 'documento').disabled).toBe(true);
      expect(modo(el, 'documento').checked).toBe(false);
      expect(limpio(q(el, '[data-testid=motivo-no-disponible]')!.textContent)).toBe('Los gastos no tienen cliente ni proveedor.');
      expect(q(el, '[data-testid=pista]')).toBeNull();
      expect(modo(el, 'aleatoria').checked).toBe(true);
      expect(boton(el).disabled).toBe(false);
    });

    it('muestra siempre el texto de ayuda de los canales distintos', async () => {
      const { el } = await abrir();
      expect(limpio(q(el, '[data-testid=ayuda-canales]')!.textContent)).toContain('Mande el PDF y la clave por canales distintos (por ejemplo, el PDF por correo y la clave por WhatsApp)');
      expect(limpio(q(el, '[data-testid=ayuda-canales]')!.textContent)).toContain('no reemplaza el cuidado al enviarlo');
    });

    it('una imagen avisa que se entregará dentro de un PDF; un PDF no', async () => {
      repo['opcionesDescarga'].mockReturnValue(of({ ...OPCIONES_CON_DOCUMENTO, es_imagen: true }));
      const { el } = await abrir();
      expect(limpio(q(el, '[data-testid=aviso-imagen]')!.textContent)).toBe('La imagen se entregará dentro de un PDF.');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: ARCHIVOS_REPOSITORY, useValue: repo }] });
      repo['opcionesDescarga'].mockReturnValue(of(OPCIONES_CON_DOCUMENTO));
      expect(q((await abrir()).el, '[data-testid=aviso-imagen]')).toBeNull();
    });

    it('si fallan las opciones: el mensaje del servidor y «Reintentar»', async () => {
      repo['opcionesDescarga'].mockReturnValueOnce(throwError(() => ({ code: 20007, message: 'El archivo no existe.' })));
      const { f, el } = await abrir();

      expect(limpio(q(el, '[data-testid=error-opciones]')!.textContent)).toBe('El archivo no existe.');
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Reintentar'))!.click();
      await estabilizar(f);
      expect(q(el, '[data-testid=modo-documento]')).toBeTruthy();
    });
  });

  describe('clave que escribo yo', () => {
    it('valida el largo con lo que dice el servidor (4–64), con contador, y no deja descargar hasta que sea válida', async () => {
      const { f, el } = await abrir();
      modo(el, 'escrita').click();
      await estabilizar(f);

      expect(boton(el).disabled).toBe(true);
      await escribir(f, el, 'abc');
      expect(limpio(q(el, '[data-testid=error-clave]')!.textContent)).toBe('La clave debe tener al menos 4 caracteres.');
      expect(limpio(q(el, '[data-testid=contador]')!.textContent)).toBe('3 / 64');
      expect(boton(el).disabled).toBe(true);

      await escribir(f, el, 'x'.repeat(64));
      expect(q(el, '[data-testid=error-clave]')).toBeNull();
      expect(boton(el).disabled).toBe(false);
      expect((q(el, '[data-testid=clave-escrita]') as HTMLInputElement).maxLength).toBe(64);
    });

    it('el campo es de contraseña y se puede mostrar / ocultar', async () => {
      const { f, el } = await abrir();
      modo(el, 'escrita').click();
      await estabilizar(f);
      expect((q(el, '[data-testid=clave-escrita]') as HTMLInputElement).type).toBe('password');

      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Mostrar la clave'))!.click();
      await estabilizar(f);
      expect((q(el, '[data-testid=clave-escrita]') as HTMLInputElement).type).toBe('text');
    });

    it('descarga con ESCRITA y la clave en el CUERPO; guarda el PDF con el nombre del servidor y cierra', async () => {
      const exito = vi.spyOn(TestBed.inject(ToastService), 'exito');
      const { f, el, cerrado } = await abrir();
      modo(el, 'escrita').click();
      await estabilizar(f);
      await escribir(f, el, 'mi-clave-1');
      boton(el).click();
      await estabilizar(f);

      expect(repo['descargar']).toHaveBeenCalledExactlyOnceWith(7, 'ESCRITA', 'mi-clave-1');
      expect(descargado).toEqual(['VENTA-7-protegido.pdf']);
      expect(exito).toHaveBeenCalled();
      expect(cerrado).toHaveBeenCalledOnce();
    });

    it('si el servidor devuelve un error en el campo «clave» se muestra bajo el campo', async () => {
      repo['descargar'].mockReturnValueOnce(throwError(() => ({ code: 20001, message: 'Datos inválidos', fields: { clave: 'La clave debe tener entre 4 y 64 caracteres' } })));
      const { f, el, cerrado } = await abrir();
      modo(el, 'escrita').click();
      await estabilizar(f);
      await escribir(f, el, 'mi-clave-1');
      boton(el).click();
      await estabilizar(f);

      expect(limpio(q(el, '[data-testid=error-clave]')!.textContent)).toBe('La clave debe tener entre 4 y 64 caracteres');
      expect(cerrado).not.toHaveBeenCalled();
      expect(descargado).toEqual([]);
    });
  });

  describe('documento', () => {
    it('descarga con DOCUMENTO (sin mandar ninguna clave: el servidor la conoce)', async () => {
      const { f, el } = await abrir();
      boton(el).click();
      await estabilizar(f);

      expect(repo['descargar']).toHaveBeenCalledExactlyOnceWith(7, 'DOCUMENTO', undefined);
    });

    it('un 409 (el documento ya no sirve) se muestra con el mensaje del servidor', async () => {
      repo['descargar'].mockReturnValueOnce(throwError(() => ({ code: 20010, message: 'El cliente no tiene un documento usable.' })));
      const { f, el, cerrado } = await abrir();
      boton(el).click();
      await estabilizar(f);

      expect(limpio(q(el, '[data-testid=error-descarga]')!.textContent)).toBe('El cliente no tiene un documento usable.');
      expect(cerrado).not.toHaveBeenCalled();
    });
  });

  describe('clave aleatoria: se ve UNA vez', () => {
    const KEY = 'K7MQ-4XPD-9TRB';

    async function descargarAleatoria() {
      repo['descargar'].mockReturnValue(of(respuesta({ claveGenerada: KEY })));
      const x = await abrir();
      modo(x.el, 'aleatoria').click();
      await estabilizar(x.f);
      boton(x.el).click();
      await estabilizar(x.f);
      return x;
    }

    it('al terminar muestra «Clave de este PDF» en grande, con el aviso de que es una sola vez', async () => {
      const { el } = await descargarAleatoria();

      expect(repo['descargar']).toHaveBeenCalledExactlyOnceWith(7, 'ALEATORIA', undefined);
      expect(limpio(q(el, '[data-testid=clave-generada]')!.textContent)).toBe(KEY);
      expect(limpio(el.textContent)).toContain('Se muestra una sola vez. Anótela antes de cerrar.');
      expect(descargado).toEqual(['VENTA-7-protegido.pdf']);
    });

    it('«Copiar» pone la clave en el portapapeles', async () => {
      const escribirPortapapeles = vi.fn(() => Promise.resolve());
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: escribirPortapapeles } });
      const { f, el } = await descargarAleatoria();
      q(el, '[data-testid=copiar-clave]')!.click();
      await estabilizar(f);

      expect(escribirPortapapeles).toHaveBeenCalledWith(KEY);
      expect(limpio(q(el, '[data-testid=copiar-clave]')!.textContent)).toBe('Copiada');
    });

    it('al cerrar, la clave se borra de la memoria y de la pantalla, y se avisa al padre', async () => {
      const { f, el, cerrado } = await descargarAleatoria();
      q(el, '[data-testid=cerrar-clave]')!.click();
      await estabilizar(f);

      expect(q(el, '[data-testid=clave-generada]')!.textContent?.trim()).toBe('');
      expect(el.textContent).not.toContain(KEY);
      expect(cerrado).toHaveBeenCalledOnce();
      // El componente no la guarda en ningún campo.
      expect((f.componentInstance as unknown as { claveGenerada: () => string | null }).claveGenerada()).toBeNull();
      expect((f.componentInstance as unknown as { clave: () => string }).clave()).toBe('');
    });

    it('la clave nunca se guarda en localStorage ni sessionStorage', async () => {
      await descargarAleatoria();

      expect(JSON.stringify({ ...localStorage })).not.toContain(KEY);
      expect(JSON.stringify({ ...sessionStorage })).not.toContain(KEY);
    });

    it('mientras se ve la clave no se puede cerrar con Escape ni tocando fuera (solo con «Ya la anoté»)', async () => {
      const { f, el, cerrado } = await descargarAleatoria();
      const dialogo = Array.from(el.querySelectorAll('dialog')).find((d) => d.textContent?.includes('Clave de este PDF'))!;
      const escape = new Event('cancel', { cancelable: true });
      dialogo.dispatchEvent(escape);
      await estabilizar(f);

      expect(escape.defaultPrevented).toBe(true);
      expect(cerrado).not.toHaveBeenCalled();
      expect(q(el, '[data-testid=clave-generada]')!.textContent?.trim()).toBe(KEY);
    });

    it('si el servidor NO manda la clave en la cabecera, no inventa un diálogo vacío: cierra con aviso', async () => {
      repo['descargar'].mockReturnValue(of(respuesta({ claveGenerada: null })));
      const { f, el, cerrado } = await abrir();
      modo(el, 'aleatoria').click();
      await estabilizar(f);
      boton(el).click();
      await estabilizar(f);

      expect(cerrado).toHaveBeenCalledOnce();
    });
  });

  it('un archivo nuevo empieza limpio: sin la clave escrita antes ni la clave generada', async () => {
    const { f, el } = await abrir();
    modo(el, 'escrita').click();
    await estabilizar(f);
    await escribir(f, el, 'una-clave-escrita');
    f.componentRef.setInput('archivo', archivoDe(8));
    await estabilizar(f);

    expect(modo(el, 'documento').checked).toBe(true);
    modo(el, 'escrita').click();
    await estabilizar(f);
    expect((q(el, '[data-testid=clave-escrita]') as HTMLInputElement).value).toBe('');
    expect(repo['opcionesDescarga']).toHaveBeenLastCalledWith(8);
  });
});
