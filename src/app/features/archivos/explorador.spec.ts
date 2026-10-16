import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import { AuthService, Rol } from '../../core/services/auth.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { emparejarArbol } from './archivos.routes';
import { ARCHIVOS_REPOSITORY } from './data/archivos.provider';
import { ExploradorPageComponent } from './explorador-page.component';
import type { Archivo, EntradaExplorador, Explorador } from './models/archivos.models';
import { OPCIONES_CON_DOCUMENTO, archivoDe, estabilizar, limpio, polyfillDialog } from './pruebas.comunes';
import { VisorArchivosService } from './visor-archivos.service';

const sinEsp = (s: string) => s.replace(/\s/g, '');
const entrada = (clave: string, nombre: string, cantidad = 3): EntradaExplorador => ({ clave, nombre, cantidad });
const nivel = (extra: Partial<Explorador> & { items?: Archivo[]; total?: number } = {}): Explorador => {
  const { items = [], total = items.length, ...resto } = extra;
  return { arbol: null, ruta: [], carpetas: [], archivos: { items, total, page: 0, size: 10 }, puede_subir: false, ...resto };
};
const RAIZ = nivel({ carpetas: [entrada('TIPO', 'Por tipo', 12), entrada('CLIENTE', 'Por cliente', 7), entrada('PROVEEDOR', 'Por proveedor', 4), entrada('MANUAL', 'Mis carpetas', 2)] });

