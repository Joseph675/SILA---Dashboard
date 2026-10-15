import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import type { AuthResponse } from '../../core/auth/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { PasskeyError, PasskeyService } from '../../core/services/passkey.service';
import { ThemeService } from '../../layout/services/theme.service';
import { LoginPageComponent } from './login-page.component';

const SESION = { id_usuario: 1, usuario: 'ana.perez', nombre: 'Ana', email: 'a@example.com', rol: 'ADMIN' as const, mfa_activo: true };
const OK: AuthResponse = { estado: 'OK', access_token: 'acceso', expires_in: 900, usuario: SESION };
const OPCIONES = { publicKey: { challenge: 'AQID', rpId: 'localhost', userVerification: 'required' as const } };
const CREDENCIAL = { id: 'cred', rawId: 'AQ', type: 'public-key', response: { clientDataJSON: 'AA', authenticatorData: 'AA', signature: 'AA' }, clientExtensionResults: {} };
const error = (code: number, message: string) => throwError(() => ({ code, message }));
const mfa = (passkey?: boolean): AuthResponse => ({ estado: 'MFA_REQUERIDO', token_temporal: 'T9', ...(passkey === undefined ? {} : { passkey_disponible: passkey }) });

describe('Login · Face ID / huella', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let auth: Record<string, any>;
  let passkey: { soportado: ReturnType<typeof vi.fn>; obtener: ReturnType<typeof vi.fn> };
  let router: Router;

  async function estabilizar(f: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 6; i++) {
      f.detectChanges();
      await f.whenStable();
      await new Promise((r) => setTimeout(r));
    }
    f.detectChanges();
  }
  const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
  const q = (f: ComponentFixture<unknown>, sel: string) => raiz(f).querySelector<HTMLElement>(sel);
  const texto = (f: ComponentFixture<unknown>, sel: string) => (q(f, sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const clic = async (f: ComponentFixture<unknown>, sel: string) => {
    q(f, sel)!.click();
    await estabilizar(f);
  };

  /** Opens the login and gets to the second-factor step with what the server says about passkeys. */
  async function hastaElSegundoFactor(respuesta: AuthResponse, soportado = true): Promise<ComponentFixture<LoginPageComponent>> {
    passkey.soportado.mockResolvedValue(soportado);
    auth['iniciarSesion'].mockReturnValue(of(respuesta));
    const f = TestBed.createComponent(LoginPageComponent);
    await estabilizar(f);
    for (const [campo, valor] of [['usuario', 'ana.perez'], ['clave', 'una-clave']]) {
      const input = q(f, `input[formcontrolname=${campo}]`) as HTMLInputElement;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
    }
    q(f, 'form')!.dispatchEvent(new Event('submit'));
    await estabilizar(f);
    return f;
  }

  beforeEach(() => {
    auth = {
      iniciarSesion: vi.fn(),
      cambiarClave: vi.fn(),
      configurarMfa: vi.fn(),
      activarMfa: vi.fn(),
      verificarMfa: vi.fn(),
      usarCodigoRespaldo: vi.fn(),
      opcionesPasskeyLogin: vi.fn(() => of(OPCIONES)),
      verificarPasskey: vi.fn(() => of(OK)),
      sesion: signal({ usuario: 'ana.perez' }),
    };
    passkey = { soportado: vi.fn(), obtener: vi.fn(() => Promise.resolve(CREDENCIAL)) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNgIconLoader(async () => ''),
        { provide: AuthService, useValue: auth },
        { provide: PasskeyService, useValue: passkey },
        { provide: ThemeService, useValue: {} },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ return: '/tablero' }) } } },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  describe('qué se ofrece', () => {
    it('passkey_disponible: true y navegador compatible → PRIMERO el botón grande, y debajo los dos códigos', async () => {
      const f = await hastaElSegundoFactor(mfa(true));

      expect(texto(f, '[data-testid=entrar-passkey]')).toBe('Entrar con Face ID / huella');
      expect(texto(f, '[data-testid=usar-codigo-app]')).toBe('Usar código de la app');
      expect(texto(f, '[data-testid=usar-codigo-respaldo]')).toBe('Usar código de respaldo');
      expect(q(f, 'app-mfa-codigo-form')).toBeNull();
      // El botón va antes que las alternativas.
      const orden = Array.from(raiz(f).querySelectorAll('[data-testid]')).map((n) => n.getAttribute('data-testid'));
      expect(orden.indexOf('entrar-passkey')).toBeLessThan(orden.indexOf('usar-codigo-app'));
      expect(passkey.obtener).not.toHaveBeenCalled();
    });

    it('passkey_disponible: false → el formulario del código de siempre, sin botón', async () => {
      const f = await hastaElSegundoFactor(mfa(false));

      expect(q(f, '[data-testid=entrar-passkey]')).toBeNull();
      expect(q(f, 'app-mfa-codigo-form')).toBeTruthy();
      expect(q(f, '[data-testid=volver-passkey]')).toBeNull();
    });

    it('sin el campo passkey_disponible (servidor anterior) → el código de siempre', async () => {
      const f = await hastaElSegundoFactor(mfa());
      expect(q(f, '[data-testid=entrar-passkey]')).toBeNull();
      expect(q(f, 'app-mfa-codigo-form')).toBeTruthy();
    });

    it('passkey_disponible: true pero este navegador no lo soporta → el código de siempre', async () => {
      const f = await hastaElSegundoFactor(mfa(true), false);

      expect(q(f, '[data-testid=entrar-passkey]')).toBeNull();
      expect(q(f, 'app-mfa-codigo-form')).toBeTruthy();
    });

    it('«Usar código de la app» y «Usar código de respaldo» llevan a sus formularios, y se puede volver al botón', async () => {
      const f = await hastaElSegundoFactor(mfa(true));

      await clic(f, '[data-testid=usar-codigo-app]');
      expect(q(f, 'app-mfa-codigo-form')).toBeTruthy();
      await clic(f, '[data-testid=volver-passkey]');
      expect(q(f, '[data-testid=entrar-passkey]')).toBeTruthy();

      await clic(f, '[data-testid=usar-codigo-respaldo]');
      expect(q(f, 'app-mfa-respaldo-form')).toBeTruthy();
    });
  });

  describe('entrar con Face ID / huella', () => {
    it('pide opciones con el token temporal, firma con el dispositivo, verifica y entra', async () => {
      const f = await hastaElSegundoFactor(mfa(true));
      await clic(f, '[data-testid=entrar-passkey]');

      expect(auth['opcionesPasskeyLogin']).toHaveBeenCalledExactlyOnceWith('T9');
      expect(passkey.obtener).toHaveBeenCalledExactlyOnceWith(OPCIONES);
      expect(auth['verificarPasskey']).toHaveBeenCalledExactlyOnceWith(CREDENCIAL, 'T9');
      expect(router.navigateByUrl).toHaveBeenCalledExactlyOnceWith('/tablero');
    });

    it('si la persona cancela el diálogo del sistema: aviso suave (no rojo), no se verifica nada y puede reintentar', async () => {
      passkey.obtener.mockResolvedValueOnce(null);
      const f = await hastaElSegundoFactor(mfa(true));
      await clic(f, '[data-testid=entrar-passkey]');

      expect(texto(f, '[data-testid=aviso-passkey]')).toContain('Cancelaste');
      expect(q(f, '[role=alert]')).toBeNull();
      expect(auth['verificarPasskey']).not.toHaveBeenCalled();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
      expect(texto(f, '[data-testid=entrar-passkey]')).toContain('Intentar de nuevo');

      await clic(f, '[data-testid=entrar-passkey]');
      expect(router.navigateByUrl).toHaveBeenCalledOnce();
    });

    it('401 (no se pudo verificar): muestra el mensaje del servidor y deja intentar otra vez', async () => {
      auth['verificarPasskey'].mockReturnValueOnce(error(20013, 'No se pudo verificar la llave.'));
      const f = await hastaElSegundoFactor(mfa(true));
      await clic(f, '[data-testid=entrar-passkey]');

      expect(texto(f, '[role=alert]')).toBe('No se pudo verificar la llave.');
      expect(router.navigateByUrl).not.toHaveBeenCalled();
      expect(texto(f, '[data-testid=entrar-passkey]')).toContain('Intentar de nuevo');
    });

    it('409 (el desafío venció): el siguiente intento pide opciones NUEVAS y entra', async () => {
      auth['verificarPasskey'].mockReturnValueOnce(error(20006, 'El desafío venció o ya se usó. Inténtalo de nuevo.'));
      const f = await hastaElSegundoFactor(mfa(true));

      await clic(f, '[data-testid=entrar-passkey]');
      expect(texto(f, '[role=alert]')).toContain('venció');
      expect(auth['opcionesPasskeyLogin']).toHaveBeenCalledTimes(1);

      await clic(f, '[data-testid=entrar-passkey]');
      expect(auth['opcionesPasskeyLogin']).toHaveBeenCalledTimes(2);
      expect(router.navigateByUrl).toHaveBeenCalledExactlyOnceWith('/tablero');
    });

    it('409 al pedir las opciones (ya no tiene llaves): muestra el mensaje y quedan los códigos', async () => {
      auth['opcionesPasskeyLogin'].mockReturnValueOnce(error(20006, 'No tienes dispositivos registrados.'));
      const f = await hastaElSegundoFactor(mfa(true));
      await clic(f, '[data-testid=entrar-passkey]');

      expect(texto(f, '[role=alert]')).toBe('No tienes dispositivos registrados.');
      expect(passkey.obtener).not.toHaveBeenCalled();
      expect(q(f, '[data-testid=usar-codigo-app]')).toBeTruthy();
    });

    it('423 (cuenta bloqueada): muestra el mensaje del servidor tal cual', async () => {
      auth['verificarPasskey'].mockReturnValueOnce(error(20014, 'Cuenta bloqueada por intentos fallidos. Intenta de nuevo en 15 minutos.'));
      const f = await hastaElSegundoFactor(mfa(true));
      await clic(f, '[data-testid=entrar-passkey]');

      expect(texto(f, '[role=alert]')).toBe('Cuenta bloqueada por intentos fallidos. Intenta de nuevo en 15 minutos.');
    });

    it('un fallo del dispositivo (PasskeyError) se muestra con su mensaje y no sale del paso', async () => {
      passkey.obtener.mockRejectedValueOnce(new PasskeyError('Face ID / huella solo funciona en la dirección web oficial de SILA, por una conexión segura (https).'));
      const f = await hastaElSegundoFactor(mfa(true));
      await clic(f, '[data-testid=entrar-passkey]');

      expect(texto(f, '[role=alert]')).toContain('dirección web oficial');
      expect(auth['verificarPasskey']).not.toHaveBeenCalled();
    });

    it('si el intento de inicio de sesión venció (token temporal), empieza de nuevo con un aviso', async () => {
      auth['opcionesPasskeyLogin'].mockReturnValueOnce(error(20013, 'Sesion no valida o vencida.'));
      const f = await hastaElSegundoFactor(mfa(true));
      await clic(f, '[data-testid=entrar-passkey]');

      expect(q(f, 'input[formcontrolname=usuario]')).toBeTruthy();
      expect(texto(f, '[role=status]')).toContain('venció');
    });
  });
});
