import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import { AuthService, Rol } from '../../core/services/auth.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ACOPIO_REPOSITORY } from './data/acopio.provider';
import { PagoLecheroDialogComponent } from './pago-lechero-dialog.component';
import { PagosTablaComponent } from './pagos-tabla.component';
import { PrecioLecheDialogComponent } from './precio-leche-dialog.component';

const QUINCENA = { id_periodo: 19, anio: 2026, mes: 10, quincena: 1, id_proveedor: 3, proveedor: 'Finca', litros_a_pagar: 100, litros_rechazados: 0, valor_leche: 180000, valor_pagado: 80000, saldo: 100000, precio_promedio: 1800 };
const PAGO = { id_pago: 9, id_proveedor: 3, proveedor: 'Finca', id_periodo: 19, id_periodo_liquidado: 19, anio: 2026, mes: 10, quincena: 1, fecha_pago: '2026-10-09', monto: 80000, metodo_pago: 'EFECTIVO', referencia_pago: null, estado: 'VIGENTE', motivo_anulacion: null };

async function estabilizar(f: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 8; i++) {
    f.detectChanges();
    await f.whenStable();
  }
}
const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
function escribir(f: ComponentFixture<unknown>, selector: string, valor: string): void {
  const el = raiz(f).querySelector<HTMLInputElement>(selector)!;
  el.value = valor;
  el.dispatchEvent(new Event('input'));
}
const boton = (c: ParentNode, texto: string) => Array.from(c.querySelectorAll('button')).find((b) => b.textContent?.includes(texto));
function entrar(rol: Rol): void {
  TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'a', nombre: 'A', email: 'a@example.com', rol, mfa_activo: true });
}

