import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import type { SesionAbierta } from '../../core/auth/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { CuentaPageComponent } from './cuenta-page.component';

const UA_CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const SESIONES: SesionAbierta[] = [
  { familia: 'f-actual', iniciada: '2026-10-09T03:45:05', ultima_actividad: '2026-10-09T04:00:00', ip: '10.0.0.5', user_agent: UA_CHROME_WIN, actual: true },
  { familia: 'f-otra', iniciada: '2026-10-08T20:00:00', ultima_actividad: '2026-10-08T21:00:00', ip: '190.1.2.3', user_agent: 'curl/8', actual: false },
];

function crearAuth(mfaActivo: boolean) {
  return {
    sesion: signal({ id_usuario: 1, usuario: 'ana', nombre: 'Ana', email: 'a@example.com', rol: 'ADMIN' as const, mfa_activo: mfaActivo }),
    codigosRestantes: signal<number | null>(null),
    respaldoEstado: vi.fn(() => of({ restantes: 3 })),
    regenerarCodigosRespaldo: vi.fn(() => of({ codigos_respaldo: ['AAAAA-11111', 'BBBBB-22222'] })),
    misSesiones: vi.fn(() => of(SESIONES)),
    cerrarMiSesion: vi.fn(() => of(undefined)),
    cerrarOtrasSesiones: vi.fn(() => of({ cerradas: 4 })),
    cerrarTodasSesiones: vi.fn(() => of({ cerradas: 5 })),
    cerrarSesion: vi.fn(() => of(undefined)),
    terminarSesion: vi.fn(),
    cambiarClave: vi.fn(),
    configurarMfa: vi.fn(),
    activarMfa: vi.fn(),
  };
}

