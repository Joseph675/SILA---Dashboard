import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { Subject, of, throwError } from 'rxjs';
import { AuthService, Rol } from '../../core/services/auth.service';
import { ChartThemeService } from '../../shared/services/chart-theme.service';
import { GASTOS_REPOSITORY } from '../gastos/data/gastos.provider';
import { PERIODOS_REPOSITORY } from '../periodos/data/periodos.provider';
import { PERIODOS_ROUTES } from '../periodos/periodos.routes';
import type { Periodo } from '../periodos/models/periodos.models';
import { ResultadoAnioChartComponent } from './resultado-anio-chart.component';
import { periodoDe, OCTUBRE_1 } from './resultado-quincena.fixture';
import { ResultadoQuincenaPageComponent } from './resultado-quincena-page.component';
import { RESULTADO_QUINCENA_ROUTES } from './resultado-quincena.routes';

const PALETA = { chart1: '#00f', chart2: '#0f0', chart3: '#f00', chart4: '#ff0', chart5: '#0ff', success: '#0f0', destructive: '#f00', mutedForeground: '#888', border: '#333', foreground: '#fff' };
const PROVEEDOR_TEMA = { provide: ChartThemeService, useValue: { palette: signal(PALETA) } };
/** ApexCharts needs a real browser (matchMedia, SVG): here the chart is left out, but its component and events are real. */
function sinApex(): void {
  TestBed.overrideComponent(ResultadoAnioChartComponent, { remove: { imports: [NgApexchartsModule] }, add: { schemas: [NO_ERRORS_SCHEMA] } });
}

/** The 24 quincenas of 2026: only the ones up to octubre 1.ª have data. */
function año2026(): Periodo[] {
  return Array.from({ length: 24 }, (_, i) => {
    const id = i + 1;
    if (id === 19) return OCTUBRE_1;
    if (id < 19) return periodoDe(id, { ingresos_ventas: 100000 * id, resultado_estimado: 10000 * id, caja_neta: 5000 * id, leche_por_pagar: 1000, cartera_pendiente: 2000 });
    return periodoDe(id, { estado: 'ABIERTA' });
  });
}
const pagina = (items: Periodo[]) => of({ items, total: items.length, page: 0, size: 50 });
const noEncontrado = () => throwError(() => ({ code: 20007, message: 'No hay una quincena para hoy.' }));

async function estabilizar(f: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 6; i++) {
    f.detectChanges();
    await f.whenStable();
    await new Promise((r) => setTimeout(r));
  }
  f.detectChanges();
}
const limpio = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
/** The DOM text has no spaces between elements (`Gastos` + `$ 50.000`): compare ignoring spaces. */
const sinEsp = (s: string) => s.replace(/\s/g, '');

