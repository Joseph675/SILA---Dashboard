import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { AuthService } from '../../core/services/auth.service';
import { AvisoRespaldoComponent } from './aviso-respaldo.component';

describe('AvisoRespaldoComponent', () => {
  let auth: AuthService;

  async function pintar(restantes: number | null) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNgIconLoader(async () => '')] });
    auth = TestBed.inject(AuthService);
    auth.codigosRestantes.set(restantes);
    const fixture = TestBed.createComponent(AvisoRespaldoComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  const alerta = (f: { nativeElement: HTMLElement }) => f.nativeElement.querySelector('[role=alert]');

  it.each([
    [2, 'Te quedan 2 códigos de respaldo.'],
    [1, 'Te quedan 1 código de respaldo.'],
  ])('con %i código(s) restante(s) avisa y ofrece generar nuevos', async (n, texto) => {
    const f = await pintar(n);

    expect(alerta(f)?.textContent).toContain(texto);
    expect(alerta(f)?.textContent).toContain('Genera nuevos en Mi cuenta');
    expect(alerta(f)?.querySelector('a')?.getAttribute('href')).toBe('/cuenta');
    expect(alerta(f)?.className).toContain('border-warning');
  });

  it('con 0 el aviso es crítico', async () => {
    const f = await pintar(0);

    expect(alerta(f)?.textContent).toContain('Ya no te quedan códigos de respaldo');
    expect(alerta(f)?.className).toContain('border-destructive');
  });

  it.each([3, 9, 10, null])('con %s no avisa', async (n) => {
    const f = await pintar(n);

    expect(alerta(f)).toBeNull();
  });

  it('se puede descartar', async () => {
    const f = await pintar(1);

    (alerta(f)!.querySelector('button') as HTMLButtonElement).click();
    f.detectChanges();

    expect(auth.codigosRestantes()).toBeNull();
    expect(alerta(f)).toBeNull();
  });
});
