import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NOTIFICACIONES_REPOSITORY } from './data/notificaciones.provider';
import { HttpNotificacionesRepository } from './data/http-notificaciones.repository';
import type { Notificacion } from './models/notificaciones.models';
import { NotificacionesCampanaComponent } from './notificaciones-campana.component';
import { NotificacionesPageComponent } from './notificaciones-page.component';
import { destinoDe, iconoDe, marcarVistas, sinVer } from './notificaciones.logica';
import { NotificacionesService } from './notificaciones.service';

const n = (clave: string, severidad: Notificacion['severidad'] = 'ADVERTENCIA', extra: Partial<Notificacion> = {}): Notificacion => ({
  clave, tipo: 'INSUMO_BAJO', severidad, titulo: `Alerta ${clave}`, detalle: 'Detalle', entidad: 'INSUMO', id_entidad: 1, fecha: null, ...extra,
});

describe('HttpNotificacionesRepository', () => {
  it('listar: GET /api/v1/notificaciones', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    let respuesta: unknown;
    TestBed.inject(HttpNotificacionesRepository).listar().subscribe((r) => (respuesta = r));

    const req = http.expectOne((r) => new URL(r.url, 'http://h').pathname === '/api/v1/notificaciones');
    expect(req.request.method).toBe('GET');
    req.flush({ total: 1, criticas: 0, items: [n('a')] });
    expect(respuesta).toMatchObject({ total: 1 });
    http.verify();
  });
});

describe('lógica de «no vistas»', () => {
  it('sinVer: solo las alertas cuya clave no está en el conjunto de vistas', () => {
    expect(sinVer([n('a'), n('b'), n('c')], new Set(['b'])).map((x) => x.clave)).toEqual(['a', 'c']);
  });

  it('marcarVistas: agrega las claves y, al pasar el máximo, descarta las más antiguas', () => {
    const base = new Set(['a', 'b']);
    const siguiente = marcarVistas(base, ['c']);
    expect([...siguiente]).toEqual(['a', 'b', 'c']);
    expect(base.size).toBe(2); // no modifica el original
    expect([...marcarVistas(new Set(['a', 'b', 'c']), ['d'], 3)]).toEqual(['b', 'c', 'd']);
  });

  it('una alerta resuelta y repetida con la MISMA clave no vuelve a avisar; una clave nueva sí', () => {
    const vistas = marcarVistas(new Set(), ['INSUMO_BAJO:1']);
    expect(sinVer([n('INSUMO_BAJO:1')], vistas)).toHaveLength(0);
    expect(sinVer([n('INSUMO_BAJO:2')], vistas)).toHaveLength(1);
  });

  it('destinoDe lleva cada entidad a su pantalla', () => {
    expect(destinoDe({ entidad: 'INSUMO', id_entidad: 3 }).ruta).toEqual(['/insumos']);
    expect(destinoDe({ entidad: 'PRODUCTO', id_entidad: 3 }).ruta).toEqual(['/inventario']);
    expect(destinoDe({ entidad: 'LOTE', id_entidad: 3 })).toEqual({ ruta: ['/produccion'], queryParams: { pestana: 'lotes' } });
    expect(destinoDe({ entidad: 'CLIENTE', id_entidad: 3 }).ruta).toEqual(['/cartera']);
    expect(destinoDe({ entidad: 'PERIODO', id_entidad: 19 }).ruta).toEqual(['/periodos', 19]);
    expect(destinoDe({ entidad: 'PERIODO', id_entidad: null }).ruta).toEqual(['/periodos']);
    expect(destinoDe({ entidad: 'DOCUMENTO', id_entidad: null }).ruta).toEqual(['/documentos']);
  });

  it('iconoDe da un icono por tipo, y uno por defecto para un tipo desconocido', () => {
    expect(iconoDe('INSUMO_AGOTADO')).toBe('lucidePackage');
    expect(iconoDe('CARTERA_VENCIDA')).toBe('lucideWallet');
    expect(iconoDe('LECHE_POR_PAGAR')).toBe('lucideMilk');
    expect(iconoDe('TIPO_NUEVO')).toBe('lucideBell');
  });
});

