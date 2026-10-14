import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import { DOCUMENTOS_REPOSITORY } from './data/documentos.provider';
import { enlaceSeguro } from './documento-estado';
import { DocumentoDialogComponent } from './documento-dialog.component';
import { DocumentosEntidadComponent } from './documentos-entidad.component';
import { DocumentosService } from './documentos.service';
import type { Documento } from './models/documentos.models';
import { SUBIDOR_DOCUMENTOS } from './subida-drive';

const DOC: Documento = { id_documento: 3, tipo_entidad: 'RECEPCION_LECHE', id_entidad: 45, nombre_archivo: 'recepcion-45.pdf', mime_type: 'application/pdf', drive_url: null, checksum_sha256: null, estado_carga: 'PENDIENTE', intentos: 0, ultimo_error: null, usuario_carga: 'ana', fecha_registro: '2026-10-14T02:40:01', fecha_carga: null };

async function estabilizar(f: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 8; i++) {
    f.detectChanges();
    await f.whenStable();
  }
}
const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const texto = (f: ComponentFixture<unknown>, sel: string) => (raiz(f).querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Documentos', () => {
  let repo: Record<string, ReturnType<typeof vi.fn>>;

  beforeAll(() => {
    const d = HTMLDialogElement.prototype;
    d.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    d.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });

  beforeEach(() => {
    repo = {
      listar: vi.fn(() => of({ items: [DOC, { ...DOC, id_documento: 4, estado_carga: 'ERROR', intentos: 2, ultimo_error: 'Sin conexión con Drive' }], total: 2, page: 0, size: 10 })),
      crear: vi.fn(() => of(DOC)),
      marcarSubido: vi.fn(() => of({ ...DOC, estado_carga: 'SUBIDO' })),
      marcarError: vi.fn(() => of({ ...DOC, estado_carga: 'ERROR' })),
    };
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: DOCUMENTOS_REPOSITORY, useValue: repo }] });
  });

  it('la lista de una entidad filtra por tipo e id, muestra estados, intentos y último error, y NO ofrece subir (no hay Drive)', async () => {
    const f = TestBed.createComponent(DocumentosEntidadComponent);
    f.componentRef.setInput('tipoEntidad', 'RECEPCION_LECHE');
    f.componentRef.setInput('idEntidad', 45);
    await estabilizar(f);

    expect(repo['listar'].mock.calls[0][0]).toMatchObject({ tipo_entidad: 'RECEPCION_LECHE', id_entidad: 45 });
    expect(raiz(f).textContent).toContain('Pendiente');
    expect(raiz(f).textContent).toContain('Error');
    expect(texto(f, '[data-testid=ultimo-error]')).toBe('Sin conexión con Drive');
    expect(Array.from(raiz(f).querySelectorAll('button')).some((b) => b.textContent?.includes('Subir a Drive'))).toBe(false);
  });

  it('«Registrar documento» envía la entidad y el nombre con Idempotency-Key, y avisa que queda Pendiente', async () => {
    const f = TestBed.createComponent(DocumentoDialogComponent);
    f.componentRef.setInput('tipoEntidad', 'RECEPCION_LECHE');
    f.componentRef.setInput('idEntidad', 45);
    f.componentRef.setInput('abierto', true);
    await estabilizar(f);
    expect(texto(f, '[data-testid=aviso-documento]')).toContain('Pendiente');

    const nombre = raiz(f).querySelector<HTMLInputElement>('[formcontrolname=nombre]')!;
    nombre.value = 'recepcion-45.pdf';
    nombre.dispatchEvent(new Event('input'));
    await estabilizar(f);
    raiz(f).querySelector('#documento-form')!.dispatchEvent(new Event('submit'));
    await estabilizar(f);

    const [cuerpo, clave] = repo['crear'].mock.calls[0];
    expect(cuerpo).toEqual({ tipo_entidad: 'RECEPCION_LECHE', id_entidad: 45, nombre_archivo: 'recepcion-45.pdf' });
    expect(clave.length).toBeGreaterThanOrEqual(8);
  });

  it('404 / 20007 (la entidad no existe) se muestra con el mensaje del servidor', async () => {
    repo['crear'].mockReturnValue(throwError(() => ({ code: 20007, message: 'La entidad no existe.' })));
    const f = TestBed.createComponent(DocumentoDialogComponent);
    f.componentRef.setInput('tipoEntidad', 'FACTURA');
    f.componentRef.setInput('idEntidad', 999);
    f.componentRef.setInput('abierto', true);
    await estabilizar(f);
    const nombre = raiz(f).querySelector<HTMLInputElement>('[formcontrolname=nombre]')!;
    nombre.value = 'f.pdf';
    nombre.dispatchEvent(new Event('input'));
    await estabilizar(f);
    raiz(f).querySelector('#documento-form')!.dispatchEvent(new Event('submit'));
    await estabilizar(f);

    expect(texto(f, '[data-testid=error-documento]')).toBe('La entidad no existe.');
  });

  describe('gancho de subida a Drive', () => {
    it('sin subidor (hoy) no marca NADA como subido ni como error: falla sin tocar el backend', async () => {
      const servicio = TestBed.inject(DocumentosService);

      expect(servicio.disponible).toBe(false);
      await expect(servicio.subir(DOC)).rejects.toThrow(/aún no está disponible/);
      expect(repo['marcarSubido']).not.toHaveBeenCalled();
      expect(repo['marcarError']).not.toHaveBeenCalled();
    });

    it('con un subidor real: si sube, reporta SUBIDO con lo que respondió Drive', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideNgIconLoader(async () => ''),
          { provide: DOCUMENTOS_REPOSITORY, useValue: repo },
          { provide: SUBIDOR_DOCUMENTOS, useValue: { subir: vi.fn(async () => ({ drive_file_id: 'abc', drive_url: 'https://drive.google.com/file/d/abc' })) } },
        ],
      });

      await TestBed.inject(DocumentosService).subir(DOC);

      expect(repo['marcarSubido']).toHaveBeenCalledTimes(1);
      expect(repo['marcarSubido'].mock.calls[0][1]).toEqual({ drive_file_id: 'abc', drive_url: 'https://drive.google.com/file/d/abc' });
      expect(repo['marcarError']).not.toHaveBeenCalled();
    });

    it('con un subidor real: si falla, reporta ERROR con el mensaje y vuelve a lanzar el fallo', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideNgIconLoader(async () => ''),
          { provide: DOCUMENTOS_REPOSITORY, useValue: repo },
          { provide: SUBIDOR_DOCUMENTOS, useValue: { subir: vi.fn(async () => Promise.reject(new Error('Cuota de Drive agotada'))) } },
        ],
      });

      await expect(TestBed.inject(DocumentosService).subir(DOC)).rejects.toThrow('Cuota de Drive agotada');

      expect(repo['marcarError'].mock.calls[0][1]).toBe('Cuota de Drive agotada');
      expect(repo['marcarSubido']).not.toHaveBeenCalled();
    });
  });

  it('solo se ofrece como enlace una URL http(s): una javascript: nunca', () => {
    expect(enlaceSeguro('https://drive.google.com/file/d/abc')).toBe('https://drive.google.com/file/d/abc');
    expect(enlaceSeguro('javascript:alert(1)')).toBeNull();
    expect(enlaceSeguro(null)).toBeNull();
  });
});
