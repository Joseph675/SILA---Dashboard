import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import { AuthService, Rol } from '../../core/services/auth.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { CUENTAS_EN_CERO } from './testing/periodo.fixture';
import { PERIODOS_REPOSITORY } from './data/periodos.provider';
import type { Periodo } from './models/periodos.models';
import { PeriodosPageComponent } from './periodos-page.component';

const periodo = (id: number, mes: number, quincena: number, estado: Periodo['estado']): Periodo => ({
  ...CUENTAS_EN_CERO,
  id_periodo: id,
  anio: 2026,
  mes,
  quincena,
  fecha_inicio: `2026-${String(mes).padStart(2, '0')}-${quincena === 1 ? '01' : '16'}`,
  fecha_fin: `2026-${String(mes).padStart(2, '0')}-${quincena === 1 ? '15' : '28'}`,
  estado,
  ingresos_ventas: 0,
  costo_produccion: 0,
  gastos_operativos: 0,
  cartera_castigada: 0,
  resultado_estimado: 0,
});

/** Enero 1.ª ABIERTA, Enero 2.ª CERRADA, Febrero 1.ª ABIERTA. */
const FILAS = [periodo(1, 1, 1, 'ABIERTA'), periodo(2, 1, 2, 'CERRADA'), periodo(3, 2, 1, 'ABIERTA')];

/** Repositorio falso: cada prueba cambia lo que necesita. */
function crearRepo() {
  return {
    listar: vi.fn(() => of({ items: FILAS, total: FILAS.length, page: 0, size: 50 })),
    anios: vi.fn(() => of([2026])),
    actual: vi.fn(() => of(FILAS[0])),
    crearAnio: vi.fn(() => of({ anio: 2026, creados: 0 })),
    cerrar: vi.fn(() => of({ ...FILAS[0], estado: 'CERRADA' })),
    reabrir: vi.fn(() => of({ ...FILAS[1], estado: 'ABIERTA' })),
  };
}