describe('NotificacionesService', () => {
  let repo: { listar: ReturnType<typeof vi.fn> };
  let sesion: ReturnType<typeof signal<{ id_usuario: number } | null>>;

  beforeEach(() => {
    localStorage.clear();
    repo = { listar: vi.fn(() => of({ total: 2, criticas: 1, items: [n('a', 'CRITICA'), n('b')] })) };
    sesion = signal<{ id_usuario: number } | null>({ id_usuario: 1 });
    TestBed.configureTestingModule({ providers: [{ provide: NOTIFICACIONES_REPOSITORY, useValue: repo }, { provide: AuthService, useValue: { sesion } }] });
  });

  it('cuenta las no vistas, las críticas entre ellas, y marcarTodasLeidas las deja en 0 SIN quitarlas de la lista', () => {
    const s = TestBed.inject(NotificacionesService);
    s.refrescar();
    expect(s.noVistas()).toHaveLength(2);
    expect(s.criticasNoVistas()).toHaveLength(1);

    s.marcarTodasLeidas();

    expect(s.noVistas()).toHaveLength(0);
    expect(s.items()).toHaveLength(2);
    expect(s.esLeida(s.items()[0])).toBe(true);
  });

  it('lo leído se guarda por usuario en localStorage y sobrevive a un servicio nuevo', () => {
    const s = TestBed.inject(NotificacionesService);
    s.refrescar();
    s.marcarTodasLeidas();
    expect(JSON.parse(localStorage.getItem('sila_notif_vistas_1')!)).toEqual(['a', 'b']);
    expect(localStorage.getItem('sila_notif_vistas_2')).toBeNull();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: NOTIFICACIONES_REPOSITORY, useValue: repo }, { provide: AuthService, useValue: { sesion } }] });
    const otro = TestBed.inject(NotificacionesService);
    otro.refrescar();
    expect(otro.noVistas()).toHaveLength(0);
  });

  it('otro usuario en el mismo navegador NO hereda lo leído del primero', () => {
    const s = TestBed.inject(NotificacionesService);
    s.refrescar();
    s.marcarTodasLeidas();
    sesion.set({ id_usuario: 2 });

    expect(s.noVistas()).toHaveLength(2);
  });

  it('una alerta NUEVA (clave distinta) avisa aunque las anteriores ya estén leídas', () => {
    const s = TestBed.inject(NotificacionesService);
    s.refrescar();
    s.marcarTodasLeidas();
    repo.listar.mockReturnValue(of({ total: 3, criticas: 1, items: [n('a', 'CRITICA'), n('b'), n('c')] }));
    s.refrescar();

    expect(s.noVistas().map((x) => x.clave)).toEqual(['c']);
  });

  it('si el refresco falla conserva la última lista y no lanza nada', () => {
    const s = TestBed.inject(NotificacionesService);
    s.refrescar();
    repo.listar.mockReturnValue(throwError(() => new Error('sin red')));

    expect(() => s.refrescar()).not.toThrow();
    expect(s.items()).toHaveLength(2);
  });

  it('con localStorage dañado no revienta: empieza con todo sin ver', () => {
    localStorage.setItem('sila_notif_vistas_1', '{no es json');
    const s = TestBed.inject(NotificacionesService);
    s.refrescar();
    expect(s.noVistas()).toHaveLength(2);
  });

  it('sin sesión no consulta', () => {
    sesion.set(null);
    TestBed.inject(NotificacionesService).refrescar();
    expect(repo.listar).not.toHaveBeenCalled();
  });
});

