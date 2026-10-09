import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import { AbonoDialogComponent } from './abono-dialog.component';
import { CARTERA_REPOSITORY } from './data/cartera.provider';
import type { ClienteCartera } from './models/cartera.models';

const CLIENTE: ClienteCartera = { id_cliente: 5, cliente: 'Doña Rosa', telefono: null, limite_credito: 5000, saldo_deudor: 1000, cupo_disponible: 4000, dias_mora: 0, estado_credito: 'VIGENTE' };
const recibo = (id: number, monto: number, saldo: number) => ({ id_recibo: id, saldo_restante: saldo, abonos: [{ id_abono: id, id_recibo: id, id_cliente: 5, cliente: 'Doña Rosa', id_venta: 1, fecha_abono: '2026-10-09T20:00:00', monto, metodo_pago: 'EFECTIVO', referencia_pago: null, usuario_registro: 'x' }] });

describe('AbonoDialogComponent · pago mixto', () => {
  let repo: { registrarAbono: ReturnType<typeof vi.fn>; ventasPendientes: ReturnType<typeof vi.fn> };

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
      registrarAbono: vi.fn(),
      ventasPendientes: vi.fn(() => of([{ id_venta: 1, fecha_venta: '2026-09-01T10:00:00', fecha_vencimiento: '2026-10-01', total_venta: 1000, saldo_pendiente: 1000, dias_mora: 8 }])),
    };
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: CARTERA_REPOSITORY, useValue: repo }] });
  });

  async function estabilizar(f: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 8; i++) {
      f.detectChanges();
      await f.whenStable();
    }
  }
  const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
  const boton = (f: ComponentFixture<unknown>, contiene: string) => Array.from(raiz(f).querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(contiene))!;

  /** Dos filas: $ 400 en efectivo y $ 600 en transferencia (toda la deuda). */
  async function conDosFilas(): Promise<ComponentFixture<AbonoDialogComponent>> {
    const fixture = TestBed.createComponent(AbonoDialogComponent);
    fixture.componentRef.setInput('cliente', CLIENTE);
    await estabilizar(fixture);
    boton(fixture, 'Agregar otro medio').click();
    await estabilizar(fixture);
    const montos = raiz(fixture).querySelectorAll<HTMLInputElement>('input[id^="ab-monto-"]');
    [montos[0], montos[1]].forEach((el, i) => {
      el.value = i === 0 ? '400' : '600';
      el.dispatchEvent(new Event('input'));
    });
    await estabilizar(fixture);
    return fixture;
  }

  it('envía una solicitud por fila, en orden, cada una con su propia Idempotency-Key', async () => {
    repo.registrarAbono.mockReturnValueOnce(of(recibo(1, 400, 600))).mockReturnValueOnce(of(recibo(2, 600, 0)));
    const fixture = await conDosFilas();

    boton(fixture, 'Registrar abonos').click();
    await estabilizar(fixture);

    expect(repo.registrarAbono).toHaveBeenCalledTimes(2);
    const [primero, segundo] = repo.registrarAbono.mock.calls;
    expect(primero[0]).toEqual({ id_cliente: 5, monto: 400, metodo_pago: 'EFECTIVO' });
    expect(segundo[0]).toEqual({ id_cliente: 5, monto: 600, metodo_pago: 'TRANSFERENCIA' });
    expect(primero[1]).not.toBe(segundo[1]);
    expect(raiz(fixture).querySelector('[data-testid="recibos"]')?.textContent).toContain('Recibo N.º 2');
  });

  it('si una falla, NO envía las siguientes y dice qué se registró y qué no', async () => {
    repo.registrarAbono.mockReturnValueOnce(throwError(() => ({ code: 20005, message: 'El abono excede la deuda' })));
    const fixture = await conDosFilas();

    boton(fixture, 'Registrar abonos').click();
    await estabilizar(fixture);

    expect(repo.registrarAbono).toHaveBeenCalledTimes(1);
    const error = raiz(fixture).querySelector('[data-testid="error-abono"]')?.textContent ?? '';
    expect(error).toContain('El abono excede la deuda');
    expect(error).toContain('No se registró ningún abono');
    // Las dos filas siguen en la lista para corregir y reintentar.
    expect(raiz(fixture).querySelectorAll('input[id^="ab-monto-"]').length).toBe(2);
  });

  it('la primera fila sí quedó registrada si la segunda falla', async () => {
    repo.registrarAbono.mockReturnValueOnce(of(recibo(1, 400, 600))).mockReturnValueOnce(throwError(() => ({ code: 20005, message: 'El abono excede la deuda' })));
    const fixture = await conDosFilas();

    boton(fixture, 'Registrar abonos').click();
    await estabilizar(fixture);

    expect(repo.registrarAbono).toHaveBeenCalledTimes(2);
    expect(raiz(fixture).querySelector('[data-testid="recibos"]')?.textContent).toContain('Recibo N.º 1');
    expect(raiz(fixture).querySelector('[data-testid="error-abono"]')?.textContent).toContain('Ya quedaron registrados 1 abono');
    expect(raiz(fixture).querySelectorAll('input[id^="ab-monto-"]').length).toBe(1);
  });
});
