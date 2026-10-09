import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { of } from 'rxjs';
import { AuthService, Rol } from '../../core/services/auth.service';
import { ClientesCarteraTabComponent } from './clientes-cartera-tab.component';
import { CARTERA_REPOSITORY } from './data/cartera.provider';

const CLIENTE = { id_cliente: 5, cliente: 'Doña Rosa', telefono: '300', limite_credito: 1000, saldo_deudor: 500, cupo_disponible: 500, dias_mora: 0, estado_credito: 'VIGENTE' };

describe('ClientesCarteraTabComponent · castigar', () => {
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

  async function crear(rol: Rol): Promise<ComponentFixture<ClientesCarteraTabComponent>> {
    TestBed.configureTestingModule({
      providers: [
        provideNgIconLoader(async () => ''),
        {
          provide: CARTERA_REPOSITORY,
          useValue: {
            clientes: vi.fn(() => of({ items: [CLIENTE], total: 1, page: 0, size: 10 })),
            resumen: vi.fn(() => of({ total_cartera: 500, clientes_con_deuda: 1, clientes_en_mora: 0, cartera_vencida: 0 })),
            ventasPendientes: vi.fn(() => of([])),
          },
        },
      ],
    });
    TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'prueba', nombre: 'Prueba', email: 'p@example.com', rol, mfa_activo: false });
    const fixture = TestBed.createComponent(ClientesCarteraTabComponent);
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    return fixture;
  }

  const botones = (f: ComponentFixture<unknown>) => Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('tbody button')).map((b) => b.textContent!.trim());

  it('un ADMIN ve «Castigar cartera»', async () => {
    expect(botones(await crear('ADMIN')).some((t) => t.startsWith('Castigar cartera'))).toBe(true);
  });

  it('un OPERATIVO NO ve «Castigar cartera», pero sí registrar abono', async () => {
    const textos = botones(await crear('OPERATIVO'));
    expect(textos.some((t) => t.startsWith('Castigar cartera'))).toBe(false);
    expect(textos.some((t) => t.startsWith('Registrar abono'))).toBe(true);
  });
});
