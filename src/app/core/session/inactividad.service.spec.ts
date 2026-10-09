import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CanalSesion, MensajeCanal } from './canal-sesion.service';
import { AVISO_MS, INACTIVIDAD_MS } from './inactividad.config';
import { InactividadService } from './inactividad.service';
import { SincronizacionPestanas } from './sincronizacion-pestanas.service';

const MIN = 60 * 1000;
const SESION = { id_usuario: 1, usuario: 'ana', nombre: 'Ana', email: 'a@example.com', rol: 'ADMIN' as const, mfa_activo: true };

/** Another tab on the same channel: what one sends, the others hear. */
class CanalFalso {
  enviados: MensajeCanal[] = [];
  private oyentes = new Set<(m: MensajeCanal) => void>();
  enviar(m: MensajeCanal) {
    this.enviados.push(m);
  }
  escuchar(oyente: (m: MensajeCanal) => void) {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }
  /** What the OTHER tab says. */
  recibir(m: MensajeCanal) {
    this.oyentes.forEach((o) => o(m));
  }
}

describe('InactividadService', () => {
  let servicio: InactividadService;
  let auth: AuthService;
  let canal: CanalFalso;
  let router: Router;
  let cerrarSesion: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    canal = new CanalFalso();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: CanalSesion, useValue: canal }],
    });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    cerrarSesion = vi.spyOn(auth, 'cerrarSesion').mockImplementation(() => of(undefined));
    servicio = TestBed.inject(InactividadService);
    // Signed in: the idle timer starts.
    auth.sesion.set(SESION);
    TestBed.tick();
  });

  afterEach(() => {
    auth.sesion.set(null);
    TestBed.tick();
    vi.useRealTimers();
  });

  it('las constantes son 30 minutos y 2 minutos (configurables en un solo sitio)', () => {
    expect(INACTIVIDAD_MS).toBe(30 * MIN);
    expect(AVISO_MS).toBe(2 * MIN);
  });

  it('no avisa antes de tiempo y avisa 2 minutos antes de cerrar, con la cuenta regresiva', () => {
    vi.advanceTimersByTime(27 * MIN + 50_000);
    expect(servicio.avisoVisible()).toBe(false);

    vi.advanceTimersByTime(15_000);
    expect(servicio.avisoVisible()).toBe(true);
    expect(servicio.restanteMs()).toBeLessThanOrEqual(2 * MIN);
    expect(servicio.restanteMs()).toBeGreaterThan(MIN + 40_000);

    vi.advanceTimersByTime(30_000);
    expect(servicio.restanteMs()).toBeLessThan(MIN + 40_000);
    expect(cerrarSesion).not.toHaveBeenCalled();
  });

  it('a los 30 minutos cierra la sesión por inactividad y va a /login con el aviso', () => {
    vi.advanceTimersByTime(30 * MIN + 1000);

    expect(cerrarSesion).toHaveBeenCalledExactlyOnceWith('inactividad');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { aviso: 'inactividad' } });
    expect(servicio.avisoVisible()).toBe(false);
  });

  it('«Seguir conectado» cierra el aviso y reinicia la cuenta completa', () => {
    vi.advanceTimersByTime(29 * MIN);
    expect(servicio.avisoVisible()).toBe(true);

    servicio.seguirConectado();
    expect(servicio.avisoVisible()).toBe(false);

    vi.advanceTimersByTime(27 * MIN + 50_000);
    expect(servicio.avisoVisible()).toBe(false);
    expect(cerrarSesion).not.toHaveBeenCalled();

    vi.advanceTimersByTime(20_000);
    expect(servicio.avisoVisible()).toBe(true);
  });

  it('«Seguir conectado» cuenta como actividad para las demás pestañas', () => {
    vi.advanceTimersByTime(29 * MIN);
    canal.enviados.length = 0;

    servicio.seguirConectado();

    expect(canal.enviados).toEqual([{ tipo: 'actividad', t: Date.now() }]);
  });

  it('el movimiento del ratón antes del aviso reinicia el tiempo', () => {
    vi.advanceTimersByTime(20 * MIN);
    document.dispatchEvent(new MouseEvent('mousemove'));
    vi.advanceTimersByTime(20 * MIN);

    expect(servicio.avisoVisible()).toBe(false);
    expect(cerrarSesion).not.toHaveBeenCalled();
  });

  it('con el aviso abierto, el movimiento del ratón NO lo oculta: solo su botón', () => {
    vi.advanceTimersByTime(28 * MIN + 10_000);
    expect(servicio.avisoVisible()).toBe(true);

    document.dispatchEvent(new MouseEvent('mousemove'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    vi.advanceTimersByTime(5000);

    expect(servicio.avisoVisible()).toBe(true);
  });

  it('la actividad en OTRA pestaña también cuenta (llega por el canal)', () => {
    vi.advanceTimersByTime(25 * MIN);
    canal.recibir({ tipo: 'actividad', t: Date.now() });
    vi.advanceTimersByTime(20 * MIN);

    expect(servicio.avisoVisible()).toBe(false);
    expect(cerrarSesion).not.toHaveBeenCalled();
  });

  it('si otra pestaña muestra actividad mientras esta avisaba, el aviso se quita', () => {
    vi.advanceTimersByTime(29 * MIN);
    expect(servicio.avisoVisible()).toBe(true);

    canal.recibir({ tipo: 'actividad', t: Date.now() });
    vi.advanceTimersByTime(2000);

    expect(servicio.avisoVisible()).toBe(false);
  });

  it('avisa a las otras pestañas de la actividad, pero no en cada movimiento (máximo cada 5 s)', () => {
    canal.enviados.length = 0;
    vi.advanceTimersByTime(6000);
    for (let i = 0; i < 50; i++) document.dispatchEvent(new MouseEvent('mousemove'));

    expect(canal.enviados.length).toBe(1);
    expect(canal.enviados[0].tipo).toBe('actividad');
  });

  it('usa marcas de tiempo: si el navegador durmió la pestaña, al volver ve cuánto pasó de verdad', () => {
    // Sin que corra ningún temporizador, el reloj salta 31 minutos (equipo suspendido).
    vi.setSystemTime(Date.now() + 31 * MIN);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(cerrarSesion).toHaveBeenCalledExactlyOnceWith('inactividad');
  });

  it('«Cerrar sesión» del aviso cierra sin el motivo de inactividad', () => {
    vi.advanceTimersByTime(29 * MIN);

    servicio.cerrarAhora();

    expect(cerrarSesion).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {});
  });

  it('se detiene al cerrar la sesión: sin sesión no hay temporizador ni avisos', () => {
    vi.advanceTimersByTime(29 * MIN);
    expect(servicio.avisoVisible()).toBe(true);

    auth.sesion.set(null);
    TestBed.tick();
    expect(servicio.avisoVisible()).toBe(false);

    vi.advanceTimersByTime(60 * MIN);
    expect(cerrarSesion).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('SincronizacionPestanas · varias pestañas', () => {
  let auth: AuthService;
  let canal: CanalFalso;
  let router: Router;

  beforeEach(() => {
    canal = new CanalFalso();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: CanalSesion, useValue: canal }],
    });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    TestBed.inject(SincronizacionPestanas);
    auth.sesion.set(SESION);
  });

  it('el mensaje «logout» de otra pestaña cierra la sesión de esta y va al login', () => {
    canal.recibir({ tipo: 'logout' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.token).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { aviso: 'otra-pestana' } });
  });

  it('si el cierre fue por inactividad, el aviso lo dice', () => {
    canal.recibir({ tipo: 'logout', motivo: 'inactividad' });

    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { aviso: 'inactividad' } });
  });

  it('sin sesión no hace nada (no navega ni repite avisos)', () => {
    auth.sesion.set(null);

    canal.recibir({ tipo: 'logout' });

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('cerrar sesión aquí manda «logout» a las demás, sin datos sensibles', () => {
    auth.cerrarSesion().subscribe();
    TestBed.inject(HttpTestingControllerAlias).expectOne((r) => r.url.endsWith('/auth/logout')).flush(null, { status: 204, statusText: 'No Content' });

    expect(canal.enviados).toEqual([{ tipo: 'logout' }]);
    expect(JSON.stringify(canal.enviados)).not.toMatch(/token|clave|usuario/i);
  });
});

import { HttpTestingController as HttpTestingControllerAlias } from '@angular/common/http/testing';
