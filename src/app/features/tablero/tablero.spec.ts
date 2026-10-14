import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { Subject, of, throwError } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthService, Rol } from '../../core/services/auth.service';
import { ChartThemeService } from '../../shared/services/chart-theme.service';
import { NOTIFICACIONES_REPOSITORY } from '../notificaciones/data/notificaciones.provider';
import { TABLERO_REPOSITORY } from './data/tablero.provider';
import type { Tablero } from './models/tablero.models';
import { INTERVALO_TABLERO_MS, TableroPageComponent } from './tablero-page.component';
import { VentasSemanaChartComponent } from './ventas-semana-chart.component';

const SEMANA = Array.from({ length: 7 }, (_, i) => ({ fecha: `2026-10-${String(8 + i).padStart(2, '0')}`, total: i === 2 ? 0 : 50000 * (i + 1), cantidad: i === 2 ? 0 : i + 1 }));
const ALERTA = (n: number, severidad: 'CRITICA' | 'ADVERTENCIA') => ({ clave: `K${n}`, tipo: 'INSUMO_AGOTADO', severidad, titulo: `Alerta ${n}`, detalle: `Detalle ${n}`, entidad: 'INSUMO', id_entidad: n, fecha: null });
const QUINCENA = { id_periodo: 19, anio: 2026, mes: 10, quincena: 1, fecha_inicio: '2026-10-01', fecha_fin: '2026-10-15', estado: 'ABIERTA' as const, ingresos_ventas: 900000, total_vendido: 1000000, total_cobrado: 800000, costo_produccion: 100000, gastos_operativos: 50000, cartera_castigada: 0, resultado_estimado: 750000, caja_neta: 120000, leche_litros: 1500, leche_por_pagar: 450000 };

const TABLERO: Tablero = {
  fecha: '2026-10-14',
  hoy: { ventas_total: 423114.24, ventas_cantidad: 12, ventas_contado: 406000, ventas_credito: 17114.24, caja_ingresos: 423114.24, caja_egresos: 650000, caja_neta: -226885.76, litros_recibidos: 12300, litros_rechazados: 20, lotes_producidos: 2 },
  quincena: QUINCENA,
  cartera: { saldo_total: 2500000, saldo_vencido: 800000, clientes_con_saldo: 7, clientes_en_mora: 2 },
  inventario: { valor_productos: 5000000, productos_bajo_minimo: 1, productos_agotados: 0, valor_insumos: 1200000, insumos_bajo_minimo: 3, lotes_por_vencer: 2 },
  lecheros: { saldo_por_pagar: 900000, proveedores_con_saldo: 4 },
  alertas: { total: 8, criticas: 2, principales: [ALERTA(1, 'CRITICA'), ALERTA(2, 'CRITICA'), ALERTA(3, 'ADVERTENCIA')] },
  ventas_semana: SEMANA,
};


const PALETA = { chart1: '#00f', chart2: '#0f0', chart3: '#f00', chart4: '#ff0', chart5: '#0ff', success: '#0f0', destructive: '#f00', mutedForeground: '#888', border: '#333', foreground: '#fff' };

/** ApexCharts and the theme service need a real browser (matchMedia, SVG): here the chart is left out, but its data table is real. */
function sinApex(): void {
  TestBed.overrideComponent(VentasSemanaChartComponent, { remove: { imports: [NgApexchartsModule] }, add: { schemas: [NO_ERRORS_SCHEMA] } });
}
const PROVEEDOR_TEMA = { provide: ChartThemeService, useValue: { palette: signal(PALETA) } };

async function estabilizar(f: { detectChanges: () => void; whenStable: () => Promise<unknown> } | ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 8; i++) {
    f.detectChanges();
    await f.whenStable();
  }
}
/** The value (`dd`) of the row (`dt`) with that label. */
function valorDe(el: HTMLElement, etiqueta: string): string {
  const dt = Array.from(el.querySelectorAll('dt')).find((x) => limpio(x.textContent) === etiqueta);
  return limpio(dt?.nextElementSibling?.textContent);
}
const limpio = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

