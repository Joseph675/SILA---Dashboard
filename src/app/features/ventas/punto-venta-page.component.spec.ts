import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { of } from 'rxjs';
import { CATALOGOS_REPOSITORY } from '../catalogos/data/catalogos.provider';
import { PARAMETROS_REPOSITORY } from '../parametros/data/parametros.provider';
import { VENTAS_REPOSITORY } from './data/ventas.provider';
import { PuntoVentaPageComponent } from './punto-venta-page.component';

const CONSUMIDOR = { id_cliente: 1, tipo_documento: 'CC', numero_documento: '222222222222', nombre: 'CONSUMIDOR FINAL', email: '', telefono: '', direccion: '', limite_credito: 0, saldo_deudor: 0, activo: true };
const PRODUCTO = { id_producto: 3, codigo_sku: 'QSO', producto: 'Queso', unidad_medida: 'KG', tarifa_iva: 19, stock_actual: 100, precio_base: 10, precio_pactado: null, precio_aplicable: 10 };
const DETALLE = {
  venta: { id_venta: 77, id_cliente: 1, cliente: 'CONSUMIDOR FINAL', tipo_documento: 'CC', numero_documento: '222222222222', id_periodo: 19, fecha_venta: '2026-10-09T15:42:10', tipo_venta: 'CONTADO', fecha_vencimiento: null, subtotal_venta: 20, total_iva: 3.8, total_venta: 23.8, saldo_pendiente: 0, monto_castigado: 0, estado_pago: 'PAGADA', motivo_anulacion: null, usuario_registro: 'prueba', fecha_registro: '2026-10-09T20:42:10' },
  lineas: [],
  pagos: [],
};

describe('PuntoVentaPageComponent', () => {
  let ventas: { precios: ReturnType<typeof vi.fn>; crear: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    ventas = {
      precios: vi.fn(() => of({ items: [PRODUCTO], total: 1, page: 0, size: 30 })),
      crear: vi.fn(() => of(DETALLE)),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNgIconLoader(async () => ''),
        { provide: VENTAS_REPOSITORY, useValue: ventas },
        { provide: CATALOGOS_REPOSITORY, useValue: { listarClientes: vi.fn(() => of({ items: [CONSUMIDOR], total: 1, page: 0, size: 20 })) } },
        { provide: PARAMETROS_REPOSITORY, useValue: { listar: vi.fn(() => of([{ clave: 'PLAZO_CREDITO_DIAS', valor: 30, minimo: 0, maximo: 365, descripcion: '' }])) } },
      ],
    });
  });

  async function estabilizar(fixture: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
  const texto = (f: ComponentFixture<unknown>, id: string) => raiz(f).querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const boton = (f: ComponentFixture<unknown>, contiene: string) => Array.from(raiz(f).querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(contiene))!;

  function escribir(f: ComponentFixture<unknown>, selector: string, valor: string): void {
    const el = raiz(f).querySelector<HTMLInputElement>(selector)!;
    el.value = valor;
    el.dispatchEvent(new Event('input'));
  }

  /** Abre la pantalla y agrega 2 unidades del producto (2 × $ 10 con IVA 19 %). */
  async function conDosUnidades(): Promise<ComponentFixture<PuntoVentaPageComponent>> {
    const fixture = TestBed.createComponent(PuntoVentaPageComponent);
    await estabilizar(fixture);
    raiz(fixture).querySelector<HTMLButtonElement>('ul[aria-label="Productos disponibles"] button')!.click();
    await estabilizar(fixture);
    escribir(fixture, '#pv-cant-0', '2');
    await estabilizar(fixture);
    return fixture;
  }

  it('calcula subtotal, IVA y total con el redondeo por línea, y «Cobrar» solo se habilita cuando los pagos suman exactamente el total', async () => {
    const fixture = await conDosUnidades();

    expect(texto(fixture, 'subtotal')).toMatch(/20/);
    expect(texto(fixture, 'iva')).toContain('3,80');
    expect(texto(fixture, 'total')).toContain('23,80');
    expect(boton(fixture, 'Cobrar').disabled).toBe(true);

    escribir(fixture, 'input[id^="pv-monto-"]', '23.7');
    await estabilizar(fixture);
    expect(boton(fixture, 'Cobrar').disabled).toBe(true);
    expect(texto(fixture, 'motivo-bloqueo')).toContain('Faltan');

    escribir(fixture, 'input[id^="pv-monto-"]', '23.8');
    await estabilizar(fixture);
    expect(boton(fixture, 'Cobrar').disabled).toBe(false);
    expect(texto(fixture, 'estado-pago')).toContain('Completo');
  });

  it('pago mixto: «Falta» se actualiza y el cambio del efectivo NO entra en el cuerpo enviado', async () => {
    const fixture = await conDosUnidades();

    escribir(fixture, 'input[id^="pv-monto-"]', '10');
    await estabilizar(fixture);
    expect(texto(fixture, 'estado-pago')).toContain('Falta');
    expect(texto(fixture, 'estado-pago')).toContain('13,80');

    boton(fixture, 'Agregar otro medio').click();
    await estabilizar(fixture);
    const montos = raiz(fixture).querySelectorAll<HTMLInputElement>('input[id^="pv-monto-"]');
    montos[1].value = '13.8';
    montos[1].dispatchEvent(new Event('input'));
    await estabilizar(fixture);
    expect(texto(fixture, 'estado-pago')).toContain('Completo');

    // El cliente entrega $ 20 en efectivo para una parte en efectivo de $ 10: cambio $ 10 (solo en pantalla).
    escribir(fixture, '#pv-recibido', '20');
    await estabilizar(fixture);
    expect(texto(fixture, 'cambio')).toContain('10');

    boton(fixture, 'Cobrar').click();
    await estabilizar(fixture);

    expect(ventas.crear).toHaveBeenCalledTimes(1);
    const [cuerpo, clave] = ventas.crear.mock.calls[0];
    expect(cuerpo).toEqual({
      id_cliente: 1,
      tipo_venta: 'CONTADO',
      lineas: [{ id_producto: 3, cantidad: 2 }],
      pagos: [
        { metodo_pago: 'EFECTIVO', monto: 10 },
        { metodo_pago: 'TRANSFERENCIA', monto: 13.8 },
      ],
    });
    expect(clave.length).toBeGreaterThanOrEqual(8);
    expect(texto(fixture, 'total-servidor')).toContain('23,80');
  });

  it('el crédito está deshabilitado para CONSUMIDOR FINAL y explica por qué', async () => {
    const fixture = TestBed.createComponent(PuntoVentaPageComponent);
    await estabilizar(fixture);

    const credito = Array.from(raiz(fixture).querySelectorAll<HTMLButtonElement>('button[role="radio"]')).find((b) => b.textContent?.includes('Crédito'))!;
    expect(credito.disabled).toBe(true);
    expect(texto(fixture, 'motivo-sin-credito')).toContain('consumidor final');
  });
});
