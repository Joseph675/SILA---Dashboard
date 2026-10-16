import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import { AuthService, Rol } from '../../core/services/auth.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PERIODOS_REPOSITORY } from '../periodos/data/periodos.provider';
import { GASTOS_REPOSITORY } from './data/gastos.provider';
import { GastoDialogComponent } from './gasto-dialog.component';
import { GastosTabComponent } from './gastos-tab.component';
import type { Gasto } from './models/gastos.models';

const CATEGORIAS = [
  { id_categoria: 1, nombre: 'COMBUSTIBLE', activo: true },
  { id_categoria: 2, nombre: 'INSUMOS', activo: true },
  { id_categoria: 3, nombre: 'ANTIGUA', activo: false },
];
const VIGENTE: Gasto = { id_gasto: 1, id_periodo: 19, anio: 2026, mes: 10, quincena: 1, id_categoria: 1, categoria: 'COMBUSTIBLE', fecha_gasto: '2026-10-13', concepto: 'Diésel del camión', monto: 85000, usuario_registro: 'ana', fecha_registro: '2026-10-14T02:40:01', estado: 'VIGENTE', motivo_anulacion: null, usuario_anulacion: null, fecha_anulacion: null };
const ANULADO: Gasto = { ...VIGENTE, id_gasto: 2, concepto: 'Gasto digitado mal', estado: 'ANULADO', motivo_anulacion: 'Monto equivocado', usuario_anulacion: 'kevin', fecha_anulacion: '2026-10-14T03:00:00' };

