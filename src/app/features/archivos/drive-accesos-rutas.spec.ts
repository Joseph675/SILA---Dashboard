import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import { AuthService, Rol } from '../../core/services/auth.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AccesosTabComponent } from './accesos-tab.component';
import { ArchivosLayoutComponent } from './archivos-layout.component';
import { ARCHIVOS_ROUTES } from './archivos.routes';
import { ARCHIVOS_REPOSITORY } from './data/archivos.provider';
import { DrivePanelComponent, INTERVALO_DRIVE_MS } from './drive-panel.component';
import type { AccesoArchivo, EstadoDriveRespuesta } from './models/archivos.models';
import { estabilizar, limpio, polyfillDialog } from './pruebas.comunes';

const sesion = (rol: Rol) => ({ id_usuario: 1, usuario: 'a', nombre: 'A', email: 'a@example.com', rol, mfa_activo: true });
const DRIVE_OK: EstadoDriveRespuesta = { configurado: true, conectado: true, cuenta: 'empresa@gmail.com', carpeta: 'SILA-respaldo', pendientes: 3, con_error: 2, subidos: 120, ultimo_error: null, ultima_sincronizacion: '2026-10-14T15:05:00' };
const PAG = (items: unknown[]) => ({ items, total: items.length, page: 0, size: 10 });

