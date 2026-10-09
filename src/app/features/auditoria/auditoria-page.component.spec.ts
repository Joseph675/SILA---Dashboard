import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { of } from 'rxjs';
import { AUDITORIA_REPOSITORY } from './data/auditoria.provider';
import { AuditoriaPageComponent } from './auditoria-page.component';
import type { AccesoAuditoria, CambioAuditoria } from './models/auditoria.models';

const acceso = (id: number, evento: string, extra: Partial<AccesoAuditoria> = {}): AccesoAuditoria => ({
  id_evento: id,
  fecha: '2026-10-09T03:45:05.11159',
  usuario: 'ana.perez',
  evento,
  ip: '190.1.2.3',
  user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  detalle: null,
  ...extra,
});

const EVENTOS = ['LOGIN_OK', 'LOGIN_FALLIDO', 'MFA_FALLIDO', 'CUENTA_BLOQUEADA', 'USUARIO_DESCONOCIDO', 'REFRESH_REUSO', 'LIMITE_FRECUENCIA', 'LOGOUT', 'EVENTO_NUEVO_DEL_BACKEND'];

function crearRepo() {
  const pagina = <T>(items: T[]) => ({ items, total: items.length, page: 0, size: 10 });
  return {
    accesos: vi.fn(() => of(pagina(EVENTOS.map((e, i) => acceso(i + 1, e))))),
    cambios: vi.fn(() =>
      of(pagina([{ id_auditoria: 1, fecha: '2026-10-09T03:45:05', usuario: 'ana', tabla: 'USUARIOS_APP', id_registro: '74', columna: 'ROL', valor_anterior: 'OPERATIVO', valor_nuevo: 'ADMIN' }])),
    ),
    errores: vi.fn(() =>
      of(pagina([{ id_log: 54, fecha: '2026-10-09T03:45:05', usuario: 'ana', unidad: 'PKG_X.sp_y', codigo_error: -1, mensaje: 'ORA-00001: restricción única violada', contexto: null }])),
    ),
  };
}