describe('CuentaPageComponent', () => {
  let auth: ReturnType<typeof crearAuth>;
  let router: Router;

  beforeAll(() => {
    // jsdom no implementa <dialog>.showModal()/close(): el diálogo real usa ambos.
    const dialogo = HTMLDialogElement.prototype;
    dialogo.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogo.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });

  async function crear(mfaActivo = true): Promise<ComponentFixture<CuentaPageComponent>> {
    auth = crearAuth(mfaActivo);
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideNgIconLoader(async () => ''), { provide: AuthService, useValue: auth }] });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(CuentaPageComponent);
    await estabilizar(fixture);
    return fixture;
  }
  async function estabilizar(f: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 5; i++) {
      f.detectChanges();
      await f.whenStable();
    }
    f.detectChanges();
  }
  const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
  const boton = (c: ParentNode, texto: string) => Array.from(c.querySelectorAll('button')).find((b) => b.textContent?.includes(texto));
  const filas = (f: ComponentFixture<unknown>) => Array.from(raiz(f).querySelectorAll<HTMLTableRowElement>('section[aria-labelledby=cuenta-sesiones] tbody tr'));
  /** The confirm dialog of the page (the one with the "peligro" button). */
  const confirmar = (f: ComponentFixture<unknown>, texto: string) =>
    Array.from(raiz(f).querySelectorAll('dialog')).map((d) => boton(d, texto)).find((b) => b?.className.includes('bg-destructive'));

  describe('Mis sesiones', () => {
    it('lista las sesiones con el dispositivo, la IP y la hora de Colombia, y marca «Esta sesión»', async () => {
      const f = await crear();

      expect(filas(f).length).toBe(2);
      expect(filas(f)[0].textContent).toContain('Chrome en Windows');
      expect(filas(f)[0].textContent).toContain('Esta sesión');
      expect(filas(f)[0].textContent).toContain('10.0.0.5');
      expect(filas(f)[0].textContent).toContain('08/10/2026 22:45');
      expect(filas(f)[1].textContent).not.toContain('Esta sesión');
      expect(filas(f)[1].textContent).toContain('Dispositivo desconocido');
      expect(filas(f)[0].querySelector('[title]')?.getAttribute('title')).toBe(UA_CHROME_WIN);
    });

    it('cerrar la fila «Esta sesión» es cerrar sesión: limpia y va a /login (no llama a DELETE)', async () => {
      const f = await crear();

      boton(filas(f)[0], 'Cerrar')!.click();
      await estabilizar(f);

      expect(auth.cerrarSesion).toHaveBeenCalledTimes(1);
      expect(auth.cerrarMiSesion).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('cerrar otra fila llama a DELETE de esa familia y recarga la lista', async () => {
      const f = await crear();
      const cargas = auth.misSesiones.mock.calls.length;

      boton(filas(f)[1], 'Cerrar')!.click();
      await estabilizar(f);

      expect(auth.cerrarMiSesion).toHaveBeenCalledExactlyOnceWith('f-otra');
      expect(auth.misSesiones.mock.calls.length).toBe(cargas + 1);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('«Cerrar las demás» pide confirmación antes de hacer nada', async () => {
      const f = await crear();

      boton(raiz(f), 'Cerrar las demás')!.click();
      await estabilizar(f);
      expect(auth.cerrarOtrasSesiones).not.toHaveBeenCalled();
      expect(raiz(f).querySelector('dialog[open]')?.textContent).toContain('todas tus sesiones menos esta');

      confirmar(f, 'Cerrar las demás')!.click();
      await estabilizar(f);

      expect(auth.cerrarOtrasSesiones).toHaveBeenCalledTimes(1);
      expect(TestBed.inject(ToastService).toasts().map((t) => t.mensaje)).toContain('Se cerraron 4 sesiones.');
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('«Cerrar todas» pide confirmación fuerte y después limpia la sesión local y manda a /login', async () => {
      const f = await crear();

      boton(raiz(f), 'Cerrar todas')!.click();
      await estabilizar(f);
      expect(auth.cerrarTodasSesiones).not.toHaveBeenCalled();
      expect(raiz(f).querySelector('dialog[open]')?.textContent).toContain('incluida esta');

      confirmar(f, 'Sí, cerrar todas')!.click();
      await estabilizar(f);

      expect(auth.cerrarTodasSesiones).toHaveBeenCalledTimes(1);
      expect(auth.terminarSesion).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { aviso: 'sesiones-cerradas' } });
    });

    it('si el servidor falla al cerrar, lo dice y no limpia nada', async () => {
      const f = await crear();
      auth.cerrarOtrasSesiones.mockReturnValue(throwError(() => ({ code: 20999, message: 'x', supportRef: 5 })));

      boton(raiz(f), 'Cerrar las demás')!.click();
      await estabilizar(f);
      confirmar(f, 'Cerrar las demás')!.click();
      await estabilizar(f);

      expect(TestBed.inject(ToastService).toasts().some((t) => t.tipo === 'error')).toBe(true);
      expect(auth.terminarSesion).not.toHaveBeenCalled();
    });
  });

  describe('Códigos de respaldo', () => {
    it('solo se ofrecen con el segundo factor activo, y dicen cuántos quedan', async () => {
      const con = await crear(true);
      expect(raiz(con).querySelector('section[aria-labelledby=cuenta-respaldo]')).toBeTruthy();
      expect(raiz(con).textContent).toContain('Te quedan 3 de 10 códigos');
      expect(raiz(con).textContent).not.toContain('Conviene generar nuevos');
      expect(Array.from(raiz(con).querySelectorAll('section button')).some((b) => b.textContent?.includes('Generar códigos nuevos'))).toBe(true);
      expect(auth.respaldoEstado).toHaveBeenCalledTimes(1);
      TestBed.resetTestingModule();

      const sin = await crear(false);
      expect(raiz(sin).querySelector('section[aria-labelledby=cuenta-respaldo]')).toBeNull();
      // (el diálogo de regenerar existe cerrado; lo que no existe es el botón de la sección)
      expect(Array.from(raiz(sin).querySelectorAll('section button')).some((b) => b.textContent?.includes('Generar códigos nuevos'))).toBe(false);
      expect(auth.respaldoEstado).not.toHaveBeenCalled();
    });

    it('con 2 o menos recomienda generar nuevos', async () => {
      auth = crearAuth(true);
      auth.respaldoEstado.mockReturnValue(of({ restantes: 2 }));
      TestBed.configureTestingModule({ providers: [provideRouter([]), provideNgIconLoader(async () => ''), { provide: AuthService, useValue: auth }] });
      const f = TestBed.createComponent(CuentaPageComponent);
      await estabilizar(f);

      expect(raiz(f).textContent).toContain('Te quedan 2 de 10 códigos');
      expect(raiz(f).textContent).toContain('Conviene generar nuevos');
    });

    it('generar nuevos pide la clave actual, avisa que los anteriores dejan de servir y muestra los nuevos sin poder cerrarlos', async () => {
      const f = await crear();

      boton(raiz(f), 'Generar códigos nuevos')!.click();
      await estabilizar(f);
      expect(raiz(f).textContent).toContain('Los códigos de respaldo anteriores dejarán de servir');

      const campo = raiz(f).querySelector<HTMLInputElement>('#regenerar-codigos-form input')!;
      campo.value = 'mi-clave-actual-123';
      campo.dispatchEvent(new Event('input'));
      const codigo = raiz(f).querySelector<HTMLInputElement>('#regenerar-codigos-form input[inputmode=numeric]')!;
      codigo.value = '123456';
      codigo.dispatchEvent(new Event('input'));
      await estabilizar(f);
      raiz(f).querySelector('#regenerar-codigos-form')!.dispatchEvent(new Event('submit'));
      await estabilizar(f);

      expect(auth.regenerarCodigosRespaldo).toHaveBeenCalledExactlyOnceWith('mi-clave-actual-123', '123456');
      const panel = raiz(f).querySelector('app-codigos-respaldo')!;
      expect(panel.textContent).toContain('AAAAA-11111');
      const cancelar = new Event('cancel', { cancelable: true });
      panel.closest('dialog')!.dispatchEvent(cancelar);
      expect(cancelar.defaultPrevented).toBe(true);

      // Tras confirmar que los guardó, desaparecen de la página y se vuelve a consultar cuántos quedan.
      const marca = panel.querySelector<HTMLInputElement>('input[type=checkbox]')!;
      marca.checked = true;
      marca.dispatchEvent(new Event('change'));
      await estabilizar(f);
      boton(panel, 'Continuar')!.click();
      await estabilizar(f);
      expect(raiz(f).textContent).not.toContain('AAAAA-11111');
      expect(auth.respaldoEstado).toHaveBeenCalledTimes(2);
    });

    it('con una clave equivocada muestra el mensaje del servidor y NO muestra códigos', async () => {
      const f = await crear();
      auth.regenerarCodigosRespaldo.mockReturnValue(throwError(() => ({ code: 20013, message: 'La clave actual no es correcta.' })));

      boton(raiz(f), 'Generar códigos nuevos')!.click();
      await estabilizar(f);
      const campo = raiz(f).querySelector<HTMLInputElement>('#regenerar-codigos-form input')!;
      campo.value = 'equivocada-123456';
      campo.dispatchEvent(new Event('input'));
      const codigo = raiz(f).querySelector<HTMLInputElement>('#regenerar-codigos-form input[inputmode=numeric]')!;
      codigo.value = '123456';
      codigo.dispatchEvent(new Event('input'));
      await estabilizar(f);
      raiz(f).querySelector('#regenerar-codigos-form')!.dispatchEvent(new Event('submit'));
      await estabilizar(f);

      expect(raiz(f).querySelector('dialog[open]')?.textContent).toContain('La clave actual no es correcta.');
      expect(raiz(f).querySelector('app-codigos-respaldo')).toBeNull();
    });
  });
});
