import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { CuentaPageComponent } from './cuenta-page.component';

const ANA = { id_usuario: 1, usuario: 'ana', nombre: 'Ana Pérez', email: 'ana@example.com', rol: 'OPERATIVO' as const, mfa_activo: true };

describe('Mi cuenta · acciones que piden el código MFA', () => {
  let auth: Record<string, ReturnType<typeof vi.fn> | ReturnType<typeof signal>>;

  beforeAll(() => {
    const d = HTMLDialogElement.prototype;
    d.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    d.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });

  async function crear(): Promise<ComponentFixture<CuentaPageComponent>> {
    auth = {
      sesion: signal({ ...ANA }),
      codigosRestantes: signal<number | null>(null),
      respaldoEstado: vi.fn(() => of({ restantes: 5 })),
      misSesiones: vi.fn(() => of([])),
      actualizarPerfil: vi.fn(),
      cambiarClave: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideNgIconLoader(async () => ''), { provide: AuthService, useValue: auth }] });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const f = TestBed.createComponent(CuentaPageComponent);
    await estabilizar(f);
    return f;
  }
  async function estabilizar(f: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 5; i++) {
      f.detectChanges();
      await f.whenStable();
    }
  }
  const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
  async function escribir(f: ComponentFixture<unknown>, selector: string, valor: string): Promise<void> {
    const el = raiz(f).querySelector<HTMLInputElement>(selector)!;
    el.value = valor;
    el.dispatchEvent(new Event('input'));
    await estabilizar(f);
  }
  const formDatos = (f: ComponentFixture<unknown>) => raiz(f).querySelector('section[aria-labelledby=cuenta-datos] form')!;

  async function abrirEdicion(f: ComponentFixture<unknown>): Promise<void> {
    Array.from(raiz(f).querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Editar')!.click();
    await estabilizar(f);
  }
  async function enviarDatos(f: ComponentFixture<unknown>, codigo = '123456'): Promise<void> {
    await escribir(f, 'section[aria-labelledby=cuenta-datos] [formcontrolname=nombre]', 'Ana María Pérez');
    await escribir(f, 'section[aria-labelledby=cuenta-datos] [formcontrolname=email]', 'ana.nueva@example.com');
    await escribir(f, 'section[aria-labelledby=cuenta-datos] input[id^=codigo-mfa-]', codigo);
    formDatos(f).dispatchEvent(new Event('submit'));
    await estabilizar(f);
  }

  it('editar datos: envía nombre, correo y código, actualiza la sesión y avisa', async () => {
    const f = await crear();
    (auth['actualizarPerfil'] as ReturnType<typeof vi.fn>).mockReturnValue(of({ ...ANA, nombre: 'Ana María Pérez', email: 'ana.nueva@example.com' }));
    const exito = vi.spyOn(TestBed.inject(ToastService), 'exito');
    await abrirEdicion(f);

    await enviarDatos(f);

    expect(auth['actualizarPerfil']).toHaveBeenCalledExactlyOnceWith({ nombre: 'Ana María Pérez', email: 'ana.nueva@example.com', codigo: '123456' });
    expect(exito).toHaveBeenCalledTimes(1);
    expect(formDatos(f)).toBeNull();
  });

  it('editar datos: sin el código de 6 dígitos no se envía nada', async () => {
    const f = await crear();
    await abrirEdicion(f);
    await enviarDatos(f, '12');

    expect(auth['actualizarPerfil']).not.toHaveBeenCalled();
    expect(raiz(f).textContent).toContain('Son 6 dígitos');
  });

  it('código incorrecto: error en el campo del código y lo limpia', async () => {
    const f = await crear();
    (auth['actualizarPerfil'] as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => ({ code: 20013, message: 'Codigo incorrecto' })));
    await abrirEdicion(f);

    await enviarDatos(f);

    expect(raiz(f).querySelector<HTMLInputElement>('section[aria-labelledby=cuenta-datos] input[id^=codigo-mfa-]')!.value).toBe('');
    expect(formDatos(f).textContent).toContain('El código es incorrecto');
  });

  it('código ya usado: pide esperar unos segundos', async () => {
    const f = await crear();
    (auth['actualizarPerfil'] as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => ({ code: 20013, message: 'Ese codigo ya fue usado. Espere el siguiente.' })));
    await abrirEdicion(f);
    await enviarDatos(f);

    expect(formDatos(f).textContent).toContain('Espera unos segundos a que la app genere uno nuevo');
  });

  it('correo en uso (409): error en el campo del correo', async () => {
    const f = await crear();
    (auth['actualizarPerfil'] as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => ({ code: 20006, message: 'El correo ya existe' })));
    await abrirEdicion(f);
    await enviarDatos(f);

    const campoCorreo = raiz(f).querySelector('section[aria-labelledby=cuenta-datos] [formcontrolname=email]')!;
    expect(campoCorreo.getAttribute('aria-invalid')).toBe('true');
    expect(formDatos(f).textContent).toContain('Ese correo ya está en uso');
  });

  it('cuenta bloqueada (423) y demasiados intentos (429) muestran su aviso', async () => {
    const f = await crear();
    const mock = auth['actualizarPerfil'] as ReturnType<typeof vi.fn>;
    mock.mockReturnValueOnce(throwError(() => ({ code: 20014, message: 'Cuenta bloqueada por 15 minutos.' })));
    await abrirEdicion(f);
    await enviarDatos(f);
    expect(formDatos(f).textContent).toContain('Cuenta bloqueada. Cuenta bloqueada por 15 minutos.');

    mock.mockReturnValueOnce(throwError(() => ({ code: 20015, message: 'x' })));
    await escribir(f, 'section[aria-labelledby=cuenta-datos] input[id^=codigo-mfa-]', '654321');
    formDatos(f).dispatchEvent(new Event('submit'));
    await estabilizar(f);
    expect(formDatos(f).textContent).toContain('Demasiados intentos, espera un minuto.');
  });

  it('cambiar mi clave: envía el código como cuarto dato', async () => {
    const f = await crear();
    (auth['cambiarClave'] as ReturnType<typeof vi.fn>).mockReturnValue(of({ estado: 'CLAVE_CAMBIADA' }));
    const seccion = 'section[aria-labelledby=cuenta-clave]';
    await escribir(f, `${seccion} [formcontrolname=actual]`, 'clave-vieja-1234');
    await escribir(f, `${seccion} [formcontrolname=nueva]`, 'una-clave-nueva-1');
    await escribir(f, `${seccion} [formcontrolname=confirmar]`, 'una-clave-nueva-1');
    await escribir(f, `${seccion} input[inputmode=numeric]`, '123456');
    raiz(f).querySelector(`${seccion} form`)!.dispatchEvent(new Event('submit'));
    await estabilizar(f);

    expect(auth['cambiarClave']).toHaveBeenCalledExactlyOnceWith('clave-vieja-1234', 'una-clave-nueva-1', undefined, '123456');
  });

  it('el código de respaldo se escribe en un campo de texto libre (hasta 30)', async () => {
    const f = await crear();
    await abrirEdicion(f);
    Array.from(formDatos(f).querySelectorAll('button')).find((b) => b.textContent?.includes('código de respaldo'))!.click();
    await estabilizar(f);

    const campo = formDatos(f).querySelector<HTMLInputElement>('input[id^=codigo-mfa-]')!;
    expect(campo.maxLength).toBe(30);
    expect(campo.inputMode).not.toBe('numeric');
  });
});