describe('PeriodosPageComponent', () => {
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
      providers: [provideRouter([]), provideNgIconLoader(async () => ''), { provide: PERIODOS_REPOSITORY, useValue: repo }],
    });
  });

  /** Crea la pantalla con el rol dado y espera a que carguen años, quincena actual y lista. */
  async function crear(rol: Rol): Promise<ComponentFixture<PeriodosPageComponent>> {
    TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'prueba', nombre: 'Prueba', email: 'prueba@example.com', rol, mfa_activo: false });
    const fixture = TestBed.createComponent(PeriodosPageComponent);
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

  const raiz = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
  const botonesDeFila = (fixture: ComponentFixture<unknown>, texto: string) =>
    Array.from(raiz(fixture).querySelectorAll<HTMLButtonElement>('tbody button')).filter((b) => b.textContent?.trim().startsWith(texto));
  const botonPorTexto = (contenedor: ParentNode, texto: string) =>
    Array.from(contenedor.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim().startsWith(texto));

  describe('roles', () => {
    it('un ADMIN ve «Cerrar» en las filas abiertas y «Reabrir» en las cerradas', async () => {
      const fixture = await crear('ADMIN');

      expect(raiz(fixture).querySelectorAll('tbody tr').length).toBe(3);
      expect(botonesDeFila(fixture, 'Cerrar').length).toBe(2);
      expect(botonesDeFila(fixture, 'Reabrir').length).toBe(1);
      expect(botonPorTexto(raiz(fixture), 'Crear períodos de un año')).toBeTruthy();
    });

    it('un OPERATIVO no ve ninguna acción ni el botón de crear', async () => {
      const fixture = await crear('OPERATIVO');

      expect(raiz(fixture).querySelectorAll('tbody tr').length).toBe(3);
      expect(botonesDeFila(fixture, 'Cerrar').length).toBe(0);
      expect(botonesDeFila(fixture, 'Reabrir').length).toBe(0);
      expect(botonPorTexto(raiz(fixture), 'Crear períodos de un año')).toBeUndefined();
    });
  });

  describe('reabrir', () => {
    it('no confirma hasta que el motivo tenga 10 caracteres', async () => {
      const fixture = await crear('ADMIN');
      botonesDeFila(fixture, 'Reabrir')[0].click();
      await estabilizar(fixture);

      const motivo = raiz(fixture).querySelector<HTMLTextAreaElement>('textarea[id^="confirm-motivo"]')!;
      const confirmar = botonPorTexto(raiz(fixture), 'Reabrir quincena')!;
      const escribir = async (texto: string) => {
        motivo.value = texto;
        motivo.dispatchEvent(new Event('input'));
        await estabilizar(fixture);
      };

      await escribir('corto');
      expect(confirmar.disabled).toBe(true);
      await escribir('   nueve ch   ');
      expect(confirmar.disabled).toBe(true);
      confirmar.click();
      expect(repo.reabrir).not.toHaveBeenCalled();

      await escribir('Corrección de una venta');
      expect(confirmar.disabled).toBe(false);
      confirmar.click();
      await estabilizar(fixture);

      expect(repo.reabrir).toHaveBeenCalledExactlyOnceWith(2, 'Corrección de una venta');
    });
  });

  describe('cerrar', () => {
    it('confirma y recarga la lista', async () => {
      const fixture = await crear('ADMIN');
      botonesDeFila(fixture, 'Cerrar')[0].click();
      await estabilizar(fixture);
      const llamadasAntes = repo.listar.mock.calls.length;

      botonPorTexto(raiz(fixture), 'Cerrar quincena')!.click();
      await estabilizar(fixture);

      expect(repo.cerrar).toHaveBeenCalledExactlyOnceWith(1);
      expect(repo.listar.mock.calls.length).toBe(llamadasAntes + 1);
    });

    it('si otra persona ya la cerró (20010) muestra el mensaje del servidor y recarga', async () => {
      repo.cerrar.mockReturnValue(throwError(() => ({ code: 20010, message: 'La quincena ya está cerrada.' })));
      const fixture = await crear('ADMIN');
      const toasts = TestBed.inject(ToastService);
      botonesDeFila(fixture, 'Cerrar')[0].click();
      await estabilizar(fixture);
      const llamadasAntes = repo.listar.mock.calls.length;

      botonPorTexto(raiz(fixture), 'Cerrar quincena')!.click();
      await estabilizar(fixture);

      expect(toasts.toasts().map((t) => t.mensaje)).toContain('La quincena ya está cerrada.');
      expect(repo.listar.mock.calls.length).toBe(llamadasAntes + 1);
    });
  });

  describe('crear períodos de un año', () => {
    async function crearAnio(fixture: ComponentFixture<PeriodosPageComponent>, anio: string): Promise<void> {
      botonPorTexto(raiz(fixture), 'Crear períodos de un año')!.click();
      await estabilizar(fixture);
      const campo = raiz(fixture).querySelector<HTMLInputElement>('#crear-anio-form input')!;
      campo.value = anio;
      campo.dispatchEvent(new Event('input'));
      await estabilizar(fixture);
      raiz(fixture).querySelector('#crear-anio-form')!.dispatchEvent(new Event('submit'));
      await estabilizar(fixture);
    }

    it('con creados = 0 avisa que ya existían', async () => {
      repo.crearAnio.mockReturnValue(of({ anio: 2026, creados: 0 }));
      const fixture = await crear('ADMIN');

      await crearAnio(fixture, '2026');

      expect(repo.crearAnio).toHaveBeenCalledExactlyOnceWith(2026);
      expect(TestBed.inject(ToastService).toasts().map((t) => t.mensaje)).toContain('Las quincenas de 2026 ya existían.');
    });

    it('con creados > 0 avisa cuántas se crearon y selecciona ese año', async () => {
      repo.crearAnio.mockReturnValue(of({ anio: 2027, creados: 24 }));
      repo.anios.mockReturnValue(of([2026]));
      const fixture = await crear('ADMIN');

      await crearAnio(fixture, '2027');

      expect(TestBed.inject(ToastService).toasts().map((t) => t.mensaje)).toContain('Se crearon 24 quincenas de 2027.');
      expect(repo.listar).toHaveBeenLastCalledWith(expect.objectContaining({ anio: 2027 }));
    });

    it('rechaza un año fuera de 2000-2100 sin llamar al API', async () => {
      const fixture = await crear('ADMIN');

      await crearAnio(fixture, '1999');

      expect(repo.crearAnio).not.toHaveBeenCalled();
      expect(raiz(fixture).querySelector('#crear-anio-form')!.textContent).toContain('Debe estar entre 2000 y 2100.');
    });
  });

  describe('estados', () => {
    it('sin años creados muestra el estado vacío con el botón de crear', async () => {
      repo.anios.mockReturnValue(of([]));
      repo.actual.mockReturnValue(throwError(() => ({ code: 20007, message: 'No hay quincena para hoy.' })));
      const fixture = await crear('ADMIN');

      const vacio = Array.from(raiz(fixture).querySelectorAll<HTMLElement>('.sila-card')).find((e) => e.textContent?.includes('Aún no hay quincenas creadas'));
      expect(vacio).toBeTruthy();
      expect(botonPorTexto(vacio!, 'Crear períodos de un año')).toBeTruthy();
      expect(repo.listar).not.toHaveBeenCalled();
      expect(raiz(fixture).querySelector('table')).toBeNull();
    });

    it('si el API falla muestra el error con «Reintentar»', async () => {
      repo.anios.mockReturnValue(throwError(() => ({ code: 20999, message: 'x', supportRef: 77 })));
      const fixture = await crear('ADMIN');

      expect(raiz(fixture).querySelector('[role=alert]')?.textContent).toContain('Error interno. Referencia de soporte: 77');
      expect(botonPorTexto(raiz(fixture), 'Reintentar')).toBeTruthy();
    });
  });
});
