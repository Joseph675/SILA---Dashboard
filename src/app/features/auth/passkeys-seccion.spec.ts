import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import type { Passkey } from '../../core/auth/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { PasskeyError, PasskeyService } from '../../core/services/passkey.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PasskeysSeccionComponent } from './passkeys-seccion.component';

const IPHONE: Passkey = { id_passkey: 1, nombre: 'iPhone — Safari', fecha_creacion: '2026-10-14T02:40:01', fecha_ultimo_uso: '2026-10-14T15:05:00' };
const PORTATIL: Passkey = { id_passkey: 2, nombre: 'Windows — Edge', fecha_creacion: '2026-10-01T12:00:00', fecha_ultimo_uso: null };
const OPCIONES = { publicKey: { challenge: 'AQID', rp: { name: 'SILA' }, user: { id: 'AQ', name: 'ana', displayName: 'Ana' }, pubKeyCredParams: [] } };
const CREDENCIAL = { id: 'cred', rawId: 'AQ', type: 'public-key', response: { clientDataJSON: 'AA', attestationObject: 'AA' }, clientExtensionResults: {} };
const error = (code: number, message: string) => throwError(() => ({ code, message }));

describe('Mi cuenta · Face ID / huella', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let auth: Record<string, any>;
  let passkey: { soportado: ReturnType<typeof vi.fn>; crear: ReturnType<typeof vi.fn> };

  async function estabilizar(f: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 6; i++) {
      f.detectChanges();
      await f.whenStable();
      await new Promise((r) => setTimeout(r));
    }
    f.detectChanges();
  }
  const q = (f: ComponentFixture<unknown>, sel: string) => (f.nativeElement as HTMLElement).querySelector<HTMLElement>(sel);
  const texto = (f: ComponentFixture<unknown>, sel: string) => (q(f, sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const clic = async (f: ComponentFixture<unknown>, sel: string) => {
    q(f, sel)!.click();
    await estabilizar(f);
  };
  async function escribir(f: ComponentFixture<unknown>, sel: string, valor: string): Promise<void> {
    const input = q(f, sel) as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    await estabilizar(f);
  }

  async function crear(mfaActivo = true): Promise<ComponentFixture<PasskeysSeccionComponent>> {
    const f = TestBed.createComponent(PasskeysSeccionComponent);
    f.componentRef.setInput('mfaActivo', mfaActivo);
    await estabilizar(f);
    return f;
  }

  /** Opens the dialog and fills name + code. */
  async function rellenar(f: ComponentFixture<unknown>, nombre = 'Mi iPhone', codigo = '123456'): Promise<void> {
    await clic(f, '[data-testid=agregar-passkey]');
    await escribir(f, 'input[formcontrolname=nombre]', nombre);
    await escribir(f, 'app-campo-codigo-mfa input', codigo);
  }

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

  beforeEach(() => {
    auth = {
      listarPasskeys: vi.fn(() => of([IPHONE, PORTATIL])),
      opcionesRegistroPasskey: vi.fn(() => of(OPCIONES)),
      registrarPasskey: vi.fn(() => of({ ...PORTATIL, id_passkey: 3, nombre: 'Mi iPhone' })),
      quitarPasskey: vi.fn(() => of(undefined)),
    };
    passkey = { soportado: vi.fn(() => Promise.resolve(true)), crear: vi.fn(() => Promise.resolve(CREDENCIAL)) };
    TestBed.configureTestingModule({
      providers: [provideNgIconLoader(async () => ''), { provide: AuthService, useValue: auth }, { provide: PasskeyService, useValue: passkey }],
    });
  });

  describe('lista', () => {
    it('muestra nombre, fecha de registro y último uso en hora de Colombia («nunca» si no se ha usado)', async () => {
      const f = await crear();
      const filas = (f.nativeElement as HTMLElement).querySelectorAll('[data-testid=lista-passkeys] li');

      expect(filas).toHaveLength(2);
      expect(filas[0].textContent).toContain('iPhone — Safari');
      // 02:40 UTC del 14 → 21:40 del 13 en Colombia; 15:05 UTC → 10:05.
      expect(filas[0].textContent).toContain('13/10/2026 21:40');
      expect(filas[0].textContent).toContain('14/10/2026 10:05');
      expect(filas[1].textContent).toContain('Último uso: nunca');
    });

    it('con el texto de ayuda y sin dispositivos dice que no hay ninguno', async () => {
      auth['listarPasskeys'].mockReturnValue(of([]));
      const f = await crear();

      expect(texto(f, '[data-testid=ayuda-passkeys]')).toBe('Tu cara o tu huella nunca salen del teléfono; SILA solo guarda una llave pública. El registro sirve solo en esta dirección web.');
      expect(texto(f, '[data-testid=sin-passkeys]')).toContain('ningún dispositivo');
    });

    it('si falla la consulta permite reintentar', async () => {
      auth['listarPasskeys'].mockReturnValueOnce(error(20999, 'caído'));
      const f = await crear();

      expect(texto(f, '[role=alert]')).toContain('No se pudo consultar');
      await clic(f, '[role=alert] button');
      expect(q(f, '[data-testid=lista-passkeys]')).toBeTruthy();
    });
  });

  describe('sin segundo factor', () => {
    it('explica que primero active la app de autenticación, no consulta nada y no deja agregar', async () => {
      const f = await crear(false);

      expect(texto(f, '[data-testid=requiere-mfa]')).toContain('primero activa la aplicación de autenticación');
      expect(auth['listarPasskeys']).not.toHaveBeenCalled();
      expect(q(f, '[data-testid=agregar-passkey]')).toBeNull();
      expect(q(f, '[data-testid=lista-passkeys]')).toBeNull();
    });
  });

  describe('navegador sin soporte', () => {
    it('oculta «Agregar este dispositivo» (la lista y «Quitar» siguen)', async () => {
      passkey.soportado.mockResolvedValue(false);
      const f = await crear();

      expect(q(f, '[data-testid=agregar-passkey]')).toBeNull();
      expect(q(f, '[data-testid=no-soportado]')).toBeTruthy();
      expect(q(f, '[data-testid=quitar-passkey]')).toBeTruthy();
    });
  });

  describe('agregar este dispositivo', () => {
    it('sugiere un nombre, pide el código y registra: opciones(código) → diálogo del sistema → guardar(nombre, credencial)', async () => {
      const exito = vi.spyOn(TestBed.inject(ToastService), 'exito');
      const f = await crear();
      await clic(f, '[data-testid=agregar-passkey]');
      expect((q(f, 'input[formcontrolname=nombre]') as HTMLInputElement).value.length).toBeGreaterThan(0);

      await escribir(f, 'input[formcontrolname=nombre]', '  Mi iPhone ');
      await escribir(f, 'app-campo-codigo-mfa input', '123456');
      await clic(f, '[data-testid=continuar-passkey]');

      expect(auth['opcionesRegistroPasskey']).toHaveBeenCalledExactlyOnceWith('123456');
      expect(passkey.crear).toHaveBeenCalledExactlyOnceWith(OPCIONES);
      expect(auth['registrarPasskey']).toHaveBeenCalledExactlyOnceWith('Mi iPhone', CREDENCIAL);
      expect(exito).toHaveBeenCalled();
      // La lista se vuelve a pedir y el diálogo se cierra.
      expect(auth['listarPasskeys']).toHaveBeenCalledTimes(2);
      expect(q(f, 'dialog')!.hasAttribute('open')).toBe(false);
    });

    it('sin código no pide nada al servidor', async () => {
      const f = await crear();
      await clic(f, '[data-testid=agregar-passkey]');
      await clic(f, '[data-testid=continuar-passkey]');

      expect(auth['opcionesRegistroPasskey']).not.toHaveBeenCalled();
    });

    it('un código incorrecto se marca en el campo del código y no se abre el diálogo del sistema', async () => {
      auth['opcionesRegistroPasskey'].mockReturnValueOnce(error(20013, 'Codigo incorrecto.'));
      const f = await crear();
      await rellenar(f);
      await clic(f, '[data-testid=continuar-passkey]');

      expect(texto(f, 'app-campo-codigo-mfa')).toContain('El código es incorrecto');
      expect(passkey.crear).not.toHaveBeenCalled();
      expect(auth['registrarPasskey']).not.toHaveBeenCalled();
    });

    it('si la persona cancela el diálogo del sistema: aviso suave, nada en rojo, nada se guarda y el formulario sigue', async () => {
      passkey.crear.mockResolvedValueOnce(null);
      const f = await crear();
      await rellenar(f);
      await clic(f, '[data-testid=continuar-passkey]');

      expect(texto(f, '[data-testid=aviso-passkey]')).toContain('Cancelaste el registro');
      expect(q(f, '[data-testid=error-passkey]')).toBeNull();
      expect(auth['registrarPasskey']).not.toHaveBeenCalled();
      expect(q(f, 'dialog')!.hasAttribute('open')).toBe(true);
      expect((q(f, 'input[formcontrolname=nombre]') as HTMLInputElement).value).toBe('Mi iPhone');
    });

    it.each([
      ['el tope de 10 dispositivos', 'Ya tienes 10 dispositivos registrados. Quita uno para agregar otro.'],
      ['dispositivo ya registrado', 'Este dispositivo ya está registrado.'],
      ['desafío vencido', 'El desafío venció o ya se usó. Inténtalo de nuevo.'],
    ])('409 (%s): muestra el mensaje del servidor', async (_caso, mensaje) => {
      auth['registrarPasskey'].mockReturnValueOnce(error(20006, mensaje));
      const f = await crear();
      await rellenar(f);
      await clic(f, '[data-testid=continuar-passkey]');

      expect(texto(f, '[data-testid=error-passkey]')).toBe(mensaje);
      expect(q(f, 'dialog')!.hasAttribute('open')).toBe(true);
    });

    it('un fallo del dispositivo (PasskeyError) se muestra con su mensaje', async () => {
      passkey.crear.mockRejectedValueOnce(new PasskeyError('Este dispositivo ya está registrado.'));
      const f = await crear();
      await rellenar(f);
      await clic(f, '[data-testid=continuar-passkey]');

      expect(texto(f, '[data-testid=error-passkey]')).toBe('Este dispositivo ya está registrado.');
      expect(auth['registrarPasskey']).not.toHaveBeenCalled();
    });
  });

  describe('quitar', () => {
    it('pide confirmación y luego borra ese dispositivo y recarga la lista', async () => {
      const f = await crear();
      await clic(f, '[data-testid=quitar-passkey]');
      expect(auth['quitarPasskey']).not.toHaveBeenCalled();

      const confirmar = Array.from((f.nativeElement as HTMLElement).querySelectorAll('app-confirm-dialog button')).find((b) => b.textContent?.trim() === 'Quitar') as HTMLElement;
      confirmar.click();
      await estabilizar(f);

      expect(auth['quitarPasskey']).toHaveBeenCalledExactlyOnceWith(1);
      expect(auth['listarPasskeys']).toHaveBeenCalledTimes(2);
    });

    it('cancelar la confirmación no borra nada', async () => {
      const f = await crear();
      await clic(f, '[data-testid=quitar-passkey]');
      const cancelar = Array.from((f.nativeElement as HTMLElement).querySelectorAll('app-confirm-dialog button')).find((b) => b.textContent?.includes('Cancelar')) as HTMLElement;
      cancelar.click();
      await estabilizar(f);

      expect(auth['quitarPasskey']).not.toHaveBeenCalled();
    });
  });
});
