import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { Subject, of, throwError } from 'rxjs';
import type { Archivo } from './models/archivos.models';
import { ARCHIVOS_REPOSITORY } from './data/archivos.provider';
import { archivoDe, estabilizar, limpio, polyfillDialog } from './pruebas.comunes';
import { SubirArchivosDialogComponent } from './subir-archivos-dialog.component';

const pdf = (nombre = 'contrato.pdf', tamano = 1000) => new File([new Uint8Array(tamano)], nombre, { type: 'application/pdf' });

describe('Subir archivos (ADMIN)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: Record<string, any>;

  beforeAll(polyfillDialog);
  beforeEach(() => {
    repo = { subir: vi.fn((f: File) => of(archivoDe(50, { origen: 'ADMIN', nombre_archivo: f.name }))) };
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: ARCHIVOS_REPOSITORY, useValue: repo }] });
  });

  async function abrir(idCarpeta: number | null = 5) {
    const f: ComponentFixture<SubirArchivosDialogComponent> = TestBed.createComponent(SubirArchivosDialogComponent);
    const subido = vi.fn();
    f.componentInstance.subido.subscribe(subido);
    f.componentRef.setInput('abierto', true);
    f.componentRef.setInput('idCarpeta', idCarpeta);
    await estabilizar(f);
    const el = f.nativeElement as HTMLElement;
    const filas = () => Array.from(el.querySelectorAll<HTMLElement>('[data-testid=lista-subida] li'));
    return { f, el, subido, filas, agregar: async (...a: File[]) => { f.componentInstance.agregar(a); await estabilizar(f); } };
  }

  it('dice que los archivos se revisan con antivirus, se limpian y se guardan cifrados, y limita los tipos del selector', async () => {
    const { el } = await abrir();
    expect(limpio(el.querySelector('[data-testid=aviso-seguridad]')!.textContent)).toBe('Los archivos se revisan con antivirus, se limpian y se guardan cifrados.');
    expect(el.querySelector<HTMLInputElement>('[data-testid=input-archivos]')!.accept).toBe('.pdf,.jpg,.jpeg,.png');
    expect(el.querySelector<HTMLInputElement>('[data-testid=input-archivos]')!.multiple).toBe(true);
  });

  it('sube a la carpeta actual (id_carpeta) y avisa para refrescar la lista', async () => {
    const { agregar, subido, filas } = await abrir(5);
    await agregar(pdf('contrato.pdf'));

    expect(repo['subir']).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: 'contrato.pdf' }), 5);
    expect(subido).toHaveBeenCalledOnce();
    expect(filas()[0].dataset['estado']).toBe('listo');
  });

  it('en la raíz de «Mis carpetas» no manda id_carpeta', async () => {
    const { agregar } = await abrir(null);
    await agregar(pdf());
    expect(repo['subir']).toHaveBeenCalledExactlyOnceWith(expect.anything(), undefined);
  });

  it('arrastrar y soltar agrega los archivos', async () => {
    const { f, el } = await abrir();
    const evento = Object.assign(new Event('drop', { cancelable: true }), { dataTransfer: { files: [pdf('soltado.pdf')] } });
    el.querySelector('[data-testid=zona-soltar]')!.dispatchEvent(evento);
    await estabilizar(f);

    expect(evento.defaultPrevented).toBe(true);
    expect(repo['subir']).toHaveBeenCalledWith(expect.objectContaining({ name: 'soltado.pdf' }), 5);
  });

  describe('lo que se rechaza en el navegador (sin molestar al servidor)', () => {
    it('una extensión no permitida', async () => {
      const { agregar, filas } = await abrir();
      await agregar(new File(['x'], 'virus.exe'));

      expect(repo['subir']).not.toHaveBeenCalled();
      expect(filas()[0].dataset['estado']).toBe('rechazado');
      expect(limpio(filas()[0].querySelector('[data-testid=mensaje-subida]')!.textContent)).toBe('Solo se admiten archivos PDF, JPG o PNG.');
    });

    it('más de 10 MB', async () => {
      const { agregar, filas } = await abrir();
      await agregar(pdf('enorme.pdf', 10 * 1024 * 1024 + 1));

      expect(repo['subir']).not.toHaveBeenCalled();
      expect(limpio(filas()[0].textContent)).toContain('El archivo supera 10 MB.');
    });

    it('uno malo no frena a los buenos del mismo grupo', async () => {
      const { agregar, filas } = await abrir();
      await agregar(new File(['x'], 'malo.exe'), pdf('bueno.pdf'));

      expect(repo['subir']).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: 'bueno.pdf' }), 5);
      expect(filas().map((x) => x.dataset['estado'])).toEqual(['rechazado', 'listo']);
    });
  });

  describe('de uno en uno', () => {
    it('el segundo no empieza hasta que termina el primero, y mientras tanto dice «Revisando con el antivirus…»', async () => {
      const primero = new Subject<Archivo>();
      repo['subir'].mockReturnValueOnce(primero).mockReturnValueOnce(of(archivoDe(51)));
      const { f, el, agregar, filas } = await abrir();
      f.componentInstance.agregar([pdf('uno.pdf'), pdf('dos.pdf')]);
      f.detectChanges();

      expect(repo['subir']).toHaveBeenCalledTimes(1);
      expect(filas().map((x) => x.dataset['estado'])).toEqual(['subiendo', 'esperando']);
      expect(el.textContent).toContain('Revisando con el antivirus…');
      expect(Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Subiendo'))!.disabled).toBe(true);

      primero.next(archivoDe(50));
      primero.complete();
      await estabilizar(f);
      expect(repo['subir']).toHaveBeenCalledTimes(2);
      expect(filas().map((x) => x.dataset['estado'])).toEqual(['listo', 'listo']);
      void agregar;
    });
  });

  describe('lo que el servidor rechaza', () => {
    it('422: muestra el mensaje del servidor, sin «Reintentar»', async () => {
      repo['subir'].mockReturnValueOnce(throwError(() => ({ code: 20018, message: 'El PDF contiene JavaScript y no se admite.' })));
      const { agregar, filas } = await abrir();
      await agregar(pdf());

      expect(filas()[0].dataset['estado']).toBe('rechazado');
      expect(limpio(filas()[0].querySelector('[data-testid=mensaje-subida]')!.textContent)).toBe('El PDF contiene JavaScript y no se admite.');
      expect(filas()[0].querySelector('[data-testid=reintentar-subida]')).toBeNull();
    });

    it('413: dice que supera 10 MB, sin reintento', async () => {
      repo['subir'].mockReturnValueOnce(throwError(() => ({ code: 0, message: 'El archivo supera el tamaño máximo permitido (10 MB).' })));
      const { agregar, filas } = await abrir();
      await agregar(pdf());

      expect(limpio(filas()[0].textContent)).toContain('10 MB');
      expect(filas()[0].querySelector('[data-testid=reintentar-subida]')).toBeNull();
    });

    it('409 (carpeta archivada): el mensaje del servidor', async () => {
      repo['subir'].mockReturnValueOnce(throwError(() => ({ code: 20010, message: 'La carpeta está archivada.' })));
      const { agregar, filas } = await abrir();
      await agregar(pdf());

      expect(limpio(filas()[0].textContent)).toContain('La carpeta está archivada.');
    });

    it('503 (antivirus caído): «no se guardó… intente en unos minutos» y botón «Reintentar» SOLO ahí; reintenta y sube', async () => {
      repo['subir'].mockReturnValueOnce(throwError(() => ({ code: 20019, message: 'ClamAV no responde' })));
      const { f, el, agregar, filas, subido } = await abrir();
      await agregar(pdf());

      expect(limpio(filas()[0].querySelector('[data-testid=mensaje-subida]')!.textContent)).toBe('El antivirus no está disponible; el archivo no se guardó. Intente en unos minutos.');
      expect(subido).not.toHaveBeenCalled();
      el.querySelector<HTMLButtonElement>('[data-testid=reintentar-subida]')!.click();
      await estabilizar(f);

      expect(repo['subir']).toHaveBeenCalledTimes(2);
      expect(filas()[0].dataset['estado']).toBe('listo');
      expect(subido).toHaveBeenCalledOnce();
      expect(filas()[0].querySelector('[data-testid=mensaje-subida]')).toBeNull();
    });
  });
});
