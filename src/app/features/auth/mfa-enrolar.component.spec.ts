import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import type { MfaConfig } from '../../core/auth/auth.models';
import { MfaEnrolarComponent } from './mfa-enrolar.component';

const CONFIG: MfaConfig = { secreto: 'JBSWY3DPEHPK3PXP', otpauth_uri: 'otpauth://totp/SILA:ana?secret=JBSWY3DPEHPK3PXP&issuer=SILA' };

describe('MfaEnrolarComponent', () => {
  async function crear(config: MfaConfig | null): Promise<ComponentFixture<MfaEnrolarComponent>> {
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => '')] });
    const fixture = TestBed.createComponent(MfaEnrolarComponent);
    fixture.componentRef.setInput('config', config);
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 20));
    }
    return fixture;
  }

  it('dibuja el QR como imagen PNG (data URL) y muestra la clave escrita como alternativa', async () => {
    const fixture = await crear(CONFIG);
    const raiz = fixture.nativeElement as HTMLElement;

    const imagen = raiz.querySelector('img');
    expect(imagen?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(imagen?.getAttribute('alt')).toContain('Código QR');
    expect(raiz.querySelector('code')?.textContent).toContain('JBSWY3DPEHPK3PXP');
  });

  it('mientras no llega la configuración muestra «Preparando…» y no dibuja nada', async () => {
    const fixture = await crear(null);
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('img')).toBeNull();
    expect(raiz.textContent).toContain('Preparando el código QR');
  });

  it('emite el código de 6 dígitos que escribe la persona', async () => {
    const fixture = await crear(CONFIG);
    const codigos: string[] = [];
    fixture.componentInstance.activar.subscribe((c) => codigos.push(c));

    const campo = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('app-mfa-codigo-form input')!;
    campo.value = '12a3456';
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    // Se quedan solo los dígitos y se envía al completar el sexto.
    expect(codigos).toEqual(['123456']);
  });
});