describe('AuditoriaPageComponent', () => {
  let repo: ReturnType<typeof crearRepo>;

  beforeEach(() => {
    repo = crearRepo();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideNgIconLoader(async () => ''), { provide: AUDITORIA_REPOSITORY, useValue: repo }] });
  });

  async function crear(): Promise<ComponentFixture<AuditoriaPageComponent>> {
    const fixture = TestBed.createComponent(AuditoriaPageComponent);
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
  /** Types in a field and waits past the 300 ms debounce. */
  async function escribir(f: ComponentFixture<unknown>, selector: string, valor: string): Promise<void> {
    const campo = raiz(f).querySelector<HTMLInputElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 380));
    await estabilizar(f);
  }
  async function cambiar(f: ComponentFixture<unknown>, selector: string, valor: string): Promise<void> {
    const campo = raiz(f).querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('change'));
    await estabilizar(f);
  }
  const boton = (f: ComponentFixture<unknown>, texto: string) => Array.from(raiz(f).querySelectorAll('button')).find((b) => b.textContent?.includes(texto))!;
  /** The query the repository got, without the filters left undefined (ApiService leaves those out of the URL). */
  const ultima = <T extends object>(mock: { mock: { calls: T[][] } }) => Object.fromEntries(Object.entries(mock.mock.calls.at(-1)![0]).filter(([, v]) => v !== undefined));
  const hoyUtc = () => new Date().toISOString().slice(0, 10);

  it('abre en «Accesos», ordenado por fecha descendente, con tres pestañas', async () => {
    const f = await crear();

    expect(Array.from(raiz(f).querySelectorAll('[role=tab]')).map((t) => t.textContent!.trim())).toEqual(['Accesos', 'Cambios', 'Errores']);
    expect(ultima(repo.accesos)).toEqual({ page: 0, size: 10, sort: 'fecha,desc' });
  });

  describe('eventos de riesgo', () => {
    const chip = (f: ComponentFixture<unknown>, evento: string) => {
      const fila = Array.from(raiz(f).querySelectorAll('tbody tr')).find((tr) => tr.textContent?.includes(evento))!;
      return fila.querySelector('app-status-chip span')!;
    };

    it.each([
      ['Cuenta bloqueada', 'bg-destructive'],
      ['Usuario desconocido', 'bg-destructive'],
      ['Renovación reutilizada', 'bg-destructive'],
      ['Límite de frecuencia', 'bg-destructive'],
      ['Inicio de sesión fallido', 'bg-warning'],
      ['Segundo factor fallido', 'bg-warning'],
    ])('«%s» se destaca (%s) con ícono y texto, nunca solo color', async (texto, clase) => {
      const f = await crear();
      const c = chip(f, texto);

      expect(c.className).toContain(clase);
      expect(c.querySelector('app-icon')).toBeTruthy();
      expect(c.textContent).toContain(texto);
    });

    it.each(['Inicio de sesión', 'Cierre de sesión'])('«%s» es normal: tono neutro', async (texto) => {
      const f = await crear();
      const c = Array.from(raiz(f).querySelectorAll('tbody app-status-chip span')).find((s) => s.textContent!.trim() === texto)!;

      expect(c.className).toContain('bg-secondary');
      expect(c.className).not.toContain('bg-destructive');
      expect(c.className).not.toContain('bg-warning');
    });

    it('«Renovación reutilizada» explica qué significa en un título', async () => {
      const f = await crear();
      const envoltura = chip(f, 'Renovación reutilizada').closest('span[title]')!;

      expect(envoltura.getAttribute('title')).toBe('Un token de renovación se usó dos veces: posible robo de sesión; la sesión fue cerrada.');
    });

    it('un evento que el panel no conoce se muestra con su código, sin énfasis', async () => {
      const f = await crear();

      expect(chip(f, 'EVENTO_NUEVO_DEL_BACKEND').className).toContain('bg-secondary');
    });
  });

  describe('filtros de Accesos (nombres del contrato)', () => {
    it('usuario, evento, ip, desde y hasta llegan al repositorio', async () => {
      const f = await crear();

      await escribir(f, '#accesos-usuario', '  ana ');
      expect(ultima(repo.accesos)).toMatchObject({ usuario: 'ana' });
      await cambiar(f, '#accesos-evento', 'CUENTA_BLOQUEADA');
      expect(ultima(repo.accesos)).toMatchObject({ usuario: 'ana', evento: 'CUENTA_BLOQUEADA' });
      await escribir(f, '#accesos-ip', '190.1.2.3');
      await cambiar(f, '#accesos-desde', '2026-10-01');
      await cambiar(f, '#accesos-hasta', '2026-10-09');

      expect(ultima(repo.accesos)).toEqual({
        usuario: 'ana',
        evento: 'CUENTA_BLOQUEADA',
        ip: '190.1.2.3',
        desde: '2026-10-01',
        hasta: '2026-10-09',
        page: 0,
        size: 10,
        sort: 'fecha,desc',
      });
    });

    it('lo que está vacío no se envía', async () => {
      const f = await crear();
      await cambiar(f, '#accesos-evento', 'LOGIN_FALLIDO');
      await cambiar(f, '#accesos-evento', '');

      expect(Object.keys(ultima(repo.accesos))).toEqual(['page', 'size', 'sort']);
    });

    it('el selector de eventos trae los 14 del contrato', async () => {
      const f = await crear();

      expect(raiz(f).querySelectorAll('#accesos-evento option').length).toBe(15);
    });

    it('el atajo «Fallos de clave de hoy» pide LOGIN_FALLIDO desde hoy (día UTC)', async () => {
      const f = await crear();

      boton(f, 'Fallos de clave de hoy').click();
      await estabilizar(f);

      expect(ultima(repo.accesos)).toMatchObject({ evento: 'LOGIN_FALLIDO', desde: hoyUtc() });
    });

    it('el atajo del segundo factor pide MFA_FALLIDO desde hoy', async () => {
      const f = await crear();

      boton(f, 'Fallos del segundo factor de hoy').click();
      await estabilizar(f);

      expect(ultima(repo.accesos)).toMatchObject({ evento: 'MFA_FALLIDO', desde: hoyUtc() });
    });

    it('el atajo «Bloqueos» pide CUENTA_BLOQUEADA y «Quitar filtros» lo limpia todo', async () => {
      const f = await crear();

      boton(f, 'Bloqueos').click();
      await estabilizar(f);
      expect(ultima(repo.accesos)).toMatchObject({ evento: 'CUENTA_BLOQUEADA' });
      expect(ultima(repo.accesos)).not.toHaveProperty('desde');

      boton(f, 'Quitar filtros').click();
      await estabilizar(f);
      expect(Object.keys(ultima(repo.accesos))).toEqual(['page', 'size', 'sort']);
    });

    it('avisa que las fechas del filtro son días en UTC', async () => {
      const f = await crear();

      expect(raiz(f).textContent).toContain('días en UTC');
    });

    it('ordenar una columna lo pide al servidor con el nombre del contrato', async () => {
      const f = await crear();

      Array.from(raiz(f).querySelectorAll('thead button')).find((b) => b.textContent!.includes('Evento'))!.dispatchEvent(new Event('click'));
      await estabilizar(f);

      expect(ultima(repo.accesos)).toMatchObject({ sort: 'evento,asc' });
    });
  });

  describe('Cambios', () => {
    async function abrir() {
      const f = await crear();
      boton(f, 'Cambios').click();
      await estabilizar(f);
      return f;
    }

    it('muestra anterior → nuevo con las columnas del contrato y filtra por tabla y columna', async () => {
      const f = await abrir();

      expect(Array.from(raiz(f).querySelectorAll('thead th')).map((t) => t.textContent!.trim())).toEqual([
        'Fecha', 'Usuario', 'Tabla', 'Registro', 'Columna', 'Valor anterior', 'Valor nuevo',
      ]);
      const fila = raiz(f).querySelector('tbody tr')!.textContent!;
      expect(fila).toContain('OPERATIVO');
      expect(fila).toContain('ADMIN');

      await escribir(f, '#cambios-usuario', 'ana');
      await escribir(f, '#cambios-tabla', 'USUARIOS_APP');
      await escribir(f, '#cambios-columna', 'ROL');
      await cambiar(f, '#cambios-desde', '2026-10-01');
      await cambiar(f, '#cambios-hasta', '2026-10-09');

      expect(ultima(repo.cambios)).toEqual({ usuario: 'ana', tabla: 'USUARIOS_APP', columna: 'ROL', desde: '2026-10-01', hasta: '2026-10-09', page: 0, size: 10, sort: 'fecha,desc' });
    });

    it('un valor largo se corta y se ve completo en el título', async () => {
      const largo: CambioAuditoria = { id_auditoria: 2, fecha: '2026-10-09T03:45:05', usuario: 'a', tabla: 'T', id_registro: '1', columna: 'C', valor_anterior: null, valor_nuevo: 'x'.repeat(300) };
      repo.cambios.mockReturnValue(of({ items: [largo], total: 1, page: 0, size: 10 }) as never);
      const f = await abrir();

      const celda = raiz(f).querySelector<HTMLElement>('tbody td:last-child span')!;
      expect(celda.className).toContain('truncate');
      expect(celda.getAttribute('title')).toBe('x'.repeat(300));
    });
  });

  describe('Errores', () => {
    async function abrir() {
      const f = await crear();
      boton(f, 'Errores').click();
      await estabilizar(f);
      return f;
    }

    it('la columna «#» es el id_log y se explica que es la referencia de soporte; no hay buscador por referencia', async () => {
      const f = await abrir();

      expect(Array.from(raiz(f).querySelectorAll('thead th')).map((t) => t.textContent!.trim())).toEqual(['#', 'Fecha', 'Usuario', 'Unidad', 'Código', 'Mensaje']);
      expect(raiz(f).querySelector('tbody td')!.textContent!.trim()).toBe('54');
      expect(raiz(f).textContent).toContain('referencia de soporte');
      expect(raiz(f).querySelector('#errores-id-log, #errores-referencia')).toBeNull();
    });

    it('los filtros usan los nombres del contrato; el código es un número entero (puede ser negativo)', async () => {
      const f = await abrir();

      await escribir(f, '#errores-usuario', 'ana');
      await escribir(f, '#errores-unidad', 'PKG_X');
      await escribir(f, '#errores-codigo', '-1');
      expect(ultima(repo.errores)).toMatchObject({ usuario: 'ana', unidad: 'PKG_X', codigo_error: -1 });

      await escribir(f, '#errores-codigo', 'abc');
      expect(ultima(repo.errores)).not.toHaveProperty('codigo_error');
    });
  });
});
