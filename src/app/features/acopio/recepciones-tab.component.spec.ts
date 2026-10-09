import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { of } from 'rxjs';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { CATALOGOS_REPOSITORY } from '../catalogos/data/catalogos.provider';
import { PERIODOS_REPOSITORY } from '../periodos/data/periodos.provider';
import { ACOPIO_REPOSITORY } from './data/acopio.provider';
import type { Recepcion } from './models/acopio.models';
import { RecepcionesTabComponent } from './recepciones-tab.component';

const RECEPCION: Recepcion = {
  id_recepcion: 7,
  id_proveedor: 3,
  proveedor: 'PRUEBA Finca La Esperanza',
  id_periodo: 19,
  fecha: '2026-10-09',
  litros: 100,
  temperatura: 8,
  acidez: 16,
  estado_calidad: 'APROBADO',
  motivo_rechazo: null,
  precio_litro: 1800,
  valor_total: 180000,
  usuario_registro: 'prueba',
  fecha_registro: '2026-10-09T14:03:11',
};

describe('RecepcionesTabComponent', () => {
  let acopio: { listarRecepciones: ReturnType<typeof vi.fn>; crearRecepcion: ReturnType<typeof vi.fn>; umbrales: ReturnType<typeof vi.fn>; saldos: ReturnType<typeof vi.fn>; listarPrecios: ReturnType<typeof vi.fn> };

  beforeAll(() => {
    // jsdom no implementa <dialog>.showModal()/close(): el diálogo real usa ambos.
    const dialogo = HTMLDialogElement.prototype;
    dialogo.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogo.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });

  beforeEach(() => {
    acopio = {
      listarRecepciones: vi.fn(() => of({ items: [RECEPCION], total: 1, page: 0, size: 10 })),
      crearRecepcion: vi.fn(() => of(RECEPCION)),
      umbrales: vi.fn(() => of({ temperatura_max: 10, acidez_max: 18 })),
      saldos: vi.fn(() => of({ items: [{ id_proveedor: 3, precio_vigente: 1800 }], total: 1, page: 0, size: 100 })),
      listarPrecios: vi.fn(() => of({ items: [{ id_proveedor: 3 }], total: 1, page: 0, size: 100 })),
    };
    const catalogos = { listarProveedores: vi.fn(() => of({ items: [{ id_proveedor: 3, nombre: 'PRUEBA Finca La Esperanza' }], total: 1, page: 0, size: 100 })) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNgIconLoader(async () => ''),
        { provide: ACOPIO_REPOSITORY, useValue: acopio },
        { provide: CATALOGOS_REPOSITORY, useValue: catalogos },
        { provide: PERIODOS_REPOSITORY, useValue: {} },
      ],
    });
  });

  async function estabilizar(fixture: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  const raiz = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

  function escribir(fixture: ComponentFixture<unknown>, control: string, valor: string): void {
    const input = raiz(fixture).querySelector<HTMLInputElement>(`[formcontrolname="${control}"]`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  /** Abre el diálogo, elige al proveedor, llena los datos y envía el formulario. */
  async function registrar(fixture: ComponentFixture<unknown>, temperatura: string, acidez: string): Promise<void> {
    Array.from(raiz(fixture).querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Nueva recepción'))!.click();
    await estabilizar(fixture);

    const combo = raiz(fixture).querySelector<HTMLInputElement>('#recepcion-proveedor')!;
    combo.dispatchEvent(new Event('focus'));
    await estabilizar(fixture);
    raiz(fixture).querySelector('#recepcion-proveedor-lista [role="option"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await estabilizar(fixture);

    escribir(fixture, 'litros', '100');
    escribir(fixture, 'temperatura', temperatura);
    escribir(fixture, 'acidez', acidez);
    raiz(fixture).querySelector<HTMLFormElement>('#recepcion-form')!.dispatchEvent(new Event('submit'));
    await estabilizar(fixture);
  }

  it('una recepción RECHAZADA muestra el aviso de rechazo con su motivo y NO el aviso de éxito', async () => {
    acopio.crearRecepcion.mockReturnValue(of({ ...RECEPCION, temperatura: 12, estado_calidad: 'RECHAZADO', motivo_rechazo: 'Temperatura 12 °C supera el máximo de 10 °C' }));
    const exito = vi.spyOn(TestBed.inject(ToastService), 'exito');
    const fixture = TestBed.createComponent(RecepcionesTabComponent);
    await estabilizar(fixture);

    await registrar(fixture, '12', '16');

    expect(acopio.crearRecepcion).toHaveBeenCalledTimes(1);
    const aviso = raiz(fixture).querySelector('[data-testid="aviso-rechazada"]');
    expect(aviso?.textContent).toContain('La entrega quedó registrada como rechazada');
    expect(aviso?.textContent).toContain('Temperatura 12 °C supera el máximo de 10 °C');
    expect(exito).not.toHaveBeenCalled();
  });

  it('una recepción APROBADA muestra el aviso de éxito y no el de rechazo', async () => {
    const exito = vi.spyOn(TestBed.inject(ToastService), 'exito');
    const fixture = TestBed.createComponent(RecepcionesTabComponent);
    await estabilizar(fixture);

    await registrar(fixture, '8', '16');

    expect(exito).toHaveBeenCalledTimes(1);
    expect(raiz(fixture).querySelector('[data-testid="aviso-rechazada"]')).toBeNull();
  });

  it('envía la recepción con una Idempotency-Key (el repositorio la recibe como segundo argumento)', async () => {
    const fixture = TestBed.createComponent(RecepcionesTabComponent);
    await estabilizar(fixture);

    await registrar(fixture, '8', '16');

    const [cuerpo, clave] = acopio.crearRecepcion.mock.calls[0];
    expect(cuerpo).toMatchObject({ id_proveedor: 3, litros: 100, temperatura: 8, acidez: 16 });
    expect(typeof clave).toBe('string');
    expect(clave.length).toBeGreaterThanOrEqual(8);
  });
});