describe('AuthService · código en cambiar-clave', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  const peticion = () => http.expectOne((r) => new URL(r.url, 'http://h').pathname === '/api/v1/auth/cambiar-clave');

  it('con token temporal (primer ingreso) NO envía el código', () => {
    auth.cambiarClave('temporal', 'nueva-clave-larga-1', 'T1', '123456').subscribe();
    const req = peticion();
    expect(req.request.body).toEqual({ clave_actual: 'temporal', clave_nueva: 'nueva-clave-larga-1' });
    req.flush({ estado: 'MFA_ENROLAR' });
  });

  it('con la sesión abierta envía el código', () => {
    auth.cambiarClave('vieja', 'nueva-clave-larga-1', undefined, '123456').subscribe();
    const req = peticion();
    expect(req.request.body).toEqual({ clave_actual: 'vieja', clave_nueva: 'nueva-clave-larga-1', codigo: '123456' });
    req.flush({ estado: 'CLAVE_CAMBIADA' });
  });

  it('actualizarPerfil: PUT /auth/yo y reemplaza la sesión con la respuesta', () => {
    auth.actualizarPerfil({ nombre: 'Ana María', email: 'a@example.com', codigo: '123456' }).subscribe();
    const req = http.expectOne((r) => new URL(r.url, 'http://h').pathname === '/api/v1/auth/yo');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nombre: 'Ana María', email: 'a@example.com', codigo: '123456' });
    req.flush({ ...ANA, nombre: 'Ana María' });
    expect(auth.sesion()?.nombre).toBe('Ana María');
  });

  it('regenerar códigos envía clave y código', () => {
    auth.regenerarCodigosRespaldo('mi-clave', '123456').subscribe();
    const req = http.expectOne((r) => new URL(r.url, 'http://h').pathname === '/api/v1/auth/mfa/respaldo/regenerar');
    expect(req.request.body).toEqual({ clave_actual: 'mi-clave', codigo: '123456' });
    req.flush({ codigos_respaldo: [] });
  });
});