describe('Resultado por quincena', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let periodos: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let gastos: Record<string, any>;

  beforeEach(() => {
    // Only the clock is faked: «today» is 2026-10-14 in Colombia.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T17:00:00Z'));
    periodos = {
      anios: vi.fn(() => of([2025, 2026])),
      actual: vi.fn(() => of(OCTUBRE_1)),
      listar: vi.fn((q: { anio: number }) => pagina(q.anio === 2026 ? año2026() : [])),
    };
    gastos = { porCategoria: vi.fn(() => of([{ id_periodo: 19, anio: 2026, mes: 10, quincena: 1, categoria: 'COMBUSTIBLE', total_gastos: 30000 }, { id_periodo: 19, anio: 2026, mes: 10, quincena: 1, categoria: 'MANTENIMIENTO', total_gastos: 20000 }])) };
    TestBed.configureTestingModule({
      providers: [provideNgIconLoader(async () => ''), provideRouter([]), PROVEEDOR_TEMA, { provide: PERIODOS_REPOSITORY, useValue: periodos }, { provide: GASTOS_REPOSITORY, useValue: gastos }],
    });
    sinApex();
  });
  afterEach(() => vi.useRealTimers());

  async function abrir(rol: Rol = 'OPERATIVO'): Promise<{ f: ComponentFixture<ResultadoQuincenaPageComponent>; el: HTMLElement; t: (s: string) => string }> {
    TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'a', nombre: 'A', email: 'a@example.com', rol, mfa_activo: true });
    const f = TestBed.createComponent(ResultadoQuincenaPageComponent);
    await estabilizar(f);
    const el = f.nativeElement as HTMLElement;
    return { f, el, t: (s) => limpio(el.querySelector(s)?.textContent) };
  }
  const clic = async (f: ComponentFixture<unknown>, el: HTMLElement, sel: string) => {
    el.querySelector<HTMLElement>(sel)!.click();
    await estabilizar(f);
  };

  describe('qué se pide y qué se selecciona', () => {
    it('pide los años, la quincena de hoy y las 24 del año (anio + size 50), y los gastos de la seleccionada', async () => {
      const { el, t } = await abrir();

      expect(periodos['anios']).toHaveBeenCalledTimes(1);
      expect(periodos['actual']).toHaveBeenCalledTimes(1);
      expect(periodos['listar']).toHaveBeenCalledExactlyOnceWith({ anio: 2026, page: 0, size: 50 });
      expect(gastos['porCategoria']).toHaveBeenCalledExactlyOnceWith(19);
      expect(el.querySelector<HTMLSelectElement>('[data-testid=selector-anio]')!.value).toBe('2026');
      expect(t('[data-testid=quincena-seleccionada]')).toBe('Octubre · 1.ª quincena');
    });

    it('si /periodos/actual da 404: abre el año más reciente y la ÚLTIMA quincena que ya empezó', async () => {
      periodos['actual'].mockReturnValue(noEncontrado());
      const { el, t } = await abrir();

      expect(periodos['listar']).toHaveBeenCalledExactlyOnceWith({ anio: 2026, page: 0, size: 50 });
      expect(t('[data-testid=quincena-seleccionada]')).toBe('Octubre · 1.ª quincena');
      expect(el.querySelector('[data-testid=error-resultado]')).toBeNull();
    });

    it('404 y ya pasó el 16: la última empezada es octubre 2.ª', async () => {
      periodos['actual'].mockReturnValue(noEncontrado());
      vi.setSystemTime(new Date('2026-10-20T17:00:00Z'));
      const { t } = await abrir();

      expect(t('[data-testid=quincena-seleccionada]')).toBe('Octubre · 2.ª quincena');
    });

    it('cambiar el año vuelve a pedir ese año (anio + size 50) y reinicia la selección', async () => {
      periodos['listar'].mockImplementation((q: { anio: number }) => pagina(q.anio === 2026 ? año2026() : [periodoDe(1, { anio: 2025, fecha_inicio: '2025-01-01', fecha_fin: '2025-01-15' }), periodoDe(2, { anio: 2025, fecha_inicio: '2025-01-16', fecha_fin: '2025-01-31' })]));
      const { f, el, t } = await abrir();
      const sel = el.querySelector<HTMLSelectElement>('[data-testid=selector-anio]')!;
      sel.value = '2025';
      sel.dispatchEvent(new Event('change'));
      await estabilizar(f);

      expect(periodos['listar']).toHaveBeenLastCalledWith({ anio: 2025, page: 0, size: 50 });
      // Un año ya pasado: la última del año.
      expect(t('[data-testid=quincena-seleccionada]')).toBe('Enero · 2.ª quincena');
    });
  });

  describe('resultado y caja, sin mezclar', () => {
    it('RESULTADO: las líneas son las de la cascada y terminan en resultado_estimado', async () => {
      const { t } = await abrir();
      const bloque = t('[data-testid=lineas-resultado]');

      expect(t('[data-testid=valor-resultado]')).toBe('$ 530.000');
      expect(sinEsp(bloque)).toContain(sinEsp('+ Ventas sin IVA $ 900.000'));
      expect(sinEsp(bloque)).toContain(sinEsp('− Costo de producción $ 300.000'));
      expect(sinEsp(bloque)).toContain(sinEsp('− Gastos $ 50.000'));
      expect(sinEsp(bloque)).toContain(sinEsp('− Cartera castigada $ 20.000'));
      expect(sinEsp(bloque)).toContain(sinEsp('= Resultado $ 530.000'));
      expect(t('[data-testid=bloque-resultado]')).toContain('Estimación de gestión, no un estado contable.');
    });

    it('CAJA: cobrado (con contado y abonos) − pagos a lecheros − insumos − gastos = caja_neta', async () => {
      const { t } = await abrir();
      const bloque = t('[data-testid=lineas-caja]');

      expect(t('[data-testid=valor-caja]')).toBe('$ 410.000');
      expect(sinEsp(bloque)).toContain(sinEsp('+ Cobrado $ 700.000'));
      expect(sinEsp(bloque)).toContain(sinEsp('De ventas de contado $ 400.000'));
      expect(sinEsp(bloque)).toContain(sinEsp('De abonos de cartera $ 300.000'));
      expect(sinEsp(bloque)).toContain(sinEsp('− Pagos a lecheros $ 200.000'));
      expect(sinEsp(bloque)).toContain(sinEsp('− Compras de insumos $ 40.000'));
      expect(sinEsp(bloque)).toContain(sinEsp('− Gastos $ 50.000'));
      expect(sinEsp(bloque)).toContain(sinEsp('= Caja neta $ 410.000'));
    });

    it('lo que se debe y falta cobrar va APARTE: la leche comprada no está en resultado ni en caja', async () => {
      const { el, t } = await abrir();

      expect(t('[data-testid=bloque-resultado]')).not.toContain('Leche');
      expect(t('[data-testid=bloque-caja]')).not.toContain('Leche comprada');
      expect(sinEsp(t('[data-testid=bloque-deudas]'))).toContain(sinEsp('Para saber cuánto se debe y cuánto falta cobrar'));
      expect(t('[data-testid=leche-comprada]')).toBe('$ 450.000');
      expect(t('[data-testid=leche-por-pagar]')).toBe('$ 250.000');
      expect(t('[data-testid=cartera-pendiente]')).toBe('$ 371.000');
      expect(sinEsp(t('[data-testid=bloque-deudas]'))).toContain(sinEsp('La leche comprada NO resta en el resultado'));
      expect(sinEsp(t('[data-testid=bloque-deudas]'))).toContain(sinEsp('1.500 L'));
      expect(sinEsp(t('[data-testid=bloque-deudas]'))).toContain(sinEsp('120,5 L'));
      expect(sinEsp(t('[data-testid=bloque-deudas]'))).toContain(sinEsp('Total vendido (con IVA) $ 1.071.000'));
      expect(el.querySelector('[data-testid=bloque-deudas]')!.closest('[data-testid=bloque-resultado]')).toBeNull();
    });

    it('un RESULTADO NEGATIVO va en rojo, con su signo y con texto e ícono', async () => {
      periodos['actual'].mockReturnValue(of({ ...OCTUBRE_1, ingresos_ventas: 100000, resultado_estimado: -270000 }));
      periodos['listar'].mockReturnValue(pagina(año2026().map((p) => (p.id_periodo === 19 ? { ...OCTUBRE_1, ingresos_ventas: 100000, resultado_estimado: -270000 } : p))));
      const { el, t } = await abrir();
      const valor = el.querySelector('[data-testid=valor-resultado] app-monto span')!;

      expect(t('[data-testid=valor-resultado]')).toMatch(/^-\s?\$\s?270\.000$/);
      expect(valor.classList.contains('text-destructive')).toBe(true);
      expect(t('[data-testid=negativo-resultado]')).toBe('La quincena perdió plata.');
      expect(el.querySelector('[data-testid=negativo-caja]')).toBeNull();
    });

    it('una CAJA negativa también', async () => {
      const negativa = { ...OCTUBRE_1, caja_neta: -50000 };
      periodos['actual'].mockReturnValue(of(negativa));
      periodos['listar'].mockReturnValue(pagina(año2026().map((p) => (p.id_periodo === 19 ? negativa : p))));
      const { el, t } = await abrir();

      expect(el.querySelector('[data-testid=valor-caja] app-monto span')!.classList.contains('text-destructive')).toBe(true);
      expect(t('[data-testid=negativo-caja]')).toBe('Salió más plata de la que entró.');
    });

    it('un resultado positivo no lleva la marca de pérdida ni rojo', async () => {
      const { el } = await abrir();
      expect(el.querySelector('[data-testid=negativo-resultado]')).toBeNull();
      expect(el.querySelector('[data-testid=valor-resultado] app-monto span')!.classList.contains('text-destructive')).toBe(false);
    });

    it('quincena ABIERTA: avisa que las cifras pueden cambiar; CERRADA: no', async () => {
      const abierta = await abrir();
      expect(abierta.t('[data-testid=aviso-en-curso]')).toBe('Quincena en curso: las cifras pueden cambiar.');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), provideRouter([]), PROVEEDOR_TEMA, { provide: PERIODOS_REPOSITORY, useValue: periodos }, { provide: GASTOS_REPOSITORY, useValue: gastos }] });
      sinApex();
      const cerrada = { ...OCTUBRE_1, estado: 'CERRADA' as const };
      periodos['actual'].mockReturnValue(of(cerrada));
      periodos['listar'].mockReturnValue(pagina(año2026().map((p) => (p.id_periodo === 19 ? cerrada : p))));
      const otra = await abrir();

      expect(otra.el.querySelector('[data-testid=aviso-en-curso]')).toBeNull();
    });
  });

  describe('gastos por categoría', () => {
    it('lista las categorías y su total coincide con gastos_operativos (sin aviso)', async () => {
      const { el, t } = await abrir();

      expect(sinEsp(t('[data-testid=lista-gastos]'))).toContain(sinEsp('COMBUSTIBLE $ 30.000'));
      expect(sinEsp(t('[data-testid=lista-gastos]'))).toContain(sinEsp('MANTENIMIENTO $ 20.000'));
      expect(t('[data-testid=total-gastos]')).toBe('$ 50.000');
      expect(el.querySelector('[data-testid=gastos-no-coinciden]')).toBeNull();
    });

    it('sin gastos: estado vacío', async () => {
      gastos['porCategoria'].mockReturnValue(of([]));
      const { el, t } = await abrir();

      expect(t('[data-testid=sin-gastos]')).toBe('No hay gastos vigentes en esta quincena.');
      expect(el.querySelector('[data-testid=lista-gastos]')).toBeNull();
    });

    it('si las categorías NO suman los gastos de la quincena lo dice', async () => {
      gastos['porCategoria'].mockReturnValue(of([{ id_periodo: 19, anio: 2026, mes: 10, quincena: 1, categoria: 'COMBUSTIBLE', total_gastos: 10000 }]));
      const { t } = await abrir();

      expect(t('[data-testid=gastos-no-coinciden]')).toContain('no coincide');
    });

    it('si falla la consulta de gastos permite reintentar sin tumbar el resto', async () => {
      gastos['porCategoria'].mockReturnValueOnce(throwError(() => ({ code: 20999, message: 'caído' })));
      const { f, el, t } = await abrir();

      expect(t('[data-testid=bloque-gastos]')).toContain('No se pudieron cargar los gastos');
      expect(t('[data-testid=valor-resultado]')).toBe('$ 530.000');
      Array.from(el.querySelectorAll('[data-testid=bloque-gastos] button')).find((b) => b.textContent?.includes('Reintentar'))!.dispatchEvent(new Event('click'));
      await estabilizar(f);
      expect(el.querySelector('[data-testid=lista-gastos]')).toBeTruthy();
    });
  });

  describe('cambiar de quincena', () => {
    it('«Siguiente» y «Anterior» cambian la quincena y sus gastos, sin volver a pedir el año', async () => {
      const { f, el, t } = await abrir();

      await clic(f, el, '[data-testid=siguiente]');
      expect(t('[data-testid=quincena-seleccionada]')).toBe('Octubre · 2.ª quincena');
      expect(gastos['porCategoria']).toHaveBeenLastCalledWith(20);
      await clic(f, el, '[data-testid=anterior]');
      await clic(f, el, '[data-testid=anterior]');
      expect(t('[data-testid=quincena-seleccionada]')).toBe('Septiembre · 2.ª quincena');
      expect(periodos['listar']).toHaveBeenCalledTimes(1);
    });

    it('en la primera y en la última quincena del año el botón correspondiente está desactivado', async () => {
      const { f, el } = await abrir();
      for (let i = 0; i < 30; i++) {
        const prev = el.querySelector<HTMLButtonElement>('[data-testid=anterior]')!;
        if (prev.disabled) break;
        prev.click();
        await estabilizar(f);
      }
      expect(el.querySelector<HTMLButtonElement>('[data-testid=anterior]')!.disabled).toBe(true);
      expect(el.querySelector<HTMLButtonElement>('[data-testid=siguiente]')!.disabled).toBe(false);
    });

    it('hacer clic en una fila de la tabla selecciona esa quincena y la resalta', async () => {
      const { f, el, t } = await abrir();
      const filas = el.querySelectorAll<HTMLElement>('[data-testid=tabla-anio] tbody [data-testid=fila-anio]');
      expect(filas).toHaveLength(24);
      expect(filas[18].getAttribute('aria-current')).toBe('true');

      filas[4].querySelector<HTMLElement>('[data-testid=elegir-fila]')!.click();
      await estabilizar(f);

      expect(t('[data-testid=quincena-seleccionada]')).toBe('Marzo · 1.ª quincena');
      expect(el.querySelectorAll('[data-testid=tabla-anio] tbody [aria-current=true]')).toHaveLength(1);
      expect(el.querySelectorAll('[data-testid=tabla-anio] tbody [data-testid=fila-anio]')[4].getAttribute('aria-current')).toBe('true');
    });

    it('hacer clic en una barra de la gráfica selecciona esa quincena', async () => {
      const { f, el, t } = await abrir();
      const grafica = f.debugElement.query((d) => d.componentInstance instanceof ResultadoAnioChartComponent).componentInstance as { chart: { events: { dataPointSelection: (...a: unknown[]) => void; xAxisLabelClick: (...a: unknown[]) => void } } };

      grafica.chart.events.dataPointSelection(null, null, { dataPointIndex: 8 });
      await estabilizar(f);
      expect(t('[data-testid=quincena-seleccionada]')).toBe('Mayo · 1.ª quincena');

      // Y también por el rótulo del eje.
      grafica.chart.events.xAxisLabelClick(null, null, { labelIndex: 11 });
      await estabilizar(f);
      expect(t('[data-testid=quincena-seleccionada]')).toBe('Junio · 2.ª quincena');
      expect(el.querySelector('[data-testid=grafica-anio]')).toBeTruthy();
    });

    it('un clic en el espacio vacío de la columna (la barra mide 0) selecciona la quincena que marca Apex', async () => {
      const { f, t } = await abrir();
      const grafica = f.debugElement.query((d) => d.componentInstance instanceof ResultadoAnioChartComponent).componentInstance as { chart: { events: { click: (...a: unknown[]) => void } } };

      grafica.chart.events.click(null, null, { dataPointIndex: -1, globals: { capturedDataPointIndex: 4 } });
      await estabilizar(f);
      expect(t('[data-testid=quincena-seleccionada]')).toBe('Marzo · 1.ª quincena');

      // Fuera de las columnas (Apex no capturó ninguna): no cambia nada.
      grafica.chart.events.click(null, null, { dataPointIndex: -1, globals: { capturedDataPointIndex: -1 } });
      await estabilizar(f);
      expect(t('[data-testid=quincena-seleccionada]')).toBe('Marzo · 1.ª quincena');
    });

    it('un clic fuera de rango (índice -1) no cambia nada', async () => {
      const { f, t } = await abrir();
      const grafica = f.debugElement.query((d) => d.componentInstance instanceof ResultadoAnioChartComponent).componentInstance as { chart: { events: { dataPointSelection: (...a: unknown[]) => void } } };
      grafica.chart.events.dataPointSelection(null, null, { dataPointIndex: -1 });
      await estabilizar(f);

      expect(t('[data-testid=quincena-seleccionada]')).toBe('Octubre · 1.ª quincena');
    });
  });

  describe('tabla del año', () => {
    it('tiene la fila de totales rotulada «ya empezadas» y suma solo esas', async () => {
      const { t } = await abrir();
      const totales = t('[data-testid=totales-anio]');

      expect(totales).toContain('Total del año (19 quincenas ya empezadas)');
      // 18 quincenas (10.000 × id) + octubre 1.ª (530.000).
      const resultado18 = Array.from({ length: 18 }, (_, i) => 10000 * (i + 1)).reduce((a, b) => a + b, 0);
      expect(totales.replace(/[\s.]/g, '')).toContain(String(resultado18 + 530000));
    });

    it('muestra la etiqueta corta «1 de oct», el estado y las cifras de la fila', async () => {
      const { el } = await abrir();
      const fila = limpio(el.querySelectorAll('[data-testid=tabla-anio] tbody [data-testid=fila-anio]')[18].textContent);

      expect(fila).toContain('1 de oct');
      expect(fila).toContain('Abierta');
      expect(fila).toContain('$ 900.000');
      expect(fila).toContain('$ 530.000');
      expect(fila).toContain('$ 410.000');
      expect(fila).toContain('$ 250.000');
      expect(fila).toContain('$ 371.000');
    });

    it('las quincenas futuras sin datos salen atenuadas en la tabla', async () => {
      const { el } = await abrir();
      const filas = el.querySelectorAll('[data-testid=tabla-anio] tbody [data-testid=fila-anio]');

      expect(filas[22].classList.contains('text-muted-foreground')).toBe(true);
      expect(filas[10].classList.contains('text-muted-foreground')).toBe(false);
    });
  });

  describe('estados y refresco', () => {
    it('sin años: «Todavía no hay quincenas creadas», con enlace a Períodos solo para el ADMIN', async () => {
      periodos['anios'].mockReturnValue(of([]));
      periodos['actual'].mockReturnValue(noEncontrado());
      const admin = await abrir('ADMIN');
      expect(admin.t('[data-testid=sin-quincenas]')).toContain('Todavía no hay quincenas creadas');
      expect(admin.el.querySelector('[data-testid=sin-quincenas] a')?.getAttribute('href')).toBe('/periodos');
      expect(periodos['listar']).not.toHaveBeenCalled();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), provideRouter([]), PROVEEDOR_TEMA, { provide: PERIODOS_REPOSITORY, useValue: periodos }, { provide: GASTOS_REPOSITORY, useValue: gastos }] });
      sinApex();
      const operativo = await abrir('OPERATIVO');

      expect(operativo.el.querySelector('[data-testid=sin-quincenas] a')).toBeNull();
    });

    it('mientras carga: «Cargando…»', async () => {
      periodos['anios'].mockReturnValue(new Subject());
      TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'a', nombre: 'A', email: 'a@example.com', rol: 'OPERATIVO', mfa_activo: true });
      const f = TestBed.createComponent(ResultadoQuincenaPageComponent);
      f.detectChanges();

      expect(limpio((f.nativeElement as HTMLElement).querySelector('[data-testid=cargando-resultado]')?.textContent)).toBe('Cargando…');
    });

    it('si falla la carga: error con «Reintentar», que vuelve a pedir', async () => {
      periodos['listar'].mockReturnValueOnce(throwError(() => ({ code: 20999, message: 'caído' })));
      const { f, el } = await abrir();
      expect(el.querySelector('[data-testid=error-resultado]')).toBeTruthy();

      Array.from(el.querySelectorAll('[data-testid=error-resultado] button')).find((b) => b.textContent?.includes('Reintentar'))!.dispatchEvent(new Event('click'));
      await estabilizar(f);

      expect(el.querySelector('[data-testid=error-resultado]')).toBeNull();
      expect(el.querySelector('[data-testid=valor-resultado]')).toBeTruthy();
    });

    it('«Actualizar» vuelve a pedir todo y muestra la hora; NO hay sondeo automático', async () => {
      const { f, el, t } = await abrir();
      expect(t('[data-testid=hora-actualizacion]')).toMatch(/^Actualizado a las \d{2}:\d{2}$/);
      const antes = periodos['listar'].mock.calls.length;

      // Pasa un buen rato sin tocar nada: nada se vuelve a pedir.
      vi.useRealTimers();
      vi.useFakeTimers();
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
      expect(periodos['listar']).toHaveBeenCalledTimes(antes);

      vi.useRealTimers();
      await clic(f, el, '[data-testid=actualizar]');
      expect(periodos['listar']).toHaveBeenCalledTimes(antes + 1);
      expect(periodos['anios']).toHaveBeenCalledTimes(2);
      expect(gastos['porCategoria']).toHaveBeenCalledTimes(2);
    });

    it('el ADMIN ve «Ver cuentas de la quincena» (/periodos/19); el OPERATIVO no', async () => {
      const admin = await abrir('ADMIN');
      expect(admin.el.querySelector('a[href="/periodos/19"]')).toBeTruthy();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), provideRouter([]), PROVEEDOR_TEMA, { provide: PERIODOS_REPOSITORY, useValue: periodos }, { provide: GASTOS_REPOSITORY, useValue: gastos }] });
      sinApex();
      const op = await abrir('OPERATIVO');

      expect(op.el.querySelector('a[href="/periodos/19"]')).toBeNull();
    });

    it('OPERATIVO y ADMIN ven exactamente las mismas cifras', async () => {
      const cifras = (el: HTMLElement) => limpio(el.querySelector('[data-testid=bloque-resultado]')!.textContent) + limpio(el.querySelector('[data-testid=bloque-caja]')!.textContent) + limpio(el.querySelector('[data-testid=bloque-deudas]')!.textContent) + limpio(el.querySelector('[data-testid=totales-anio]')!.textContent);
      const admin = cifras((await abrir('ADMIN')).el);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), provideRouter([]), PROVEEDOR_TEMA, { provide: PERIODOS_REPOSITORY, useValue: periodos }, { provide: GASTOS_REPOSITORY, useValue: gastos }] });
      sinApex();

      expect(cifras((await abrir('OPERATIVO')).el)).toBe(admin);
    });
  });
});

