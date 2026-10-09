import { Clipboard } from '@angular/cdk/clipboard';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { CodigosRespaldoComponent } from './codigos-respaldo.component';

const CODIGOS = ['AAAAA-11111', 'BBBBB-22222', 'CCCCC-33333', 'DDDDD-44444', 'EEEEE-55555', 'FFFFF-66666', 'GGGGG-77777', 'HHHHH-88888', 'JJJJJ-99999', 'KKKKK-23456'];

describe('CodigosRespaldoComponent', () => {
  let copiar: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<CodigosRespaldoComponent>;
  let continuados: number;

  const raiz = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string) => Array.from(raiz().querySelectorAll('button')).find((b) => b.textContent?.includes(texto))!;
  const casilla = () => raiz().querySelector<HTMLInputElement>('input[type=checkbox]')!;

  async function marcar(valor: boolean): Promise<void> {
    casilla().checked = valor;
    casilla().dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    copiar = vi.fn(() => true);
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: Clipboard, useValue: { copy: copiar } }] });
    fixture = TestBed.createComponent(CodigosRespaldoComponent);
    fixture.componentRef.setInput('codigos', CODIGOS);
    fixture.componentRef.setInput('usuario', 'ana.perez');
    continuados = 0;
    fixture.componentInstance.continuar.subscribe(() => continuados++);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('muestra los 10 códigos numerados y el aviso de que no se verán de nuevo', () => {
    const items = Array.from(raiz().querySelectorAll('li')).map((li) => li.textContent!.replace(/\s+/g, ' ').trim());

    expect(items.length).toBe(10);
    expect(items[0]).toBe('1.AAAAA-11111');
    expect(items[9]).toBe('10.KKKKK-23456');
    expect(raiz().textContent).toContain('Cada código sirve una sola vez');
    expect(raiz().textContent).toContain('No se volverán a mostrar');
  });

  it('NO deja continuar sin marcar «Ya los guardé»', async () => {
    expect(boton('Continuar').disabled).toBe(true);
    boton('Continuar').click();
    expect(continuados).toBe(0);

    await marcar(true);
    expect(boton('Continuar').disabled).toBe(false);
    boton('Continuar').click();
    expect(continuados).toBe(1);
  });

  it('si desmarca la casilla, vuelve a bloquearse', async () => {
    await marcar(true);
    await marcar(false);

    expect(boton('Continuar').disabled).toBe(true);
  });

  it('Copiar manda los 10 códigos, uno por línea, al portapapeles', () => {
    boton('Copiar').click();

    expect(copiar).toHaveBeenCalledExactlyOnceWith(CODIGOS.join('\n'));
  });

  describe('descargar', () => {
    let nombre = '';
    let blob: Blob | undefined;

    beforeEach(() => {
      URL.createObjectURL = vi.fn((b: Blob) => {
        blob = b;
        return 'blob:prueba';
      });
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        nombre = this.download;
      });
    });

    const leer = (b: Blob) =>
      new Promise<string>((resolver) => {
        const lector = new FileReader();
        lector.onload = () => resolver(String(lector.result));
        lector.readAsText(b);
      });

    it('el archivo lleva el nombre del usuario y la fecha, el encabezado y solo los códigos', async () => {
      boton('Descargar').click();

      expect(nombre).toMatch(/^sila-codigos-respaldo-ana\.perez-\d{4}-\d{2}-\d{2}\.txt$/);
      const texto = await leer(blob!);
      expect(texto.split('\n')[0]).toBe('SILA · Llanolat — códigos de respaldo');
      expect(texto).toContain('Usuario: ana.perez');
      for (const codigo of CODIGOS) expect(texto).toContain(codigo);
      expect(texto).not.toMatch(/clave|contraseña|token/i);
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('un nombre de usuario raro no puede alterar el nombre del archivo', () => {
      fixture.componentRef.setInput('usuario', '../../etc/passwd');
      fixture.detectChanges();

      boton('Descargar').click();

      expect(nombre).not.toContain('/');
      expect(nombre).toMatch(/^sila-codigos-respaldo-[a-z0-9_.@-]+-\d{4}-\d{2}-\d{2}\.txt$/);
    });
  });

  it('Imprimir imprime solo este bloque (marca el <body> mientras dura la impresión)', () => {
    const imprimir = vi.fn(() => expect(document.body.classList.contains('imprimiendo-codigos')).toBe(true));
    vi.spyOn(window, 'print').mockImplementation(imprimir);

    boton('Imprimir').click();
    expect(imprimir).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('afterprint'));
    expect(document.body.classList.contains('imprimiendo-codigos')).toBe(false);
    expect(raiz().querySelector('.zona-impresion-codigos')).toBeTruthy();
  });

  it('los códigos no se escriben en ningún almacenamiento', () => {
    const escritura = vi.spyOn(Storage.prototype, 'setItem');
    boton('Copiar').click();
    boton('Imprimir').click();
    window.dispatchEvent(new Event('afterprint'));

    expect(escritura).not.toHaveBeenCalled();
    expect(localStorage.length + sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });

  it('mientras están a la vista, recargar o cerrar la pestaña pide confirmación (se perderían)', () => {
    const evento = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true);
  });

  it('al destruirse deja de pedir confirmación', () => {
    fixture.destroy();
    const evento = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(false);
  });
});
