import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNgIconLoader } from '@ng-icons/core';
import { of } from 'rxjs';
import { AuthService, Rol } from '../../core/services/auth.service';
import { VENTAS_REPOSITORY } from './data/ventas.provider';
import { VentaDetalleDialogComponent } from './venta-detalle-dialog.component';

const detalle = (estado: string) => ({
  venta: { id_venta: 12, id_cliente: 5, cliente: 'Doña Rosa', tipo_documento: 'CC', numero_documento: '123', id_periodo: 19, fecha_venta: '2026-10-09T15:42:10', tipo_venta: 'CONTADO', fecha_vencimiento: null, subtotal_venta: 20, total_iva: 3.8, total_venta: 23.8, saldo_pendiente: 0, monto_castigado: 0, estado_pago: estado, motivo_anulacion: null, usuario_registro: 'x', fecha_registro: '2026-10-09T20:00:00' },
  lineas: [],
  pagos: [],
});

describe('VentaDetalleDialogComponent · anular', () => {
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

  async function crear(rol: Rol, estado = 'PAGADA'): Promise<ComponentFixture<VentaDetalleDialogComponent>> {
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), provideRouter([]), { provide: VENTAS_REPOSITORY, useValue: { detalle: vi.fn(() => of(detalle(estado))) } }] });
    TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'prueba', nombre: 'Prueba', email: 'p@example.com', rol, mfa_activo: false });
    const fixture = TestBed.createComponent(VentaDetalleDialogComponent);
    fixture.componentRef.setInput('idVenta', 12);
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    return fixture;
  }

  const hayAnular = (f: ComponentFixture<unknown>) => Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Anular venta' && !b.closest('app-confirm-dialog'));

  it('«Anular venta» aparece a un ADMIN', async () => {
    expect(hayAnular(await crear('ADMIN'))).toBe(true);
  });

  it('«Anular venta» NO aparece a un OPERATIVO', async () => {
    expect(hayAnular(await crear('OPERATIVO'))).toBe(false);
  });

  it('no se ofrece anular una venta que ya está anulada', async () => {
    expect(hayAnular(await crear('ADMIN', 'ANULADA'))).toBe(false);
  });
});
