import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import type { Rol } from '../../core/auth/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { USUARIOS_REPOSITORY } from './data/usuarios.provider';
import type { Usuario } from './models/usuarios.models';
import { UsuariosPageComponent } from './usuarios-page.component';

const usuario = (id: number, extra: Partial<Usuario> = {}): Usuario => ({
  id_usuario: id,
  usuario: `usuario${id}`,
  nombre: `Persona ${id}`,
  email: `p${id}@example.com`,
  rol: 'OPERATIVO',
  activo: true,
  debe_cambiar_clave: false,
  mfa_activo: false,
  bloqueado: false,
  bloqueado_minutos: 0,
  ultimo_login: '2026-10-09T03:45:05',
  fecha_cambio_clave: null,
  fecha_creacion: '2026-10-01T10:00:00',
  ...extra,
});

/** 1 = yo (ADMIN con segundo factor), 2 = bloqueada, 3 = inactiva con segundo factor. */
const FILAS = [usuario(1, { rol: 'ADMIN', mfa_activo: true }), usuario(2, { bloqueado: true, bloqueado_minutos: 12 }), usuario(3, { activo: false, mfa_activo: true })];

function crearRepo() {
  return {
    listar: vi.fn(() => of({ items: FILAS, total: FILAS.length, page: 0, size: 10 })),
    crear: vi.fn(() => of({ usuario: usuario(9, { usuario: 'nuevo.usuario' }), clave_temporal: 'Temp-Clave-9999' })),
    actualizar: vi.fn(() => of(usuario(2))),
    cambiarEstado: vi.fn(() => of(usuario(3, { activo: true }))),
    desbloquear: vi.fn(() => of(usuario(2))),
    restablecerClave: vi.fn(() => of({ usuario: usuario(2), clave_temporal: 'Otra-Clave-7777' })),
    restablecerMfa: vi.fn(() => of(usuario(3))),
    sesiones: vi.fn(() => of([{ familia: 'f1', iniciada: '2026-10-09T03:45:05', ultima_actividad: '2026-10-09T04:00:00', ip: '10.0.0.9', user_agent: 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0' }])),
    cerrarSesiones: vi.fn(() => of(usuario(2))),
  };
}

describe('UsuariosPageComponent', () => {
  let repo: ReturnType<typeof crearRepo>;

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

  beforeEach(() => {
    repo = crearRepo();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideNgIconLoader(async () => ''), { provide: USUARIOS_REPOSITORY, useValue: repo }],
    });
  });

  async function crear(rol: Rol): Promise<ComponentFixture<UsuariosPageComponent>> {
    TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'usuario1', nombre: 'Persona 1', email: 'p1@example.com', rol, mfa_activo: true });
    const fixture = TestBed.createComponent(UsuariosPageComponent);
    await estabilizar(fixture);
    return fixture;
  }

  async function estabilizar(fixture: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
  }

  const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
  const fila = (f: ComponentFixture<unknown>, nombre: string) =>
    Array.from(raiz(f).querySelectorAll<HTMLTableRowElement>('tbody tr')).find((tr) => tr.textContent?.includes(nombre))!;
  const boton = (contenedor: ParentNode, texto: string) =>
    Array.from(contenedor.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(texto));

  describe('roles', () => {
    it('un ADMIN ve el botón de crear y las acciones de cada fila', async () => {
      const f = await crear('ADMIN');

      expect(raiz(f).querySelectorAll('tbody tr').length).toBe(3);
      expect(boton(raiz(f), 'Nuevo usuario')).toBeTruthy();
      expect(boton(fila(f, 'Persona 2'), 'Editar')).toBeTruthy();
      expect(boton(fila(f, 'Persona 2'), 'Restablecer clave')).toBeTruthy();
    });

    it('un OPERATIVO no ve ninguna acción ni el botón de crear', async () => {
      const f = await crear('OPERATIVO');

      expect(raiz(f).querySelectorAll('tbody tr').length).toBe(3);
      expect(boton(raiz(f), 'Nuevo usuario')).toBeUndefined();
      expect(raiz(f).querySelectorAll('tbody button').length).toBe(0);
    });
  });

  describe('mi propia cuenta', () => {
    it('deshabilita desactivar y restablecer clave/segundo factor, con un título que explica el motivo', async () => {
      const f = await crear('ADMIN');
      const mia = fila(f, 'Persona 1');

      for (const accion of ['Desactivar', 'Restablecer clave', 'Restablecer segundo factor']) {
        const b = boton(mia, accion)!;
        expect(b.disabled, accion).toBe(true);
        expect(b.title, accion).toContain('propia cuenta');
      }
      // Editar mis datos sí se puede (el rol queda bloqueado dentro del formulario).
      expect(boton(mia, 'Editar')!.disabled).toBe(false);
    });

    it('en las demás filas las acciones están habilitadas', async () => {
      const f = await crear('ADMIN');

      expect(boton(fila(f, 'Persona 2'), 'Desactivar')!.disabled).toBe(false);
      expect(boton(fila(f, 'Persona 3'), 'Restablecer segundo factor')!.disabled).toBe(false);
    });

    it('«Desbloquear» solo aparece en quien está bloqueado', async () => {
      const f = await crear('ADMIN');

      expect(boton(fila(f, 'Persona 2'), 'Desbloquear')).toBeTruthy();
      expect(boton(fila(f, 'Persona 1'), 'Desbloquear')).toBeUndefined();
      expect(fila(f, 'Persona 2').textContent).toContain('Bloqueado (12 min)');
    });
  });

  describe('clave temporal', () => {
    async function crearUsuario(f: ComponentFixture<UsuariosPageComponent>): Promise<void> {
      boton(raiz(f), 'Nuevo usuario')!.click();
      await estabilizar(f);
      const poner = (nombre: string, valor: string) => {
        const campo = raiz(f).querySelector<HTMLInputElement>(`#usuario-form [formcontrolname=${nombre}]`)!;
        campo.value = valor;
        campo.dispatchEvent(new Event('input'));
      };
      poner('usuario', 'nuevo.usuario');
      poner('nombre', 'Persona Nueva');
      poner('email', 'nuevo@example.com');
      await estabilizar(f);
      raiz(f).querySelector('#usuario-form')!.dispatchEvent(new Event('submit'));
      await estabilizar(f);
    }

    const dialogoClave = (f: ComponentFixture<unknown>) =>
      Array.from(raiz(f).querySelectorAll<HTMLDialogElement>('dialog')).find((d) => d.textContent?.includes('Clave temporal de'))!;

    it('al crear un usuario se muestra la clave temporal y NO se cierra con Escape ni sin confirmar', async () => {
      const f = await crear('ADMIN');

      await crearUsuario(f);

      expect(repo.crear).toHaveBeenCalledExactlyOnceWith({ usuario: 'nuevo.usuario', nombre: 'Persona Nueva', email: 'nuevo@example.com', rol: 'OPERATIVO' });
      const dialogo = dialogoClave(f);
      expect(dialogo.hasAttribute('open')).toBe(true);
      expect(dialogo.textContent).toContain('Temp-Clave-9999');
      expect(dialogo.textContent).toContain('no se podrá ver de nuevo');

      // Escape en un <dialog> nativo lanza «cancel»: debe quedar sin efecto.
      const cancelar = new Event('cancel', { cancelable: true });
      dialogo.dispatchEvent(cancelar);
      expect(cancelar.defaultPrevented).toBe(true);
      expect(dialogoClave(f).textContent).toContain('Temp-Clave-9999');
      // Tampoco hay una «X» para cerrarlo.
      expect(Array.from(dialogo.querySelectorAll('button')).map((b) => b.textContent!.trim())).not.toContain('Cerrar');
    });

    it('«Ya la copié» la descarta: la clave deja de estar en la página', async () => {
      const f = await crear('ADMIN');
      await crearUsuario(f);

      boton(dialogoClave(f), 'Ya la copié')!.click();
      await estabilizar(f);

      expect(raiz(f).textContent).not.toContain('Temp-Clave-9999');
      expect(dialogoClave(f)?.hasAttribute('open') ?? false).toBe(false);
    });

    it('restablecer la clave pide confirmación y luego muestra la clave nueva una sola vez', async () => {
      const f = await crear('ADMIN');
      boton(fila(f, 'Persona 2'), 'Restablecer clave')!.click();
      await estabilizar(f);
      expect(repo.restablecerClave).not.toHaveBeenCalled();

      const confirmar = Array.from(raiz(f).querySelectorAll('dialog')).map((d) => boton(d, 'Restablecer clave')).find((b) => b?.className.includes('bg-destructive'))!;
      confirmar.click();
      await estabilizar(f);

      expect(repo.restablecerClave).toHaveBeenCalledExactlyOnceWith(2);
      expect(dialogoClave(f).textContent).toContain('Otra-Clave-7777');
    });
  });

  describe('errores del servidor', () => {
    it('una regla del servidor (409 / 20006) se muestra como mensaje y no cambia nada', async () => {
      repo.cambiarEstado.mockReturnValue(throwError(() => ({ code: 20006, message: 'No puede desactivar su propia cuenta; pidale a otro administrador.' })));
      const f = await crear('ADMIN');
      boton(fila(f, 'Persona 2'), 'Desactivar')!.click();
      await estabilizar(f);

      const confirmar = Array.from(raiz(f).querySelectorAll('dialog')).map((d) => boton(d, 'Desactivar')).find((b) => b?.className.includes('bg-destructive'))!;
      confirmar.click();
      await estabilizar(f);

      expect(TestBed.inject(ToastService).toasts().map((t) => t.mensaje)).toContain('No puede desactivar su propia cuenta; pidale a otro administrador.');
    });
  });

  describe('sesiones de otras personas', () => {
    it('un ADMIN ve «Ver sesiones» y «Cerrar sus sesiones» en cada fila; un OPERATIVO no ve nada', async () => {
      const admin = await crear('ADMIN');
      for (const nombre of ['Persona 1', 'Persona 2', 'Persona 3']) {
        expect(boton(fila(admin, nombre), 'Ver sesiones'), nombre).toBeTruthy();
        expect(boton(fila(admin, nombre), 'Cerrar las sesiones'), nombre).toBeTruthy();
      }
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter([]), provideNgIconLoader(async () => ''), { provide: USUARIOS_REPOSITORY, useValue: repo }] });

      const operativo = await crear('OPERATIVO');
      expect(boton(raiz(operativo), 'Ver sesiones')).toBeUndefined();
      expect(boton(raiz(operativo), 'Cerrar las sesiones')).toBeUndefined();
    });

    it('«Ver sesiones» muestra las sesiones abiertas de esa persona (solo lectura, sin «Esta sesión»)', async () => {
      const f = await crear('ADMIN');

      boton(fila(f, 'Persona 2'), 'Ver sesiones')!.click();
      await estabilizar(f);

      expect(repo.sesiones).toHaveBeenCalledExactlyOnceWith(2);
      const dialogo = Array.from(raiz(f).querySelectorAll('dialog')).find((d) => d.textContent?.includes('Sesiones de Persona 2'))!;
      expect(dialogo.textContent).toContain('Firefox en Linux');
      expect(dialogo.textContent).toContain('10.0.0.9');
      expect(dialogo.textContent).not.toContain('Esta sesión');
      expect(boton(dialogo, 'Cerrar la sesión')).toBeUndefined();
    });

    it('«Cerrar sus sesiones» pide confirmación y luego llama al API y avisa', async () => {
      const f = await crear('ADMIN');
      boton(fila(f, 'Persona 2'), 'Cerrar las sesiones')!.click();
      await estabilizar(f);
      expect(repo.cerrarSesiones).not.toHaveBeenCalled();

      const confirmar = Array.from(raiz(f).querySelectorAll('dialog')).map((d) => boton(d, 'Cerrar sus sesiones')).find((b) => b?.className.includes('bg-destructive'))!;
      confirmar.click();
      await estabilizar(f);

      expect(repo.cerrarSesiones).toHaveBeenCalledExactlyOnceWith(2);
      expect(TestBed.inject(ToastService).toasts().map((t) => t.mensaje)).toContain('Se cerraron las sesiones de "usuario2".');
    });

    it('sobre la propia cuenta sigue permitido, y la confirmación avisa que cierra también esta sesión', async () => {
      const f = await crear('ADMIN');
      const mia = boton(fila(f, 'Persona 1'), 'Cerrar las sesiones')!;

      expect(mia.disabled).toBe(false);
      mia.click();
      await estabilizar(f);
      expect(raiz(f).textContent).toContain('incluida esta');
    });
  });
});