describe('Tablero', () => {
  let repo: { obtener: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repo = { obtener: vi.fn(() => of(TABLERO)) };
    TestBed.configureTestingModule({
      providers: [
        provideNgIconLoader(async () => ''),
        provideRouter([]),
        PROVEEDOR_TEMA,
        { provide: TABLERO_REPOSITORY, useValue: repo },
        { provide: NOTIFICACIONES_REPOSITORY, useValue: { listar: vi.fn(() => of({ total: 0, criticas: 0, items: [] })) } },
      ],
    });
    sinApex();
  });

  async function pagina(rol: Rol = 'OPERATIVO', esperar = true): Promise<{ f: ComponentFixture<TableroPageComponent>; el: HTMLElement; q: (s: string) => string }> {
    TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'a', nombre: 'A', email: 'a@example.com', rol, mfa_activo: true });
    const f = TestBed.createComponent(TableroPageComponent);
    if (esperar) await estabilizar(f);
    else f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    return { f, el, q: (s) => limpio(el.querySelector(s)?.textContent) };
  }

  describe('contenido', () => {
    it('una sola llamada al entrar, y las tarjetas de «Hoy» muestran los pesos sin decimales y los litros con miles', async () => {
      const { el } = await pagina();
      const hoy = limpio(el.querySelector('[aria-labelledby=tb-hoy]')?.textContent);

      expect(repo.obtener).toHaveBeenCalledTimes(1);
      expect(hoy).toContain('$ 423.114');
      expect(hoy).not.toContain('423.114,24');
      expect(hoy).toContain('12 ventas');
      expect(hoy).toContain('Contado $ 406.000');
      expect(hoy).toContain('Crédito $ 17.114');
      expect(hoy).toContain('12.300 L');
      expect(hoy).toContain('Rechazados: 20 L');
      expect(hoy).toContain('Lotes producidos');
    });

    it('la fecha del encabezado es «miércoles 14 de octubre»', async () => {
      const { el } = await pagina();
      expect(limpio(el.querySelector('app-page-header')?.textContent)).toContain('miércoles 14 de octubre');
    });

    it('caja de hoy NEGATIVA: el neto va en rojo y con su signo menos', async () => {
      const { el } = await pagina();
      const valor = el.querySelector<HTMLElement>('[data-testid=tarjeta-caja] [data-testid=valor-tarjeta]')!;

      expect(valor.classList.contains('text-destructive')).toBe(true);
      expect(limpio(valor.textContent)).toMatch(/^-\s?\$\s?226\.886$/);
    });

    it('caja de hoy POSITIVA o en cero: el neto NO va en rojo', async () => {
      repo.obtener.mockReturnValue(of({ ...TABLERO, hoy: { ...TABLERO.hoy, caja_neta: 90000 } }));
      const { el } = await pagina();

      expect(el.querySelector('[data-testid=tarjeta-caja] [data-testid=valor-tarjeta]')!.classList.contains('text-destructive')).toBe(false);
    });

    it('quincena actual: título, estado, fechas y sus 4 tarjetas', async () => {
      const { el, q } = await pagina();
      const sec = limpio(el.querySelector('[aria-labelledby=tb-quincena]')?.textContent);

      expect(q('[data-testid=titulo-quincena]')).toBe('Quincena 1 de octubre 2026');
      expect(sec).toContain('Abierta');
      expect(sec).toContain('01/10/2026 – 15/10/2026');
      expect(sec).toContain('Resultado estimado');
      expect(sec).toContain('$ 750.000');
      expect(sec).toContain('Caja neta');
      expect(sec).toContain('Vendido / cobrado');
      expect(sec).toContain('Cobrado $ 800.000');
      expect(sec).toContain('Leche por pagar');
      expect(sec).toContain('$ 450.000');
    });

    it('resultado estimado negativo: en rojo', async () => {
      repo.obtener.mockReturnValue(of({ ...TABLERO, quincena: { ...QUINCENA, resultado_estimado: -120000 } }));
      const { el } = await pagina();
      expect(el.querySelector('[data-testid=tarjeta-resultado] [data-testid=valor-tarjeta]')!.classList.contains('text-destructive')).toBe(true);
    });

    it('cartera, inventario y lecheros muestran sus cifras y enlazan a su módulo', async () => {
      const { el, q } = await pagina();
      const enlaces = Array.from(el.querySelectorAll<HTMLAnchorElement>('[data-testid=enlace-bloque]')).map((a) => a.getAttribute('href'));

      expect(q('[data-testid=cartera-saldo]')).toBe('$ 2.500.000');
      expect(valorDe(el, 'Vencido')).toBe('$ 800.000');
      expect(valorDe(el, 'Clientes en mora')).toBe('2');
      expect(valorDe(el, 'Valor de productos')).toBe('$ 5.000.000');
      expect(valorDe(el, 'Valor de insumos')).toBe('$ 1.200.000');
      expect(valorDe(el, 'Productos bajo mínimo')).toBe('1');
      expect(valorDe(el, 'Productos agotados')).toBe('0');
      expect(valorDe(el, 'Insumos bajo mínimo')).toBe('3');
      expect(valorDe(el, 'Lotes por vencer (7 días)')).toBe('2');
      expect(valorDe(el, 'Proveedores con saldo')).toBe('4');
      expect(q('[data-testid=lecheros-saldo]')).toBe('$ 900.000');
      expect(enlaces).toEqual(['/cartera', '/inventario', '/insumos', '/acopio?pestana=lecheros']);
    });

    it('la gráfica trae las 7 filas (la de 0 también) en su tabla de texto', async () => {
      const { el } = await pagina();
      const filas = el.querySelectorAll('[data-testid=tabla-semana] tbody tr');

      expect(filas).toHaveLength(7);
      expect(limpio(filas[2].textContent)).toContain('$ 0');
      expect(limpio(filas[6].textContent)).toContain('miércoles 14 de octubre');
    });
  });

  describe('quincena null', () => {
    beforeEach(() => repo.obtener.mockReturnValue(of({ ...TABLERO, quincena: null })));

    it('muestra «No hay quincena creada para hoy» y no inventa tarjetas de quincena', async () => {
      const { el, q } = await pagina('OPERATIVO');

      expect(q('[data-testid=sin-quincena]')).toContain('No hay quincena creada para hoy');
      expect(el.querySelector('[data-testid=titulo-quincena]')).toBeNull();
      expect(el.textContent).not.toContain('Resultado estimado');
    });

    it('el enlace a Períodos es solo para el ADMIN', async () => {
      const admin = await pagina('ADMIN');
      expect(admin.el.querySelector<HTMLAnchorElement>('[data-testid=ir-periodos]')?.getAttribute('href')).toBe('/periodos');
      TestBed.resetTestingModule();
    });

    it('un OPERATIVO no ve el enlace a Períodos (pero sí el resto de las cifras)', async () => {
      const { el } = await pagina('OPERATIVO');
      expect(el.querySelector('[data-testid=ir-periodos]')).toBeNull();
      expect(el.querySelector('[data-testid=cartera-saldo]')).toBeTruthy();
    });
  });

  describe('alertas', () => {
    it('muestra las principales, destaca las críticas y «Ver todas (total)» lleva a /notificaciones', async () => {
      const { el, q } = await pagina();

      expect(el.querySelectorAll('[data-testid=alertas-tablero] app-notificacion-fila')).toHaveLength(3);
      expect(q('[aria-labelledby=tb-alertas]')).toContain('2 críticas');
      expect(q('[data-testid=ver-todas]')).toBe('Ver todas (8)');
      expect(el.querySelector('[data-testid=ver-todas]')!.getAttribute('href')).toBe('/notificaciones');
      expect(el.querySelector('app-notificacion-fila .border-destructive')).toBeTruthy();
    });

    it('abrir una alerta lleva a su módulo', async () => {
      const { f, el } = await pagina();
      const ir = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      el.querySelector<HTMLButtonElement>('app-notificacion-fila button')!.click();
      await estabilizar(f);

      expect(ir).toHaveBeenCalledWith(['/insumos'], { queryParams: undefined });
    });

    it('sin alertas: «Todo en orden» y sin «Ver todas»', async () => {
      repo.obtener.mockReturnValue(of({ ...TABLERO, alertas: { total: 0, criticas: 0, principales: [] } }));
      const { el, q } = await pagina();

      expect(q('[data-testid=sin-alertas]')).toContain('Todo en orden');
      expect(el.querySelector('[data-testid=ver-todas]')).toBeNull();
    });
  });

  describe('ADMIN y OPERATIVO ven lo mismo', () => {
    it('las cifras visibles son idénticas para los dos roles', async () => {
      const a = await pagina('ADMIN');
      const textoAdmin = limpio(a.el.querySelector('[aria-labelledby=tb-hoy]')?.textContent) + limpio(a.el.querySelector('[aria-label="Cartera, inventario y lecheros"]')?.textContent);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideNgIconLoader(async () => ''), provideRouter([]), PROVEEDOR_TEMA, { provide: TABLERO_REPOSITORY, useValue: repo }, { provide: NOTIFICACIONES_REPOSITORY, useValue: { listar: vi.fn(() => of({ total: 0, criticas: 0, items: [] })) } }],
      });
      sinApex();
      const o = await pagina('OPERATIVO');
      const textoOp = limpio(o.el.querySelector('[aria-labelledby=tb-hoy]')?.textContent) + limpio(o.el.querySelector('[aria-label="Cartera, inventario y lecheros"]')?.textContent);

      expect(textoOp).toBe(textoAdmin);
    });
  });

  describe('refresco', () => {
    afterEach(() => {
      vi.useRealTimers();
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    });

    it('refresca cada 2 minutos mientras la pantalla esté visible', async () => {
      vi.useFakeTimers();
      const { f } = await pagina();
      expect(repo.obtener).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(INTERVALO_TABLERO_MS);
      await estabilizar(f);
      expect(repo.obtener).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(INTERVALO_TABLERO_MS);
      await estabilizar(f);
      expect(repo.obtener).toHaveBeenCalledTimes(3);
    });

    it('con la pestaña oculta (document.hidden) NO refresca', async () => {
      vi.useFakeTimers();
      const { f } = await pagina();
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });

      await vi.advanceTimersByTimeAsync(INTERVALO_TABLERO_MS * 3);
      await estabilizar(f);

      expect(repo.obtener).toHaveBeenCalledTimes(1);
    });

    it('al volver a la pestaña después de más de 2 minutos refresca de inmediato; antes, no', async () => {
      vi.useFakeTimers();
      const { f } = await pagina();
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      await vi.advanceTimersByTimeAsync(INTERVALO_TABLERO_MS + 5000);
      expect(repo.obtener).toHaveBeenCalledTimes(1);

      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      await estabilizar(f);
      expect(repo.obtener).toHaveBeenCalledTimes(2);

      document.dispatchEvent(new Event('visibilitychange'));
      await estabilizar(f);
      expect(repo.obtener).toHaveBeenCalledTimes(2);
    });

    it('«Actualizar» vuelve a pedir y muestra la hora de la última carga', async () => {
      const { f, el, q } = await pagina();
      expect(q('[data-testid=hora-actualizacion]')).toMatch(/^Actualizado a las \d{2}:\d{2}$/);

      el.querySelector<HTMLButtonElement>('[data-testid=actualizar]')!.click();
      await estabilizar(f);

      expect(repo.obtener).toHaveBeenCalledTimes(2);
    });

    it('«Actualizar» no pide dos veces mientras una carga sigue en curso', async () => {
      const pendiente = new Subject<Tablero>();
      repo.obtener.mockReturnValueOnce(of(TABLERO)).mockReturnValue(pendiente);
      const { f, el } = await pagina();
      const boton = el.querySelector<HTMLButtonElement>('[data-testid=actualizar]')!;

      boton.click();
      f.detectChanges();
      expect(boton.disabled).toBe(true);
      boton.click();
      f.detectChanges();

      expect(repo.obtener).toHaveBeenCalledTimes(2);
      pendiente.next(TABLERO);
      pendiente.complete();
      await estabilizar(f);
      expect(boton.disabled).toBe(false);
    });

    it('si un refresco falla conserva las cifras anteriores y lo avisa', async () => {
      const { f, el, q } = await pagina();
      repo.obtener.mockReturnValue(throwError(() => ({ status: 500, error: { code: 20099, message: 'caído' } })));

      el.querySelector<HTMLButtonElement>('[data-testid=actualizar]')!.click();
      await estabilizar(f);

      expect(q('[data-testid=aviso-desactualizado]')).toContain('No se pudo actualizar');
      expect(q('[data-testid=cartera-saldo]')).toBe('$ 2.500.000');
      expect(el.querySelector('[data-testid=error-tablero]')).toBeNull();
    });
  });

  describe('estados', () => {
    it('mientras carga por primera vez muestra «Cargando…»', async () => {
      repo.obtener.mockReturnValue(new Subject<Tablero>());
      const { q } = await pagina('OPERATIVO', false);
      expect(q('[data-testid=cargando-tablero]')).toBe('Cargando…');
    });

    it('si falla la primera carga muestra el error con «Reintentar», que vuelve a pedir', async () => {
      repo.obtener.mockReturnValueOnce(throwError(() => ({ status: 500, error: { code: 20099, message: 'caído' } })));
      const { f, el } = await pagina();
      expect(el.querySelector('[data-testid=error-tablero]')).toBeTruthy();

      Array.from(el.querySelectorAll('[data-testid=error-tablero] button')).find((b) => b.textContent?.includes('Reintentar'))!.dispatchEvent(new Event('click'));
      await estabilizar(f);

      expect(repo.obtener).toHaveBeenCalledTimes(2);
      expect(el.querySelector('[data-testid=error-tablero]')).toBeNull();
      expect(el.querySelector('[data-testid=cartera-saldo]')).toBeTruthy();
    });
  });
});