describe('Cuentas con los lecheros', () => {
  let repo: Record<string, ReturnType<typeof vi.fn>>;

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
    repo = {
      fijarPrecio: vi.fn(() => of({ id_precio: 1, id_proveedor: 3, proveedor: 'Finca', precio_litro: 1900, vigente_desde: '2026-10-09', vigente: true })),
      pagoLecheros: vi.fn(() => of({ items: [QUINCENA], total: 1, page: 0, size: 50 })),
      registrarPago: vi.fn(() => of(PAGO)),
      listarPagos: vi.fn(() => of({ items: [PAGO], total: 1, page: 0, size: 10 })),
      anularPago: vi.fn(() => of({ ...PAGO, estado: 'ANULADO', motivo_anulacion: 'Se pagó dos veces' })),
    };
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: ACOPIO_REPOSITORY, useValue: repo }] });
  });

  it('fijar precio: envía lechero, precio y fecha, y avisa que solo afecta las entregas nuevas', async () => {
    const f = TestBed.createComponent(PrecioLecheDialogComponent);
    f.componentRef.setInput('proveedores', [{ valor: 3, etiqueta: 'Finca' }]);
    f.componentRef.setInput('abierto', true);
    await estabilizar(f);
    expect(raiz(f).querySelector('[data-testid=aviso-precio]')?.textContent).toContain('Solo afecta las entregas nuevas');

    raiz(f).querySelector<HTMLInputElement>('#precio-lechero')!.dispatchEvent(new Event('focus'));
    await estabilizar(f);
    raiz(f).querySelector('#precio-lechero-lista [role=option]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await estabilizar(f);
    escribir(f, '[formcontrolname=precio]', '1900');
    await estabilizar(f);
    raiz(f).querySelector('#precio-leche-form')!.dispatchEvent(new Event('submit'));
    await estabilizar(f);

    expect(repo['fijarPrecio']).toHaveBeenCalledTimes(1);
    const cuerpo = repo['fijarPrecio'].mock.calls[0][0];
    expect(cuerpo).toMatchObject({ id_proveedor: 3, precio_litro: 1900 });
    expect(cuerpo.vigente_desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  async function dialogoPago(): Promise<ComponentFixture<PagoLecheroDialogComponent>> {
    entrar('ADMIN');
    const f = TestBed.createComponent(PagoLecheroDialogComponent);
    f.componentRef.setInput('proveedor', { id_proveedor: 3, nombre: 'Finca' });
    await estabilizar(f);
    return f;
  }

  it('pago: ofrece la quincena con su saldo, «Pagar todo el saldo» y envía con Idempotency-Key', async () => {
    const f = await dialogoPago();
    expect((raiz(f).textContent ?? '').replace(/\s+/g, ' ')).toContain('saldo $ 100.000');

    boton(raiz(f), 'Pagar todo el saldo')!.click();
    await estabilizar(f);
    expect(raiz(f).querySelector<HTMLInputElement>('[formcontrolname=monto]')!.value).toBe('100000');

    raiz(f).querySelector('#pago-lechero-form')!.dispatchEvent(new Event('submit'));
    await estabilizar(f);
    const [cuerpo, clave] = repo['registrarPago'].mock.calls[0];
    expect(cuerpo).toMatchObject({ id_proveedor: 3, id_periodo_liquidado: 19, monto: 100000, metodo_pago: 'EFECTIVO' });
    expect(clave.length).toBeGreaterThanOrEqual(8);
  });

  it('pago que supera el saldo: muestra «El pago supera el saldo de esa quincena (…)» y no cierra', async () => {
    repo['registrarPago'].mockReturnValue(throwError(() => ({ code: 20005, message: 'saldo $ 100.000' })));
    const f = await dialogoPago();
    escribir(f, '[formcontrolname=monto]', '500000');
    await estabilizar(f);
    raiz(f).querySelector('#pago-lechero-form')!.dispatchEvent(new Event('submit'));
    await estabilizar(f);

    expect(raiz(f).querySelector('[data-testid=error-pago]')?.textContent).toContain('El pago supera el saldo de esa quincena (saldo $ 100.000)');
  });

  describe('anular un pago', () => {
    async function tabla(rol: Rol): Promise<ComponentFixture<PagosTablaComponent>> {
      entrar(rol);
      const f = TestBed.createComponent(PagosTablaComponent);
      await estabilizar(f);
      return f;
    }

    it('un ADMIN anula con motivo (≥ 10) y con Idempotency-Key', async () => {
      const exito = vi.spyOn(TestBed.inject(ToastService), 'exito');
      const f = await tabla('ADMIN');

      boton(raiz(f).querySelector('tbody')!, 'Anular')!.click();
      await estabilizar(f);
      const confirmar = () => Array.from(raiz(f).querySelectorAll('dialog')).map((d) => boton(d, 'Anular pago')).find((b) => b?.className.includes('bg-destructive'))!;
      expect(confirmar().disabled).toBe(true);

      const motivo = raiz(f).querySelector<HTMLTextAreaElement>('#confirm-motivo')!;
      motivo.value = 'Se pagó dos veces';
      motivo.dispatchEvent(new Event('input'));
      await estabilizar(f);
      confirmar().click();
      await estabilizar(f);

      const [id, texto, clave] = repo['anularPago'].mock.calls[0];
      expect([id, texto]).toEqual([9, 'Se pagó dos veces']);
      expect(clave.length).toBeGreaterThanOrEqual(8);
      expect(exito).toHaveBeenCalledTimes(1);
    });

    it('un OPERATIVO no ve «Anular»', async () => {
      const f = await tabla('OPERATIVO');
      expect(boton(raiz(f).querySelector('tbody')!, 'Anular')).toBeUndefined();
    });

    it('un pago anulado se ve tachado con su motivo y sin botón', async () => {
      repo['listarPagos'].mockReturnValue(of({ items: [{ ...PAGO, estado: 'ANULADO', motivo_anulacion: 'Se pagó dos veces' }], total: 1, page: 0, size: 10 }));
      const f = await tabla('ADMIN');
      expect(raiz(f).querySelector('tbody .line-through')).toBeTruthy();
      expect(raiz(f).textContent).toContain('Motivo: Se pagó dos veces');
      expect(boton(raiz(f).querySelector('tbody')!, 'Anular')).toBeUndefined();
    });
  });
});
