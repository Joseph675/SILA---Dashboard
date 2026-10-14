import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SidebarStateService } from './sidebar-state.service';

@Component({ template: '' })
class Vacia {}

describe('SidebarStateService · cajón del menú en móvil', () => {
  let servicio: SidebarStateService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'a', component: Vacia }, { path: 'b', component: Vacia }])] });
    servicio = TestBed.inject(SidebarStateService);
    router = TestBed.inject(Router);
  });

  afterEach(() => document.body.classList.remove('sila-sin-scroll'));

  async function estabilizar(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
  }

  it('abre y bloquea el scroll de la página de atrás mientras está abierto', async () => {
    expect(servicio.mobileOpen()).toBe(false);

    servicio.openMobile();
    await estabilizar();
    expect(servicio.mobileOpen()).toBe(true);
    expect(document.body.classList.contains('sila-sin-scroll')).toBe(true);

    servicio.closeMobile();
    await estabilizar();
    expect(document.body.classList.contains('sila-sin-scroll')).toBe(false);
  });

  it('se cierra solo al navegar a otra ruta', async () => {
    await router.navigateByUrl('/a');
    servicio.openMobile();

    await router.navigateByUrl('/b');

    expect(servicio.mobileOpen()).toBe(false);
  });

  it('se cierra con la tecla Escape y otras teclas no lo cierran', () => {
    servicio.openMobile();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(servicio.mobileOpen()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(servicio.mobileOpen()).toBe(false);
  });

  it('se cierra si la pantalla crece al tamaño de escritorio (p. ej. al rotar una tableta)', () => {
    servicio.openMobile();
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280);

    window.dispatchEvent(new Event('resize'));

    expect(servicio.mobileOpen()).toBe(false);
  });
});
