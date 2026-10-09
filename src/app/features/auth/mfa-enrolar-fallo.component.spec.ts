import { TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { MfaEnrolarComponent } from './mfa-enrolar.component';

// La librería del QR falla: la pantalla no debe quedarse en «Generando…» para siempre.
vi.mock('qrcode', () => ({ toDataURL: () => Promise.reject(new Error('sin canvas')) }));

describe('MfaEnrolarComponent · falla la librería del QR', () => {
  it('avisa y deja abierta la clave para escribirla a mano', async () => {
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => '')] });
    const fixture = TestBed.createComponent(MfaEnrolarComponent);
    fixture.componentRef.setInput('config', { secreto: 'JBSWY3DPEHPK3PXP', otpauth_uri: 'otpauth://totp/SILA:ana?secret=JBSWY3DPEHPK3PXP' });
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 20));
    }
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('img')).toBeNull();
    expect(raiz.querySelector('[role=alert]')?.textContent).toContain('No se pudo generar el código QR');
    expect(raiz.querySelector('details')?.hasAttribute('open')).toBe(true);
    expect(raiz.querySelector('code')?.textContent).toContain('JBSWY3DPEHPK3PXP');
  });
});