describe('Panel de Drive (ADMIN)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: Record<string, any>;
  let irA: ReturnType<typeof vi.fn<(url: string) => void>>;

  beforeAll(polyfillDialog);
  beforeEach(() => {
    repo = {
      driveEstado: vi.fn(() => of(DRIVE_OK)),
      driveAutorizar: vi.fn(() => of({ url: 'https://accounts.google.com/o/oauth2/auth?x=1' })),
      driveSincronizar: vi.fn(() => of({ ...DRIVE_OK, pendientes: 0, con_error: 0 })),
      driveDesconectar: vi.fn(() => of({ ...DRIVE_OK, conectado: false, cuenta: null })),
    };
    irA = vi.fn<(url: string) => void>();
    vi.spyOn(DrivePanelComponent.prototype as unknown as { irA: (url: string) => void }, 'irA').mockImplementation((url: string) => irA(url));
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: ARCHIVOS_REPOSITORY, useValue: repo }] });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function crear() {
    const f = TestBed.createComponent(DrivePanelComponent);
    await estabilizar(f);
    const el = f.nativeElement as HTMLElement;
    return { f, el, q: (s: string) => el.querySelector<HTMLElement>(s), t: (s: string) => limpio(el.querySelector(s)?.textContent) };
  }

  it('muestra Conectado, la cuenta y los contadores (pendientes, con error, subidos) y la última sincronización', async () => {
    const { t, el } = await crear();

    expect(limpio(el.textContent)).toContain('Conectado');
    expect(t('[data-testid=cuenta-drive]')).toBe('Cuenta: empresa@gmail.com');
    expect(t('[data-testid=pendientes]')).toBe('3');
    expect(t('[data-testid=con-error]')).toBe('2');
    expect(t('[data-testid=subidos]')).toBe('120');
    expect(t('[data-testid=ultima-sync]')).toContain('14/10/2026 10:05');
  });

  it('el texto informativo: en Drive solo hay archivos cifrados con nombres sin sentido', async () => {
    const { t } = await crear();
    expect(t('[data-testid=texto-drive]')).toBe('En Drive solo hay archivos cifrados con nombres sin sentido: Google no ve nombres de clientes. Para ver uno, bájelo y ábralo en «Ver documento».');
  });

  it('un último error sale en un aviso rojo', async () => {
    repo['driveEstado'].mockReturnValue(of({ ...DRIVE_OK, conectado: false, ultimo_error: 'Google rechazó el permiso. Vuelva a conectar.' }));
    const { q, t } = await crear();

    expect(t('[data-testid=ultimo-error]')).toBe('Google rechazó el permiso. Vuelva a conectar.');
    expect(q('[data-testid=ultimo-error]')!.getAttribute('role')).toBe('alert');
    expect(t('[data-testid=conectar]')).toContain('Conectar con Google Drive');
    expect(q('[data-testid=sincronizar]')).toBeNull();
  });

  it('sin configurar en el servidor: solo el aviso, sin botones', async () => {
    repo['driveEstado'].mockReturnValue(of({ ...DRIVE_OK, configurado: false, conectado: false }));
    const { q, t } = await crear();

    expect(t('[data-testid=drive-no-configurado]')).toBe('Drive no está configurado en el servidor.');
    expect(q('[data-testid=conectar]')).toBeNull();
    expect(q('[data-testid=sincronizar]')).toBeNull();
    expect(q('[data-testid=desconectar]')).toBeNull();
  });

  it('«Volver a conectar» pide la dirección y manda a Google (solo https)', async () => {
    const { q, f } = await crear();
    expect(limpio(q('[data-testid=conectar]')!.textContent)).toBe('Volver a conectar');
    q('[data-testid=conectar]')!.click();
    await estabilizar(f);

    expect(irA).toHaveBeenCalledExactlyOnceWith('https://accounts.google.com/o/oauth2/auth?x=1');
  });

  it.each(['javascript:alert(1)', 'http://accounts.google.com/x', 'data:text/html,x'])('NO sigue la dirección %s', async (url) => {
    repo['driveAutorizar'].mockReturnValue(of({ url }));
    const { q, f } = await crear();
    q('[data-testid=conectar]')!.click();
    await estabilizar(f);

    expect(irA).not.toHaveBeenCalled();
  });

  it('503 al conectar (Drive sin configurar): muestra el mensaje del servidor', async () => {
    repo['driveAutorizar'].mockReturnValue(throwError(() => ({ code: 20019, message: 'Drive no está configurado.' })));
    const error = vi.spyOn(TestBed.inject(ToastService), 'error');
    const { q, f } = await crear();
    q('[data-testid=conectar]')!.click();
    await estabilizar(f);

    expect(error).toHaveBeenCalledWith('Drive no está configurado.', undefined);
  });

  it('«Sincronizar ahora» se deshabilita mientras corre y muestra el estado nuevo', async () => {
    let terminar!: (e: EstadoDriveRespuesta) => void;
    repo['driveSincronizar'].mockReturnValue(new (await import('rxjs')).Observable<EstadoDriveRespuesta>((s) => { terminar = (e) => { s.next(e); s.complete(); }; }));
    const { q, f, t } = await crear();
    const boton = q('[data-testid=sincronizar]') as HTMLButtonElement;
    boton.click();
    f.detectChanges();

    expect(boton.disabled).toBe(true);
    expect(limpio(boton.textContent)).toBe('Sincronizando…');
    boton.click();
    expect(repo['driveSincronizar']).toHaveBeenCalledTimes(1);

    terminar({ ...DRIVE_OK, pendientes: 0, con_error: 0, subidos: 125 });
    await estabilizar(f);
    expect(boton.disabled).toBe(false);
    expect(t('[data-testid=pendientes]')).toBe('0');
    expect(t('[data-testid=subidos]')).toBe('125');
  });

  it('«Desconectar» pide confirmación con el aviso de lo que pasa con lo ya subido', async () => {
    const { q, el, f, t } = await crear();
    q('[data-testid=desconectar]')!.click();
    await estabilizar(f);
    expect(repo['driveDesconectar']).not.toHaveBeenCalled();
    expect(limpio(el.textContent)).toContain('Lo ya subido queda en Drive; los nuevos esperarán hasta reconectar.');

    Array.from(el.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find((b) => b.textContent?.trim() === 'Desconectar')!.click();
    await estabilizar(f);
    expect(repo['driveDesconectar']).toHaveBeenCalledOnce();
    expect(limpio(el.textContent)).toContain('No conectado');
    void t;
  });

  describe('se refresca cada 30 s mientras la pestaña esté visible', () => {
    it('cada 30 s pide el estado; con la pestaña oculta, no', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      const { f } = await crear();
      expect(repo['driveEstado']).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(INTERVALO_DRIVE_MS);
      await estabilizar(f);
      expect(repo['driveEstado']).toHaveBeenCalledTimes(2);

      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      await vi.advanceTimersByTimeAsync(INTERVALO_DRIVE_MS * 3);
      expect(repo['driveEstado']).toHaveBeenCalledTimes(2);
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    });
  });

  it('si falla la primera consulta: mensaje con «Reintentar»', async () => {
    repo['driveEstado'].mockReturnValueOnce(throwError(() => ({ code: 20999, message: 'Error interno.' })));
    const { q, f } = await crear();
    expect(q('[data-testid=error-drive]')).toBeTruthy();
    Array.from(q('[data-testid=error-drive]')!.querySelectorAll('button')).find((b) => b.textContent?.includes('Reintentar'))!.click();
    await estabilizar(f);

    expect(q('[data-testid=cuenta-drive]')).toBeTruthy();
  });
});