describe('Tablero · ruta raíz', () => {
  const hijosDelShell = () => routes.find((r) => r.path === '')!.children!;

  it('«» y «**» redirigen a «tablero» (ya no a «catalogos»)', () => {
    const raiz = hijosDelShell().find((r) => r.path === '' && r.pathMatch === 'full');
    const comodin = routes.flatMap((r) => r.children ?? []).find((r) => r.path === '**');

    expect(raiz?.redirectTo).toBe('tablero');
    expect(comodin?.redirectTo).toBe('tablero');
    expect(hijosDelShell().some((r) => r.path === 'tablero')).toBe(true);
  });

  it('navegar a «/» y a una ruta que no existe termina en /tablero', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideNgIconLoader(async () => ''),
        PROVEEDOR_TEMA,
        // The same children as the shell, without its session guard and layout.
        provideRouter([{ path: '', children: hijosDelShell() }]),
        { provide: TABLERO_REPOSITORY, useValue: { obtener: vi.fn(() => of(TABLERO)) } },
        { provide: NOTIFICACIONES_REPOSITORY, useValue: { listar: vi.fn(() => of({ total: 0, criticas: 0, items: [] })) } },
      ],
    });
    sinApex();
    TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'a', nombre: 'A', email: 'a@example.com', rol: 'OPERATIVO', mfa_activo: true });
    const h = await RouterTestingHarness.create();

    await h.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/tablero');
    await h.navigateByUrl('/ruta-que-no-existe');
    expect(TestBed.inject(Router).url).toBe('/tablero');
  });
});