describe('Explorador de archivos', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: Record<string, any>;
  let visor: { ver: ReturnType<typeof vi.fn> };

  beforeAll(polyfillDialog);
  beforeEach(() => {
    repo = {
      explorador: vi.fn(() => of(RAIZ)),
      listar: vi.fn(() => of({ items: [archivoDe(1)], total: 1, page: 0, size: 10 })),
      obtener: vi.fn((id: number) => of(archivoDe(id))),
      deComprobante: vi.fn(() => of([])),
      opcionesDescarga: vi.fn(() => of(OPCIONES_CON_DOCUMENTO)),
      archivar: vi.fn(() => of(archivoDe(1, { archivado: true }))),
      archivarCarpeta: vi.fn(() => of({})),
      crearCarpeta: vi.fn(() => of({})),
      subir: vi.fn(),
    };
    visor = { ver: vi.fn(() => Promise.resolve()) };
    TestBed.configureTestingModule({
      providers: [
        provideNgIconLoader(async () => ''),
        provideRouter([
          { path: 'archivos', component: ExploradorPageComponent },
          { matcher: (s) => (s[0]?.path === 'archivos' ? null : null), component: ExploradorPageComponent },
          { path: 'archivos/accesos', component: ExploradorPageComponent },
          { path: 'archivos', children: [{ path: '', pathMatch: 'full', component: ExploradorPageComponent }, { matcher: emparejarArbol, component: ExploradorPageComponent }] },
        ]),
        { provide: ARCHIVOS_REPOSITORY, useValue: repo },
        { provide: VisorArchivosService, useValue: visor },
      ],
    });
  });

  async function ir(url: string, rol: Rol = 'OPERATIVO') {
    TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'a', nombre: 'A', email: 'a@example.com', rol, mfa_activo: true });
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl(url);
    await estabilizar(h.fixture as ComponentFixture<unknown>);
    const el = h.routeNativeElement as HTMLElement;
    const q = (s: string) => el.querySelector<HTMLElement>(s);
    const t = (s: string) => limpio(q(s)?.textContent);
    return { h, el, q, t, esperar: () => estabilizar(h.fixture as ComponentFixture<unknown>) };
  }
  const hrefs = (el: HTMLElement, sel: string) => Array.from(el.querySelectorAll<HTMLAnchorElement>(sel)).map((a) => a.getAttribute('href'));

  describe('la raíz', () => {
    it('muestra las 4 tarjetas con su conteo y enlaza a cada árbol; no hay tabla', async () => {
      const { el } = await ir('/archivos');
      const tarjetas = Array.from(el.querySelectorAll('[data-testid=tarjeta-arbol]')).map((a) => limpio(a.textContent));

      expect(repo['explorador']).toHaveBeenCalledWith(expect.objectContaining({ arbol: undefined, ruta: [] }));
      expect(tarjetas.map(sinEsp)).toEqual(['Portipo12archivos', 'Porcliente7archivos', 'Porproveedor4archivos', 'Miscarpetas2archivos']);
      expect(hrefs(el, '[data-testid=tarjeta-arbol]')).toEqual(['/archivos/TIPO', '/archivos/CLIENTE', '/archivos/PROVEEDOR', '/archivos/MANUAL']);
      expect(el.querySelector('app-server-data-table')).toBeNull();
    });

    it('«1 archivo» en singular', async () => {
      repo['explorador'].mockReturnValue(of(nivel({ carpetas: [entrada('TIPO', 'Por tipo', 1)] })));
      expect(sinEsp(limpio((await ir('/archivos')).el.querySelector('[data-testid=tarjeta-arbol]')!.textContent))).toBe('Portipo1archivo');
    });
  });

  describe('dentro de una carpeta (la ruta vive en la URL)', () => {
    const NIVEL_QUINCENA = nivel({
      arbol: 'TIPO',
      ruta: [entrada('VENTA', 'Ventas'), entrada('2026', '2026'), entrada('10-1', 'Octubre - quincena 1')],
      archivos: { items: [archivoDe(1), archivoDe(2, { version: 'ANULADO', estado_comprobante: 'ANULADO' })], total: 2, page: 0, size: 10 },
    });

    it('pide el árbol y la ruta del URL (clave por clave) y muestra las migas con los NOMBRES', async () => {
      repo['explorador'].mockReturnValue(of(NIVEL_QUINCENA));
      const { el, t } = await ir('/archivos/TIPO?ruta=VENTA&ruta=2026&ruta=10-1');

      expect(repo['explorador']).toHaveBeenCalledWith(expect.objectContaining({ arbol: 'TIPO', ruta: ['VENTA', '2026', '10-1'] }));
      expect(sinEsp(t('[data-testid=migas]'))).toBe(sinEsp('Archivos Por tipo Ventas 2026 Octubre - quincena 1'));
      // Cada miga navega a ese nivel; la última no es enlace.
      expect(hrefs(el, '[data-testid=migas] a')).toEqual(['/archivos', '/archivos/TIPO', '/archivos/TIPO?ruta=VENTA', '/archivos/TIPO?ruta=VENTA&ruta=2026']);
      expect(el.querySelector('[data-testid=migas] [aria-current=page]')!.textContent).toContain('Octubre - quincena 1');
    });

    it('las subcarpetas bajan un nivel agregando su clave a la ruta', async () => {
      repo['explorador'].mockReturnValue(of(nivel({ arbol: 'TIPO', ruta: [entrada('VENTA', 'Ventas')], carpetas: [entrada('2026', '2026', 9), entrada('2025', '2025', 4)] })));
      const { el } = await ir('/archivos/TIPO?ruta=VENTA');

      expect(hrefs(el, '[data-testid=subcarpeta]')).toEqual(['/archivos/TIPO?ruta=VENTA&ruta=2026', '/archivos/TIPO?ruta=VENTA&ruta=2025']);
      expect(el.querySelector('app-server-data-table')).toBeNull();
    });

    it('al entrar en una subcarpeta (navegar a su URL) vuelve a pedir ese nivel', async () => {
      repo['explorador'].mockReturnValue(of(nivel({ arbol: 'TIPO', ruta: [entrada('VENTA', 'Ventas')], carpetas: [entrada('2026', '2026')] })));
      const { h, esperar } = await ir('/archivos/TIPO?ruta=VENTA');
      await h.navigateByUrl('/archivos/TIPO?ruta=VENTA&ruta=2026');
      await esperar();

      expect(repo['explorador']).toHaveBeenLastCalledWith(expect.objectContaining({ arbol: 'TIPO', ruta: ['VENTA', '2026'] }));
    });

    it('la tabla muestra los archivos con sus insignias (ANULADO en rojo) y tachado', async () => {
      repo['explorador'].mockReturnValue(of(NIVEL_QUINCENA));
      const { el } = await ir('/archivos/TIPO?ruta=VENTA&ruta=2026&ruta=10-1');
      const filas = el.querySelectorAll('tbody tr');

      expect(filas).toHaveLength(2);
      expect(limpio(filas[0].textContent)).toContain('VENTA #1');
      expect(limpio(filas[1].textContent)).toContain('ANULADO');
      expect(filas[1].querySelector('.line-through')).toBeTruthy();
    });

    it('«Archivado» y «Sin respaldo en Drive» salen como insignias', async () => {
      repo['explorador'].mockReturnValue(of(nivel({ arbol: 'MANUAL', archivos: { items: [archivoDe(3, { origen: 'ADMIN', archivado: true, estado_drive: 'PENDIENTE', numero: null, nombre_archivo: 'Contrato.pdf' })], total: 1, page: 0, size: 10 } })));
      const { el } = await ir('/archivos/MANUAL');
      const fila = limpio(el.querySelector('tbody tr')!.textContent);

      expect(fila).toContain('Contrato.pdf');
      expect(fila).toContain('Archivado');
      expect(fila).toContain('Sin respaldo en Drive');
    });

    it('una carpeta sin nada dice que está vacía', async () => {
      repo['explorador'].mockReturnValue(of(nivel({ arbol: 'MANUAL' })));
      expect(limpio((await ir('/archivos/MANUAL')).el.querySelector('[data-testid=carpeta-vacia]')!.textContent)).toBe('Esta carpeta está vacía.');
    });

    it('el árbol se acepta en minúscula (/archivos/tipo)', async () => {
      repo['explorador'].mockReturnValue(of(nivel({ arbol: 'TIPO' })));
      await ir('/archivos/tipo');
      expect(repo['explorador']).toHaveBeenCalledWith(expect.objectContaining({ arbol: 'TIPO' }));
    });

    it('un error al cargar muestra el mensaje con «Reintentar»', async () => {
      repo['explorador'].mockReturnValueOnce(throwError(() => ({ code: 20007, message: 'La carpeta no existe.' })));
      const { el } = await ir('/archivos/TIPO?ruta=NADA');

      expect(limpio(el.querySelector('[data-testid=error-explorador]')!.textContent)).toContain('No se pudo abrir la carpeta.');
      expect(Array.from(el.querySelectorAll('[data-testid=error-explorador] button')).some((b) => b.textContent?.includes('Reintentar'))).toBe(true);
    });
  });

  describe('permisos por rol', () => {
    const MANUAL_ADMIN = nivel({
      arbol: 'MANUAL',
      puede_subir: true,
      carpetas: [entrada('3', 'Contratos', 2)],
      archivos: { items: [archivoDe(9, { origen: 'ADMIN', tipo_entidad: 'ARCHIVO', numero: null, nombre_archivo: 'Acta.pdf', id_carpeta: 3, carpeta: 'Contratos' }), archivoDe(10)], total: 2, page: 0, size: 10 },
    });

    it('ADMIN en «Mis carpetas»: ve «Subir archivo», «Nueva carpeta» y «Archivar» (carpeta y archivo propio)', async () => {
      repo['explorador'].mockReturnValue(of(MANUAL_ADMIN));
      const { q, el } = await ir('/archivos/MANUAL', 'ADMIN');

      expect(q('[data-testid=subir]')).toBeTruthy();
      expect(q('[data-testid=nueva-carpeta]')).toBeTruthy();
      expect(q('[data-testid=archivar-carpeta]')).toBeTruthy();
      const filas = el.querySelectorAll('tbody tr');
      // Solo el archivo del ADMIN (origen ADMIN) se puede archivar; un comprobante NUNCA.
      expect(filas[0].querySelector('[data-testid=accion-archivar]')).toBeTruthy();
      expect(filas[1].querySelector('[data-testid=accion-archivar]')).toBeNull();
      expect(q('[data-testid=incluir-archivados]')).toBeTruthy();
    });

    it('OPERATIVO (el servidor dice puede_subir=false): NO ve subir, nueva carpeta, archivar ni incluir archivados; sí ve Ver, Descargar y Detalle', async () => {
      repo['explorador'].mockReturnValue(of({ ...MANUAL_ADMIN, puede_subir: false }));
      const { q, el } = await ir('/archivos/MANUAL', 'OPERATIVO');

      expect(q('[data-testid=subir]')).toBeNull();
      expect(q('[data-testid=nueva-carpeta]')).toBeNull();
      expect(q('[data-testid=archivar-carpeta]')).toBeNull();
      expect(q('[data-testid=accion-archivar]')).toBeNull();
      expect(q('[data-testid=incluir-archivados]')).toBeNull();
      const fila = el.querySelector('tbody tr')!;
      expect(fila.querySelector('[data-testid=accion-ver]')).toBeTruthy();
      expect(fila.querySelector('[data-testid=accion-descargar]')).toBeTruthy();
      expect(fila.querySelector('[data-testid=accion-detalle]')).toBeTruthy();
    });

    it('en un árbol VIRTUAL (por tipo) ni el ADMIN ve subir ni crear carpeta (el servidor dice puede_subir=false)', async () => {
      repo['explorador'].mockReturnValue(of(nivel({ arbol: 'TIPO', puede_subir: false, carpetas: [entrada('VENTA', 'Ventas')] })));
      const { q } = await ir('/archivos/TIPO', 'ADMIN');

      expect(q('[data-testid=subir]')).toBeNull();
      expect(q('[data-testid=nueva-carpeta]')).toBeNull();
      expect(q('[data-testid=archivar-carpeta]')).toBeNull();
    });

    it('un comprobante dentro de «Mis carpetas» tampoco ofrece «Archivar» al ADMIN (origen COMPROBANTE)', async () => {
      repo['explorador'].mockReturnValue(of(nivel({ arbol: 'TIPO', archivos: { items: [archivoDe(1)], total: 1, page: 0, size: 10 } })));
      expect((await ir('/archivos/TIPO?ruta=VENTA', 'ADMIN')).q('[data-testid=accion-archivar]')).toBeNull();
    });
  });

  describe('acciones de un archivo', () => {
    const CON_UNO = nivel({ arbol: 'TIPO', archivos: { items: [archivoDe(1)], total: 1, page: 0, size: 10 } });
    beforeEach(() => repo['explorador'].mockReturnValue(of(CON_UNO)));

    it('«Ver» abre el archivo por el visor (nunca incrusta nada)', async () => {
      const { q } = await ir('/archivos/TIPO?ruta=VENTA');
      q('[data-testid=accion-ver]')!.click();
      expect(visor.ver).toHaveBeenCalledWith(1, 'VENTA-1.pdf');
      expect(document.querySelector('iframe, object, embed')).toBeNull();
    });

    it('el título del archivo también lo abre', async () => {
      const { q } = await ir('/archivos/TIPO?ruta=VENTA');
      q('[data-testid=abrir-archivo]')!.click();
      expect(visor.ver).toHaveBeenCalledWith(1, 'VENTA-1.pdf');
    });

    it('«Descargar con clave» pide las opciones de ese archivo', async () => {
      const { q, esperar } = await ir('/archivos/TIPO?ruta=VENTA');
      q('[data-testid=accion-descargar]')!.click();
      await esperar();
      expect(repo['opcionesDescarga']).toHaveBeenCalledWith(1);
    });

    it('«Detalle» abre el detalle', async () => {
      const { q, esperar, el } = await ir('/archivos/TIPO?ruta=VENTA');
      q('[data-testid=accion-detalle]')!.click();
      await esperar();
      expect(el.querySelector('[data-testid=detalle-archivo]')).toBeTruthy();
      expect(limpio(el.querySelector('[data-testid=huella]')!.textContent)).toBe('cd'.repeat(32));
    });

    it('?documento=7 (desde «Ver documento» o la bitácora) abre el detalle de ese archivo y deja limpia la URL', async () => {
      const { h, el } = await ir('/archivos?documento=7');

      expect(repo['obtener']).toHaveBeenCalledWith(7);
      expect(el.querySelector('[data-testid=detalle-archivo]')).toBeTruthy();
      expect(TestBed.inject(Router).url).not.toContain('documento');
      void h;
    });

    it('un ?documento= que no es número se ignora', async () => {
      await ir('/archivos?documento=abc');
      expect(repo['obtener']).not.toHaveBeenCalled();
    });
  });

  describe('archivar (ADMIN)', () => {
    const PROPIO = nivel({ arbol: 'MANUAL', puede_subir: true, archivos: { items: [archivoDe(9, { origen: 'ADMIN', tipo_entidad: 'ARCHIVO', numero: null, nombre_archivo: 'Acta.pdf' })], total: 1, page: 0, size: 10 } });
    beforeEach(() => repo['explorador'].mockReturnValue(of(PROPIO)));

    async function pedirArchivar() {
      const x = await ir('/archivos/MANUAL', 'ADMIN');
      x.q('[data-testid=accion-archivar]')!.click();
      await x.esperar();
      const confirmar = () => Array.from(x.el.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find((b) => b.textContent?.trim() === 'Archivar')!;
      return { ...x, confirmar };
    }

    it('el botón queda deshabilitado hasta tener un motivo de 5 o más caracteres (máx. 255)', async () => {
      const { el, esperar, confirmar } = await pedirArchivar();
      const motivo = el.querySelector<HTMLTextAreaElement>('dialog[open] textarea')!;

      expect(confirmar().disabled).toBe(true);
      expect(motivo.maxLength).toBe(255);
      motivo.value = 'abcd';
      motivo.dispatchEvent(new Event('input'));
      await esperar();
      expect(confirmar().disabled).toBe(true);
      motivo.value = 'Ya no sirve';
      motivo.dispatchEvent(new Event('input'));
      await esperar();
      expect(confirmar().disabled).toBe(false);
    });

    it('archiva con el motivo, avisa y recarga la lista', async () => {
      const exito = vi.spyOn(TestBed.inject(ToastService), 'exito');
      const { el, esperar, confirmar } = await pedirArchivar();
      const motivo = el.querySelector<HTMLTextAreaElement>('dialog[open] textarea')!;
      motivo.value = 'Duplicado por error';
      motivo.dispatchEvent(new Event('input'));
      await esperar();
      confirmar().click();
      await esperar();

      expect(repo['archivar']).toHaveBeenCalledExactlyOnceWith(9, 'Duplicado por error');
      expect(exito).toHaveBeenCalledWith('Archivo archivado.');
      expect(repo['explorador']).toHaveBeenCalledTimes(2);
    });

    it('si el servidor lo rechaza, muestra su mensaje', async () => {
      repo['archivar'].mockReturnValueOnce(throwError(() => ({ code: 20010, message: 'Un comprobante del sistema nunca se archiva.' })));
      const error = vi.spyOn(TestBed.inject(ToastService), 'error');
      const { el, esperar, confirmar } = await pedirArchivar();
      const motivo = el.querySelector<HTMLTextAreaElement>('dialog[open] textarea')!;
      motivo.value = 'Motivo suficiente';
      motivo.dispatchEvent(new Event('input'));
      await esperar();
      confirmar().click();
      await esperar();

      expect(error).toHaveBeenCalledWith('Un comprobante del sistema nunca se archiva.', undefined);
    });

    it('archivar una carpeta con contenido (409): muestra el mensaje del servidor sin repetir la indicación', async () => {
      repo['explorador'].mockReturnValue(of(nivel({ arbol: 'MANUAL', puede_subir: true, carpetas: [entrada('3', 'Contratos', 2)] })));
      repo['archivarCarpeta'].mockReturnValueOnce(throwError(() => ({ code: 20006, message: 'La carpeta tiene archivos o subcarpetas activas: archivelos primero.' })));
      const error = vi.spyOn(TestBed.inject(ToastService), 'error');
      const x = await ir('/archivos/MANUAL', 'ADMIN');
      x.q('[data-testid=archivar-carpeta]')!.click();
      await x.esperar();
      const motivo = x.el.querySelector<HTMLTextAreaElement>('dialog[open] textarea')!;
      motivo.value = 'Ya no se usa';
      motivo.dispatchEvent(new Event('input'));
      await x.esperar();
      Array.from(x.el.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find((b) => b.textContent?.trim() === 'Archivar carpeta')!.click();
      await x.esperar();

      expect(repo['archivarCarpeta']).toHaveBeenCalledWith(3, 'Ya no se usa');
      expect(error).toHaveBeenCalledWith('La carpeta tiene archivos o subcarpetas activas: archivelos primero.', undefined);
    });

    it('no hay «Eliminar»: nada se borra', async () => {
      const { el } = await pedirArchivar();
      expect(limpio(el.textContent).toLowerCase()).not.toContain('eliminar');
      expect(limpio(el.textContent).toLowerCase()).not.toContain('borrar');
    });
  });

  describe('búsqueda global', () => {
    afterEach(() => vi.useRealTimers());

    async function buscar(texto: string, rol: Rol = 'OPERATIVO') {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      const x = await ir('/archivos', rol);
      const campo = x.q('[data-testid=buscar]') as HTMLInputElement;
      campo.value = texto;
      campo.dispatchEvent(new Event('input'));
      // The text reaches the debounce through an effect: let it run, then let the 300 ms pass.
      await x.esperar();
      await vi.advanceTimersByTimeAsync(400);
      await x.esperar();
      return x;
    }

    it('con texto reemplaza las carpetas por los resultados planos (GET /archivos) sin traer archivados', async () => {
      const { q, el } = await buscar('maría');

      expect(repo['listar']).toHaveBeenLastCalledWith(expect.objectContaining({ texto: 'maría', archivado: false, page: 0 }));
      expect(q('[data-testid=modo-busqueda]')).toBeTruthy();
      expect(q('[data-testid=raiz]')).toBeNull();
      expect(el.querySelectorAll('tbody tr')).toHaveLength(1);
    });

    it('«Volver a carpetas» limpia la búsqueda y regresa a las carpetas', async () => {
      const { q, esperar } = await buscar('maría');
      q('[data-testid=volver-carpetas]')!.click();
      await esperar();
      await vi.advanceTimersByTimeAsync(400);
      await esperar();

      expect(q('[data-testid=modo-busqueda]')).toBeNull();
      expect(q('[data-testid=raiz]')).toBeTruthy();
    });

    it('«incluir archivados» (ADMIN) quita el filtro archivado=false', async () => {
      const { q, esperar } = await buscar('acta', 'ADMIN');
      const caja = q('[data-testid=incluir-archivados]') as HTMLInputElement;
      caja.checked = true;
      caja.dispatchEvent(new Event('change'));
      await esperar();

      expect(repo['listar'].mock.calls.at(-1)![0].archivado).toBeUndefined();
    });
  });
});
