import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import type { AuthResponse } from '../../core/auth/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../layout/services/theme.service';
import { LoginPageComponent } from './login-page.component';

const SESION = { id_usuario: 1, usuario: 'ana.perez', nombre: 'Ana', email: 'a@example.com', rol: 'ADMIN' as const, mfa_activo: true };
const OK: AuthResponse = { estado: 'OK', access_token: 'acceso', expires_in: 900, usuario: SESION };
const error = (code: number, message: string) => throwError(() => ({ code, message }));

/** AuthService falso: cada prueba decide qué responde cada paso. */
function crearAuth() {
  return {
    iniciarSesion: vi.fn(),
    cambiarClave: vi.fn(),
    configurarMfa: vi.fn(),
    activarMfa: vi.fn(),
    verificarMfa: vi.fn(),
    usarCodigoRespaldo: vi.fn(),
    sesion: signal<{ usuario: string } | null>({ usuario: 'ana.perez' }),
  };
}

describe('LoginPageComponent', () => {
  let auth: ReturnType<typeof crearAuth>;
  let router: Router;

  async function crear(consulta: Record<string, string> = {}): Promise<ComponentFixture<LoginPageComponent>> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNgIconLoader(async () => ''),
        { provide: AuthService, useValue: auth },
        { provide: ThemeService, useValue: {} },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(consulta) } } },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LoginPageComponent);
    await estabilizar(fixture);
    return fixture;
  }

  async function estabilizar(fixture: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
  }

  const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
  const titulo = (f: ComponentFixture<unknown>) => raiz(f).querySelector('h1')!.textContent!.trim();
  const alerta = (f: ComponentFixture<unknown>) => raiz(f).querySelector('[role=alert]')?.textContent?.trim();

  async function escribir(f: ComponentFixture<unknown>, selector: string, valor: string): Promise<void> {
    const campo = raiz(f).querySelector<HTMLInputElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    await estabilizar(f);
  }

  async function enviar(f: ComponentFixture<unknown>, formulario = 'form'): Promise<void> {
    raiz(f).querySelector(formulario)!.dispatchEvent(new Event('submit'));
    await estabilizar(f);
  }

  async function ingresar(f: ComponentFixture<unknown>, usuario = 'ana.perez', clave = 'clave-temporal'): Promise<void> {
    await escribir(f, 'input[formcontrolname=usuario]', usuario);
    await escribir(f, 'input[formcontrolname=clave]', clave);
    await enviar(f);
  }

  async function cambiarClave(f: ComponentFixture<unknown>, nueva = 'una-clave-nueva-1'): Promise<void> {
    await escribir(f, 'input[formcontrolname=actual]', 'clave-temporal');
    await escribir(f, 'input[formcontrolname=nueva]', nueva);
    await escribir(f, 'input[formcontrolname=confirmar]', nueva);
    await enviar(f, 'app-cambiar-clave-form form');
  }

  beforeEach(() => {
    auth = crearAuth();
  });

  it('recorre credenciales → cambiar clave → configurar segundo factor → entra', async () => {
    auth.iniciarSesion.mockReturnValue(of({ estado: 'CAMBIAR_CLAVE', token_temporal: 'T1' } satisfies AuthResponse));
    auth.cambiarClave.mockReturnValue(of({ estado: 'MFA_ENROLAR', token_temporal: 'T2' } satisfies AuthResponse));
    auth.configurarMfa.mockReturnValue(of({ secreto: 'ABCDEFGH', otpauth_uri: 'otpauth://totp/SILA:ana?secret=ABCDEFGH' }));
    auth.activarMfa.mockReturnValue(of(OK));
    const f = await crear({ return: '/usuarios' });

    expect(titulo(f)).toBe('Iniciar sesión');
    await ingresar(f, '  Ana.Perez ');
    // El usuario se normaliza (sin espacios, en minúscula) antes de enviarlo.
    expect(auth.iniciarSesion).toHaveBeenCalledExactlyOnceWith('ana.perez', 'clave-temporal');
    expect(titulo(f)).toBe('Cambia tu clave');

    await cambiarClave(f);
    expect(auth.cambiarClave).toHaveBeenCalledExactlyOnceWith('clave-temporal', 'una-clave-nueva-1', 'T1');
    expect(titulo(f)).toBe('Configura el segundo factor');
    // La configuración del QR se pide con el token del paso nuevo.
    expect(auth.configurarMfa).toHaveBeenCalledExactlyOnceWith('T2');
    expect(raiz(f).querySelector('app-mfa-enrolar code')?.textContent).toContain('ABCDEFGH');

    await escribir(f, 'app-mfa-enrolar input', '123456');
    expect(auth.activarMfa).toHaveBeenCalledExactlyOnceWith('123456', 'T2');
    expect(router.navigateByUrl).toHaveBeenCalledExactlyOnceWith('/usuarios');
  });

  it('con segundo factor ya activo pide el código y entra a la URL de retorno', async () => {
    auth.iniciarSesion.mockReturnValue(of({ estado: 'MFA_REQUERIDO', token_temporal: 'T9' } satisfies AuthResponse));
    auth.verificarMfa.mockReturnValue(of(OK));
    const f = await crear({ return: '/catalogos?pestana=clientes' });

    await ingresar(f);
    expect(titulo(f)).toBe('Verificación en dos pasos');
    await escribir(f, 'app-mfa-codigo-form input', '654321');

    expect(auth.verificarMfa).toHaveBeenCalledExactlyOnceWith('654321', 'T9');
    expect(router.navigateByUrl).toHaveBeenCalledExactlyOnceWith('/catalogos?pestana=clientes');
  });

  it('ignora una URL de retorno peligrosa y va al inicio', async () => {
    auth.iniciarSesion.mockReturnValue(of(OK));
    const f = await crear({ return: '//evil.com' });

    await ingresar(f);

    expect(router.navigateByUrl).toHaveBeenCalledExactlyOnceWith('/');
  });

  it('muestra el mensaje del servidor cuando las credenciales son incorrectas (401)', async () => {
    auth.iniciarSesion.mockReturnValue(error(20013, 'Usuario o clave incorrectos.'));
    const f = await crear();

    await ingresar(f);

    expect(alerta(f)).toBe('Usuario o clave incorrectos.');
    expect(titulo(f)).toBe('Iniciar sesión');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  const GENERICO = 'Usuario o clave incorrectos. Si el problema continua, contacte al administrador.';

  it('una cuenta bloqueada responde como una clave incorrecta (401 genérico): se muestra tal cual', async () => {
    auth.iniciarSesion.mockReturnValueOnce(error(20013, GENERICO));
    const f = await crear();

    await ingresar(f);
    expect(alerta(f)).toBe(GENERICO);
  });

  it('el 429 del login se muestra tal cual', async () => {
    auth.iniciarSesion.mockReturnValueOnce(error(20015, 'Demasiados intentos. Espere un minuto.'));
    const f = await crear();

    await ingresar(f);
    expect(alerta(f)).toBe('Demasiados intentos. Espere un minuto.');
  });

  it('si un servidor desactualizado aún respondiera 20014 en el login, la pantalla no agrega nada propio: solo el mensaje que llega', async () => {
    auth.iniciarSesion.mockReturnValueOnce(error(20014, 'Texto del servidor'));
    const f = await crear();

    await ingresar(f);
    expect(alerta(f)).toBe('Texto del servidor');
    expect(raiz(f).textContent).not.toMatch(/Cuenta bloqueada/i);
  });

  it('un código correcto de /mfa/verificar puede traer CAMBIAR_CLAVE: va a cambiar la clave con ese token temporal', async () => {
    auth.iniciarSesion.mockReturnValue(of({ estado: 'MFA_REQUERIDO', token_temporal: 'T9' } satisfies AuthResponse));
    auth.verificarMfa.mockReturnValue(of({ estado: 'CAMBIAR_CLAVE', token_temporal: 'T10' } satisfies AuthResponse));
    auth.cambiarClave.mockReturnValue(of(OK));
    const f = await crear();

    await ingresar(f);
    await escribir(f, 'app-mfa-codigo-form input', '654321');

    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(titulo(f)).toBe('Cambia tu clave');
    await cambiarClave(f);
    expect(auth.cambiarClave).toHaveBeenCalledExactlyOnceWith('clave-temporal', 'una-clave-nueva-1', 'T10');
  });

  it('al activar el segundo factor también puede traer CAMBIAR_CLAVE: usa el código y el token del paso y va a cambiar la clave', async () => {
    auth.iniciarSesion.mockReturnValue(of({ estado: 'MFA_ENROLAR', token_temporal: 'T2' } satisfies AuthResponse));
    auth.configurarMfa.mockReturnValue(of({ secreto: 'ABCDEFGHIJKLMNOP', otpauth_uri: 'otpauth://totp/SILA:x?secret=ABCDEFGHIJKLMNOP' }));
    auth.activarMfa.mockReturnValue(of({ estado: 'CAMBIAR_CLAVE', token_temporal: 'T3' } satisfies AuthResponse));
    auth.cambiarClave.mockReturnValue(of(OK));
    const f = await crear();

    await ingresar(f);
    await escribir(f, 'app-mfa-enrolar input', '123456');

    expect(auth.activarMfa).toHaveBeenCalledExactlyOnceWith('123456', 'T2');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(titulo(f)).toBe('Cambia tu clave');
    await cambiarClave(f);
    expect(auth.cambiarClave).toHaveBeenCalledExactlyOnceWith('clave-temporal', 'una-clave-nueva-1', 'T3');
  });

  it('con un código de respaldo también puede traer CAMBIAR_CLAVE: usa el código y el token del paso y va a cambiar la clave', async () => {
    auth.iniciarSesion.mockReturnValue(of({ estado: 'MFA_REQUERIDO', token_temporal: 'T9' } satisfies AuthResponse));
    auth.usarCodigoRespaldo.mockReturnValue(of({ estado: 'CAMBIAR_CLAVE', token_temporal: 'T11' } satisfies AuthResponse));
    auth.cambiarClave.mockReturnValue(of(OK));
    const f = await crear();

    await ingresar(f);
    Array.from(raiz(f).querySelectorAll('button')).find((b) => b.textContent?.includes('código de respaldo'))!.click();
    await estabilizar(f);
    await escribir(f, 'app-mfa-respaldo-form input', 'ABCDE-12345');
    await enviar(f, 'app-mfa-respaldo-form form');

    expect(auth.usarCodigoRespaldo).toHaveBeenCalledTimes(1);
    expect(auth.usarCodigoRespaldo.mock.calls[0][1]).toBe('T9');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(titulo(f)).toBe('Cambia tu clave');
    await cambiarClave(f);
    expect(auth.cambiarClave).toHaveBeenCalledExactlyOnceWith('clave-temporal', 'una-clave-nueva-1', 'T11');
  });

  it('«Volver» regresa al paso 1 y descarta el token temporal', async () => {
    auth.iniciarSesion.mockReturnValueOnce(of({ estado: 'CAMBIAR_CLAVE', token_temporal: 'T1' } satisfies AuthResponse));
    const f = await crear();
    await ingresar(f);
    expect(titulo(f)).toBe('Cambia tu clave');

    Array.from(raiz(f).querySelectorAll('button')).find((b) => b.textContent?.includes('Volver'))!.click();
    await estabilizar(f);
    expect(titulo(f)).toBe('Iniciar sesión');

    // Un segundo ingreso trae un token nuevo: el viejo (T1) no se reutiliza.
    auth.iniciarSesion.mockReturnValueOnce(of({ estado: 'CAMBIAR_CLAVE', token_temporal: 'T3' } satisfies AuthResponse));
    auth.cambiarClave.mockReturnValue(of(OK));
    await ingresar(f);
    await cambiarClave(f);
    expect(auth.cambiarClave).toHaveBeenCalledExactlyOnceWith('clave-temporal', 'una-clave-nueva-1', 'T3');
  });

  it('si el token temporal venció en un paso, vuelve al paso 1 con un aviso', async () => {
    auth.iniciarSesion.mockReturnValue(of({ estado: 'MFA_REQUERIDO', token_temporal: 'T9' } satisfies AuthResponse));
    auth.verificarMfa.mockReturnValue(error(20013, 'Sesion no valida o vencida. Inicie sesion de nuevo.'));
    const f = await crear();
    await ingresar(f);

    await escribir(f, 'app-mfa-codigo-form input', '111111');

    expect(titulo(f)).toBe('Iniciar sesión');
    expect(raiz(f).querySelector('[role=status]')?.textContent).toContain('venció');
  });

  it('un código incorrecto NO reinicia el flujo: se queda en el paso y muestra el mensaje', async () => {
    auth.iniciarSesion.mockReturnValue(of({ estado: 'MFA_REQUERIDO', token_temporal: 'T9' } satisfies AuthResponse));
    auth.verificarMfa.mockReturnValue(error(20013, 'Codigo incorrecto.'));
    const f = await crear();
    await ingresar(f);

    await escribir(f, 'app-mfa-codigo-form input', '111111');

    expect(titulo(f)).toBe('Verificación en dos pasos');
    expect(alerta(f)).toBe('Codigo incorrecto.');
  });

  it('valida en el cliente la clave nueva (largo y coincidencia) antes de llamar al servidor', async () => {
    auth.iniciarSesion.mockReturnValue(of({ estado: 'CAMBIAR_CLAVE', token_temporal: 'T1' } satisfies AuthResponse));
    const f = await crear();
    await ingresar(f);

    await escribir(f, 'input[formcontrolname=actual]', 'clave-temporal');
    await escribir(f, 'input[formcontrolname=nueva]', 'corta');
    await escribir(f, 'input[formcontrolname=confirmar]', 'otra');
    await enviar(f, 'app-cambiar-clave-form form');

    expect(auth.cambiarClave).not.toHaveBeenCalled();
    const texto = raiz(f).querySelector('app-cambiar-clave-form')!.textContent!;
    expect(texto).toContain('al menos 12 caracteres');
    expect(texto).toContain('Las claves no coinciden.');
  });

  it('muestra el aviso de «clave cambiada» solo para la clave conocida de ?aviso=', async () => {
    const f = await crear({ aviso: 'clave-cambiada' });
    expect(raiz(f).querySelector('[role=status]')?.textContent).toContain('Tu clave se cambió');
    TestBed.resetTestingModule();

    const g = await crear({ aviso: '<b>texto libre</b>' });
    expect(raiz(g).querySelector('[role=status]')).toBeNull();
  });

  describe('código de respaldo (sin teléfono)', () => {
    const enlaceRespaldo = (f: ComponentFixture<unknown>) =>
      Array.from(raiz(f).querySelectorAll('button')).find((b) => b.textContent?.includes('No tengo mi teléfono'));

    async function enPasoCodigo(): Promise<ComponentFixture<LoginPageComponent>> {
      auth.iniciarSesion.mockReturnValue(of({ estado: 'MFA_REQUERIDO', token_temporal: 'T9' } satisfies AuthResponse));
      const f = await crear({ return: '/usuarios' });
      await ingresar(f);
      return f;
    }

    it('debajo del código ofrece «No tengo mi teléfono — usar un código de respaldo» y cambia a un campo de texto', async () => {
      const f = await enPasoCodigo();

      expect(enlaceRespaldo(f)?.textContent).toContain('usar un código de respaldo');
      enlaceRespaldo(f)!.click();
      await estabilizar(f);

      const campo = raiz(f).querySelector<HTMLInputElement>('app-mfa-respaldo-form input')!;
      expect(campo).toBeTruthy();
      expect(campo.getAttribute('autocomplete')).toBe('off');
      expect(raiz(f).querySelector('app-mfa-codigo-form')).toBeNull();
    });

    it('acepta el código en minúscula, con o sin guion y espacios, y llama a la ruta de respaldo con el token temporal', async () => {
      auth.usarCodigoRespaldo.mockReturnValue(of({ ...OK, codigos_restantes: 5 } satisfies AuthResponse));
      const f = await enPasoCodigo();
      enlaceRespaldo(f)!.click();
      await estabilizar(f);

      await escribir(f, 'app-mfa-respaldo-form input', 'abcde fghij');
      expect(raiz(f).querySelector<HTMLInputElement>('app-mfa-respaldo-form input')!.value).toBe('ABCDE FGHIJ');
      await enviar(f, 'app-mfa-respaldo-form form');

      expect(auth.usarCodigoRespaldo).toHaveBeenCalledExactlyOnceWith('ABCDE-FGHIJ', 'T9');
      expect(auth.verificarMfa).not.toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledExactlyOnceWith('/usuarios');
    });

    it.each(['ABCDEFGHIJ', 'abcde-fghij', 'AbCdE fGhIj'])('%s es válido', async (valor) => {
      auth.usarCodigoRespaldo.mockReturnValue(of(OK));
      const f = await enPasoCodigo();
      enlaceRespaldo(f)!.click();
      await estabilizar(f);

      await escribir(f, 'app-mfa-respaldo-form input', valor);
      await enviar(f, 'app-mfa-respaldo-form form');

      expect(auth.usarCodigoRespaldo).toHaveBeenCalledWith('ABCDE-FGHIJ', 'T9');
    });

    it('un formato incorrecto se corrige en el cliente, sin llamar al servidor', async () => {
      const f = await enPasoCodigo();
      enlaceRespaldo(f)!.click();
      await estabilizar(f);

      await escribir(f, 'app-mfa-respaldo-form input', 'abc');
      await enviar(f, 'app-mfa-respaldo-form form');

      expect(auth.usarCodigoRespaldo).not.toHaveBeenCalled();
      expect(raiz(f).querySelector('app-mfa-respaldo-form')!.textContent).toContain('10 caracteres');
    });

    it('un código incorrecto o ya usado muestra el mensaje del servidor y se queda en el paso', async () => {
      auth.usarCodigoRespaldo.mockReturnValue(error(20013, 'Codigo de respaldo incorrecto o ya usado.'));
      const f = await enPasoCodigo();
      enlaceRespaldo(f)!.click();
      await estabilizar(f);

      await escribir(f, 'app-mfa-respaldo-form input', 'ABCDE-FGHIJ');
      await enviar(f, 'app-mfa-respaldo-form form');

      expect(alerta(f)).toBe('Codigo de respaldo incorrecto o ya usado.');
      expect(titulo(f)).toBe('Verificación en dos pasos');
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('el bloqueo (423) por intentos fallidos se muestra tal cual', async () => {
      auth.usarCodigoRespaldo.mockReturnValue(error(20014, 'Cuenta bloqueada temporalmente. Intente de nuevo en 15 minutos.'));
      const f = await enPasoCodigo();
      enlaceRespaldo(f)!.click();
      await estabilizar(f);

      await escribir(f, 'app-mfa-respaldo-form input', 'ABCDE-FGHIJ');
      await enviar(f, 'app-mfa-respaldo-form form');

      expect(alerta(f)).toContain('Cuenta bloqueada');
    });

    it('se puede volver al código de la aplicación', async () => {
      const f = await enPasoCodigo();
      enlaceRespaldo(f)!.click();
      await estabilizar(f);

      Array.from(raiz(f).querySelectorAll('button')).find((b) => b.textContent?.includes('Usar el código de la aplicación'))!.click();
      await estabilizar(f);

      expect(raiz(f).querySelector('app-mfa-codigo-form')).toBeTruthy();
      expect(raiz(f).querySelector('app-mfa-respaldo-form')).toBeNull();
    });
  });

  describe('«Guarda tus códigos de respaldo» (al activar el segundo factor)', () => {
    const CODIGOS = ['AAAAA-11111', 'BBBBB-22222', 'CCCCC-33333', 'DDDDD-44444', 'EEEEE-55555', 'FFFFF-66666', 'GGGGG-77777', 'HHHHH-88888', 'JJJJJ-99999', 'KKKKK-23456'];

    async function hastaActivar(): Promise<ComponentFixture<LoginPageComponent>> {
      auth.iniciarSesion.mockReturnValue(of({ estado: 'MFA_ENROLAR', token_temporal: 'T2' } satisfies AuthResponse));
      auth.configurarMfa.mockReturnValue(of({ secreto: 'ABCDEFGH', otpauth_uri: 'otpauth://totp/SILA:ana?secret=ABCDEFGH' }));
      auth.activarMfa.mockReturnValue(of({ ...OK, codigos_respaldo: CODIGOS } satisfies AuthResponse));
      const f = await crear({ return: '/usuarios' });
      await ingresar(f);
      await escribir(f, 'app-mfa-enrolar input', '123456');
      return f;
    }

    it('al activar NO entra a la app: muestra los 10 códigos y espera a que la persona confirme', async () => {
      const f = await hastaActivar();

      expect(router.navigateByUrl).not.toHaveBeenCalled();
      expect(raiz(f).querySelector('app-codigos-respaldo')).toBeTruthy();
      expect(raiz(f).querySelectorAll('app-codigos-respaldo li').length).toBe(10);
      expect(raiz(f).querySelector('app-codigos-respaldo')!.textContent).toContain('AAAAA-11111');
      // Ya no se ofrece «Volver»: la persona está autenticada y volver no desharía nada.
      expect(Array.from(raiz(f).querySelectorAll('button')).some((b) => b.textContent?.includes('Volver'))).toBe(false);
    });

    it('«Continuar» sigue bloqueado hasta marcar «Ya los guardé»; entonces entra y los códigos desaparecen de la página', async () => {
      const f = await hastaActivar();
      const continuar = Array.from(raiz(f).querySelectorAll('app-codigos-respaldo button')).find((b) => b.textContent?.includes('Continuar')) as HTMLButtonElement;

      expect(continuar.disabled).toBe(true);
      continuar.click();
      expect(router.navigateByUrl).not.toHaveBeenCalled();

      const casilla = raiz(f).querySelector<HTMLInputElement>('app-codigos-respaldo input[type=checkbox]')!;
      casilla.checked = true;
      casilla.dispatchEvent(new Event('change'));
      await estabilizar(f);
      expect(continuar.disabled).toBe(false);
      continuar.click();
      await estabilizar(f);

      expect(router.navigateByUrl).toHaveBeenCalledExactlyOnceWith('/usuarios');
      expect(raiz(f).textContent).not.toContain('AAAAA-11111');
    });

    it('los códigos no van a ningún almacenamiento', async () => {
      const escritura = vi.spyOn(Storage.prototype, 'setItem');
      await hastaActivar();

      expect(escritura).not.toHaveBeenCalled();
      expect(localStorage.length + sessionStorage.length).toBe(0);
    });
  });
});