describe('Bitácora de accesos (ADMIN)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: Record<string, any>;

  const acceso = (extra: Partial<AccesoArchivo> = {}): AccesoArchivo => ({ id_acceso: 1, fecha: '2026-10-14T02:40:00', id_documento: 7, nombre_archivo: 'VENTA-7.pdf', tipo_entidad: 'VENTA', id_entidad: 7, version: 'ORIGINAL', usuario: 'ana', accion: 'DESCARGAR', modo_clave: 'ALEATORIA', ip: '127.0.0.1', user_agent: 'Chrome', detalle: null, ...extra });

  beforeEach(() => {
    repo = { accesos: vi.fn(() => of(PAG([acceso(), acceso({ id_acceso: 2, accion: 'SUBIDA_RECHAZADA', id_documento: null, nombre_archivo: null, modo_clave: null, detalle: 'virus.pdf: amenaza detectada Eicar-Test' }), acceso({ id_acceso: 3, accion: 'VER', modo_clave: null })])) ) };
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), provideRouter([]), { provide: ARCHIVOS_REPOSITORY, useValue: repo }] });
  });

  async function crear(consulta: Record<string, string> = {}) {
    TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { queryParamMap: convertToParamMap(consulta) }, queryParamMap: of(convertToParamMap(consulta)) } });
    const f = TestBed.createComponent(AccesosTabComponent);
    await estabilizar(f);
    const el = f.nativeElement as HTMLElement;
    return { f, el, filas: () => Array.from(el.querySelectorAll('tbody tr')) };
  }

  it('lista fecha (hora de Colombia), usuario, acción, archivo (con enlace al detalle), TIPO de clave, IP y detalle', async () => {
    const { filas } = await crear();
    const primera = limpio(filas()[0].textContent);

    expect(primera).toContain('13/10/2026 21:40');
    expect(primera).toContain('ana');
    expect(primera).toContain('Descargar');
    expect(primera).toContain('VENTA-7.pdf');
    expect(primera).toContain('Clave aleatoria');
    expect(primera).toContain('127.0.0.1');
    expect(filas()[0].querySelector('[data-testid=enlace-archivo]')!.getAttribute('href')).toBe('/archivos?documento=7');
  });

  it('una subida rechazada se resalta, no tiene enlace de archivo y muestra el motivo del detalle', async () => {
    const { filas } = await crear();
    const rechazada = filas()[1];

    expect(rechazada.querySelector('[data-accion=SUBIDA_RECHAZADA]')!.classList.contains('text-destructive')).toBe(true);
    expect(rechazada.querySelector('[data-testid=enlace-archivo]')).toBeNull();
    expect(limpio(rechazada.textContent)).toContain('amenaza detectada Eicar-Test');
  });

  it('solo el TIPO de clave: nunca la clave (no hay columna ni campo «clave»)', async () => {
    const { el } = await crear();
    const encabezados = Array.from(el.querySelectorAll('thead th')).map((th) => limpio(th.textContent).toLowerCase());

    expect(encabezados).toContain('tipo de clave');
    expect(encabezados.every((h) => h !== 'clave')).toBe(true);
    expect(JSON.stringify(repo['accesos'].mock.calls)).not.toMatch(/"clave"/);
  });

  it('?id_documento= (de «Ver quién lo abrió») filtra por ese archivo', async () => {
    await crear({ id_documento: '7' });
    expect(repo['accesos']).toHaveBeenCalledWith(expect.objectContaining({ id_documento: 7 }));
  });

  it('un id_documento que no es número se ignora', async () => {
    await crear({ id_documento: 'x; DROP' });
    expect(repo['accesos'].mock.calls[0][0].id_documento).toBeUndefined();
  });

  it('filtrar por acción pide solo esa acción', async () => {
    const { f, el } = await crear();
    const sel = el.querySelector<HTMLSelectElement>('#acc-accion')!;
    sel.value = 'SUBIDA_RECHAZADA';
    sel.dispatchEvent(new Event('change'));
    await estabilizar(f);

    expect(repo['accesos'].mock.calls.at(-1)![0].accion).toBe('SUBIDA_RECHAZADA');
  });
});