describe('Campana y página de notificaciones', () => {
  let repo: { listar: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    repo = { listar: vi.fn(() => of({ total: 2, criticas: 1, items: [n('a', 'CRITICA', { tipo: 'INSUMO_AGOTADO', titulo: 'Azúcar agotada' }), n('b', 'ADVERTENCIA', { tipo: 'CARTERA_POR_VENCER', entidad: 'CLIENTE', id_entidad: 5, titulo: 'Cartera por vencer' })] })) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNgIconLoader(async () => ''),
        { provide: NOTIFICACIONES_REPOSITORY, useValue: repo },
        { provide: AuthService, useValue: { sesion: signal({ id_usuario: 1 }) } },
      ],
    });
  });

  async function estabilizar(f: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 5; i++) {
      f.detectChanges();
      await f.whenStable();
    }
  }
  const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;

  it('la campana muestra el número de no vistas en rojo si alguna es crítica, y se apaga al marcarlas como leídas', async () => {
    const f = TestBed.createComponent(NotificacionesCampanaComponent);
    await estabilizar(f);

    const punto = raiz(f).querySelector('[data-testid=punto-notificaciones]')!;
    expect(punto.textContent?.trim()).toBe('2');
    expect(punto.className).toContain('bg-destructive');

    raiz(f).querySelector<HTMLButtonElement>('button[aria-haspopup]')!.click();
    await estabilizar(f);
    Array.from(raiz(f).querySelectorAll('button')).find((b) => b.textContent?.includes('Marcar todas como leídas'))!.click();
    await estabilizar(f);

    expect(raiz(f).querySelector('[data-testid=punto-notificaciones]')).toBeNull();
    expect(raiz(f).querySelectorAll('app-notificacion-fila').length).toBe(2); // siguen en la lista
  });

  it('solo advertencias sin ver: el punto va en color de aviso, no de error', async () => {
    repo.listar.mockReturnValue(of({ total: 1, criticas: 0, items: [n('x')] }));
    const f = TestBed.createComponent(NotificacionesCampanaComponent);
    await estabilizar(f);

    const clase = raiz(f).querySelector('[data-testid=punto-notificaciones]')!.className;
    expect(clase).toContain('bg-warning');
    expect(clase).not.toContain('bg-destructive');
  });

  it('abrir la campana vuelve a consultar, y tocar una alerta navega a su pantalla y cierra el panel', async () => {
    const f = TestBed.createComponent(NotificacionesCampanaComponent);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await estabilizar(f);
    const antes = repo.listar.mock.calls.length;

    raiz(f).querySelector<HTMLButtonElement>('button[aria-haspopup]')!.click();
    await estabilizar(f);
    expect(repo.listar.mock.calls.length).toBe(antes + 1);

    Array.from(raiz(f).querySelectorAll<HTMLButtonElement>('app-notificacion-fila button')).find((b) => b.textContent?.includes('Cartera por vencer'))!.click();
    await estabilizar(f);

    expect(navegar).toHaveBeenCalledWith(['/cartera'], { queryParams: undefined });
    expect(raiz(f).querySelector('[role=region]')).toBeNull();
  });

  it('sin alertas dice que todo está en orden', async () => {
    repo.listar.mockReturnValue(of({ total: 0, criticas: 0, items: [] }));
    const f = TestBed.createComponent(NotificacionesCampanaComponent);
    await estabilizar(f);
    raiz(f).querySelector<HTMLButtonElement>('button[aria-haspopup]')!.click();
    await estabilizar(f);

    expect(raiz(f).querySelector('[data-testid=sin-notificaciones]')?.textContent).toContain('Todo en orden');
    expect(raiz(f).querySelector('[data-testid=punto-notificaciones]')).toBeNull();
  });

  it('la página agrupa por severidad: críticas arriba, advertencias abajo', async () => {
    const f = TestBed.createComponent(NotificacionesPageComponent);
    await estabilizar(f);

    expect(raiz(f).querySelector('[data-testid=grupo-criticas]')?.textContent).toContain('Azúcar agotada');
    expect(raiz(f).querySelector('[data-testid=grupo-advertencias]')?.textContent).toContain('Cartera por vencer');
    expect(raiz(f).querySelector('[data-testid=grupo-criticas]')?.textContent).not.toContain('Cartera por vencer');
  });
});