@Component({ template: '' })
class Vacia {}

describe('Resultado por quincena · rutas', () => {
  async function ir(rol: Rol, url: string): Promise<string> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Vacia },
          { path: 'periodos', loadChildren: () => PERIODOS_ROUTES },
          { path: 'resultado-quincena', loadChildren: () => RESULTADO_QUINCENA_ROUTES },
        ]),
      ],
    });
    TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'x', nombre: 'X', email: 'x@example.com', rol, mfa_activo: false });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    return router.url;
  }

  it('un OPERATIVO SÍ entra a /resultado-quincena', async () => {
    expect(await ir('OPERATIVO', '/resultado-quincena')).toBe('/resultado-quincena');
  });

  it('un ADMIN también', async () => {
    expect(await ir('ADMIN', '/resultado-quincena')).toBe('/resultado-quincena');
  });

  it('/periodos y /periodos/:id siguen siendo SOLO ADMIN: un OPERATIVO termina en el inicio', async () => {
    expect(await ir('OPERATIVO', '/periodos')).toBe('/');
    TestBed.resetTestingModule();
    expect(await ir('OPERATIVO', '/periodos/19')).toBe('/');
  });

  it('un ADMIN sí entra a /periodos', async () => {
    expect(await ir('ADMIN', '/periodos')).toBe('/periodos');
  });

  it('la ruta nueva no lleva roleGuard', () => {
    expect(RESULTADO_QUINCENA_ROUTES.every((r) => !r.canActivate?.length)).toBe(true);
    expect(PERIODOS_ROUTES.every((r) => r.canActivate?.length === 1)).toBe(true);
  });
});