async function estabilizar(f: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 8; i++) {
    f.detectChanges();
    await f.whenStable();
  }
}
const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const texto = (f: ComponentFixture<unknown>, sel: string) => (raiz(f).querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
const boton = (c: ParentNode, t: string) => Array.from(c.querySelectorAll('button')).find((b) => b.textContent?.includes(t));

describe('Gastos', () => {
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
      listar: vi.fn(() => of({ items: [VIGENTE, ANULADO], total: 2, page: 0, size: 10 })),
      resumen: vi.fn(() => of({ total: 85000, cantidad: 1 })),
      categorias: vi.fn((soloActivas: boolean) => of(soloActivas ? CATEGORIAS.filter((c) => c.activo) : CATEGORIAS)),
      crear: vi.fn(() => of(VIGENTE)),
      anular: vi.fn(() => of({ ...VIGENTE, estado: 'ANULADO' })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideNgIconLoader(async () => ''), provideRouter([]),
        { provide: GASTOS_REPOSITORY, useValue: repo },
        { provide: PERIODOS_REPOSITORY, useValue: { listar: vi.fn(() => of({ items: [{ id_periodo: 19, anio: 2026, mes: 10, quincena: 1 }], total: 1, page: 0, size: 50 })), actual: vi.fn(() => of({ id_periodo: 19 })) } },
      ],
    });
  });

  async function tab(rol: Rol): Promise<ComponentFixture<GastosTabComponent>> {
    TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'a', nombre: 'A', email: 'a@example.com', rol, mfa_activo: true });
    const f = TestBed.createComponent(GastosTabComponent);
    await estabilizar(f);
    return f;
  }

  it('la quincena actual viene preseleccionada y el resumen usa los MISMOS filtros que la lista, también al cambiarlos', async () => {
    const f = await tab('ADMIN');
    expect(repo['listar'].mock.calls[0][0].id_periodo).toBe(19);
    expect(texto(f, '[data-testid=total-gastos]')).toContain('85.000');
    expect(texto(f, '[data-testid=cantidad-gastos]')).toContain('1 gasto vigente');

    const elegir = async (id: string, valor: string) => {
      const sel = raiz(f).querySelector<HTMLSelectElement>(`#${id}`)!;
      sel.value = valor;
      sel.dispatchEvent(new Event('change'));
      await estabilizar(f);
    };
    await elegir('gastos-categoria', '1');
    await elegir('gastos-estado', 'VIGENTE');

    const ultimaLista = repo['listar'].mock.calls.at(-1)![0];
    const ultimoResumen = repo['resumen'].mock.calls.at(-1)![0];
    expect(ultimaLista).toMatchObject({ id_periodo: 19, id_categoria: 1, estado: 'VIGENTE' });
    for (const campo of ['id_periodo', 'id_categoria', 'texto', 'estado', 'desde', 'hasta']) expect(ultimoResumen[campo]).toEqual(ultimaLista[campo]);
  });

  it('un gasto anulado se ve tachado con su insignia, motivo, usuario y fecha; no ofrece anular de nuevo', async () => {
    const f = await tab('ADMIN');
    const filas = raiz(f).querySelectorAll('tbody tr');

    expect(filas[1].querySelector('.line-through')).toBeTruthy();
    expect(filas[1].textContent).toContain('Anulado');
    expect(texto(f, '[data-testid=detalle-anulacion]')).toContain('Motivo: Monto equivocado · kevin');
    expect(boton(filas[1], 'Anular')).toBeUndefined();
    expect(boton(filas[0], 'Anular')).toBeTruthy();
  });

  it('cada gasto trae «Ver comprobante» hacia /comprobantes con su tipo e id', async () => {
    const f = await tab('OPERATIVO');
    const enlaces = Array.from(raiz(f).querySelectorAll<HTMLAnchorElement>('tbody a[data-testid=ver-comprobante]')).map((a) => a.getAttribute('href'));

    expect(enlaces).toEqual(['/comprobantes?ver=GASTO-1', '/comprobantes?ver=GASTO-2']);
  });

  it('un OPERATIVO no ve «Anular», pero sí «Registrar gasto»', async () => {
    const f = await tab('OPERATIVO');

    expect(boton(raiz(f).querySelector('tbody')!, 'Anular')).toBeUndefined();
    expect(boton(raiz(f), 'Registrar gasto')).toBeTruthy();
  });

  it('un ADMIN anula con motivo (≥ 10) y Idempotency-Key, y el total se recalcula', async () => {
    const exito = vi.spyOn(TestBed.inject(ToastService), 'exito');
    const f = await tab('ADMIN');
    boton(raiz(f).querySelector('tbody')!, 'Anular')!.click();
    await estabilizar(f);

    const confirmar = () => Array.from(raiz(f).querySelectorAll('dialog')).map((d) => boton(d, 'Anular gasto')).find((b) => b?.className.includes('bg-destructive'))!;
    expect(confirmar().disabled).toBe(true);
    const motivo = raiz(f).querySelector<HTMLTextAreaElement>('textarea[id^="confirm-motivo"]')!;
    motivo.value = 'Monto equivocado';
    motivo.dispatchEvent(new Event('input'));
    await estabilizar(f);
    confirmar().click();
    await estabilizar(f);

    const [id, texto2, clave] = repo['anular'].mock.calls[0];
    expect([id, texto2]).toEqual([1, 'Monto equivocado']);
    expect(clave.length).toBeGreaterThanOrEqual(8);
    expect(exito).toHaveBeenCalledTimes(1);
    expect(repo['resumen']).toHaveBeenCalledTimes(2);
  });

  describe('registrar gasto', () => {
    async function dialogo(): Promise<ComponentFixture<GastoDialogComponent>> {
      const f = TestBed.createComponent(GastoDialogComponent);
      f.componentRef.setInput('categorias', CATEGORIAS);
      f.componentRef.setInput('abierto', true);
      await estabilizar(f);
      return f;
    }
    function llenar(f: ComponentFixture<unknown>): void {
      const set = (n: string, v: string) => {
        const el = raiz(f).querySelector<HTMLInputElement | HTMLSelectElement>(`[formcontrolname=${n}]`)!;
        el.value = v;
        el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
      };
      set('categoria', '1');
      set('concepto', 'Diésel del camión');
      set('monto', '85000');
    }

    it('avisa que las compras de ingredientes y empaques van en Insumos, no como gasto', async () => {
      const f = await dialogo();
      expect(texto(f, '[data-testid=aviso-insumos]')).toBe('Las compras de ingredientes y empaques se registran en Insumos, no como gasto.');
    });

    it('solo ofrece las categorías activas y envía el gasto con una Idempotency-Key (sin fecha: la pone el servidor)', async () => {
      const f = await dialogo();
      const opciones = Array.from(raiz(f).querySelectorAll<HTMLOptionElement>('select option')).filter((o) => o.value).map((o) => o.textContent?.trim());
      expect(opciones).toEqual(['COMBUSTIBLE', 'INSUMOS']);

      llenar(f);
      await estabilizar(f);
      raiz(f).querySelector('#gasto-form')!.dispatchEvent(new Event('submit'));
      await estabilizar(f);

      const [cuerpo, clave] = repo['crear'].mock.calls[0];
      expect(cuerpo).toEqual({ id_categoria: 1, concepto: 'Diésel del camión', monto: 85000 });
      expect(clave.length).toBeGreaterThanOrEqual(8);
    });

    it('409 / 20010 (quincena cerrada) y 409 / 20006 (categoría inactiva) muestran el mensaje del servidor', async () => {
      const f = await dialogo();
      llenar(f);
      await estabilizar(f);

      repo['crear'].mockReturnValueOnce(throwError(() => ({ code: 20010, message: 'La quincena de esa fecha está cerrada.' })));
      raiz(f).querySelector('#gasto-form')!.dispatchEvent(new Event('submit'));
      await estabilizar(f);
      expect(texto(f, '[data-testid=error-gasto]')).toBe('La quincena de esa fecha está cerrada.');

      repo['crear'].mockReturnValueOnce(throwError(() => ({ code: 20006, message: 'La categoría está inactiva.' })));
      raiz(f).querySelector('#gasto-form')!.dispatchEvent(new Event('submit'));
      await estabilizar(f);
      expect(texto(f, '[data-testid=error-gasto]')).toBe('La categoría está inactiva.');
    });
  });
});