describe('Archivos · pestañas y rutas por rol', () => {
  describe('rutas', () => {
    async function ir(rol: Rol | null, url: string): Promise<string> {
      TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), provideRouter([{ path: '', children: [] }, { path: 'archivos', children: ARCHIVOS_ROUTES }])] });
      if (rol) TestBed.inject(AuthService).sesion.set(sesion(rol));
      const router = TestBed.inject(Router);
      await router.navigateByUrl(url);
      return router.url;
    }

    it.each(['/archivos', '/archivos/ver-documento', '/archivos/TIPO?ruta=VENTA', '/archivos/manual'])('un OPERATIVO entra a %s', async (url) => {
      expect((await ir('OPERATIVO', url)).split('?')[0]).toBe(url.split('?')[0]);
    });

    it.each(['/archivos/drive', '/archivos/accesos'])('un OPERATIVO NO entra a %s: termina en el inicio', async (url) => {
      expect(await ir('OPERATIVO', url)).toBe('/');
    });

    it.each(['/archivos/drive', '/archivos/accesos'])('un ADMIN sí entra a %s', async (url) => {
      expect(await ir('ADMIN', url)).toBe(url);
    });

    it('un árbol que no existe vuelve a /archivos', async () => {
      expect(await ir('OPERATIVO', '/archivos/INVENTADO')).toBe('/archivos');
    });
  });

  describe('pestañas', () => {
    async function crear(rol: Rol, consulta: Record<string, string> = {}) {
      TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(consulta) } } }] });
      TestBed.inject(AuthService).sesion.set(sesion(rol));
      const router = TestBed.inject(Router);
      const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const exito = vi.spyOn(TestBed.inject(ToastService), 'exito');
      const error = vi.spyOn(TestBed.inject(ToastService), 'error');
      const f = TestBed.createComponent(ArchivosLayoutComponent);
      await estabilizar(f);
      const pestanas = Array.from((f.nativeElement as HTMLElement).querySelectorAll('[role=tab]')).map((x) => limpio(x.textContent));
      return { f, pestanas, navegar, router, exito, error };
    }

    it('OPERATIVO ve «Archivos» y «Ver documento»; NO ve «Drive» ni «Accesos»', async () => {
      expect((await crear('OPERATIVO')).pestanas).toEqual(['Archivos', 'Ver documento']);
    });

    it('ADMIN ve las cuatro', async () => {
      expect((await crear('ADMIN')).pestanas).toEqual(['Archivos', 'Ver documento', 'Drive', 'Accesos']);
    });

    it('elegir una pestaña navega a su ruta', async () => {
      const { f, navegar } = await crear('ADMIN');
      const tab = Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role=tab]')).find((x) => x.textContent?.includes('Drive'))!;
      tab.click();
      expect(navegar).toHaveBeenCalledWith(['/archivos', 'drive']);
    });

    it('al volver de Google con ?drive=ok avisa del éxito y limpia el parámetro de la URL', async () => {
      const { navegar, exito, error } = await crear('ADMIN', { drive: 'ok' });

      expect(exito).toHaveBeenCalledWith('Google Drive quedó conectado.');
      expect(error).not.toHaveBeenCalled();
      expect(navegar).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { drive: null }, replaceUrl: true }));
    });

    it('con ?drive=error avisa que no se pudo conectar', async () => {
      const { error, exito, navegar } = await crear('ADMIN', { drive: 'error' });

      expect(error).toHaveBeenCalledWith('No se pudo conectar con Google Drive. Intenta de nuevo.');
      expect(exito).not.toHaveBeenCalled();
      expect(navegar).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { drive: null } }));
    });

    it('sin ?drive= no avisa nada ni toca la URL', async () => {
      const { navegar, exito, error } = await crear('ADMIN', {});
      expect(navegar).not.toHaveBeenCalled();
      expect(exito).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });
  });
});

void signal;
void RouterTestingHarness;
void throwError;
