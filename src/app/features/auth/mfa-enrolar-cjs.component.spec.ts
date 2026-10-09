import { TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { MfaEnrolarComponent } from './mfa-enrolar.component';

// El build de producción expone `qrcode` (CommonJS) SOLO bajo `default`: sin esa rama el QR no se dibuja.
vi.mock('qrcode', () => ({ default: { toDataURL: () => Promise.resolve('data:image/png;base64,AAAA') } }));

describe('MfaEnrolarComponent · qrcode expuesto solo como default (build de producción)', () => {
  it('dibuja el QR igual', async () => {
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => '')] });
    const fixture = TestBed.createComponent(MfaEnrolarComponent);
    fixture.componentRef.setInput('config', { secreto: 'JBSWY3DPEHPK3PXP', otpauth_uri: 'otpauth://totp/SILA:ana?secret=JBSWY3DPEHPK3PXP' });
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 20));
    }
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    expect(raiz.querySelector('[role=alert]')).toBeNull();
  });
});
