import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { of } from 'rxjs';
import { AuthService, Rol } from '../../core/services/auth.service';
import { AjusteInsumoDialogComponent } from './ajuste-insumo-dialog.component';
import { CompraDialogComponent } from './compra-dialog.component';
import { INSUMOS_REPOSITORY } from './data/insumos.provider';
import type { Insumo } from './models/insumos.models';

const AZUCAR: Insumo = { id_insumo: 1, codigo: 'AZUCAR', nombre: 'Azúcar', unidad_medida: 'KG', costo_promedio: 5000, stock_actual: 20, stock_minimo: 5, valor_inventario: 100000, bajo_minimo: false, productos_que_lo_usan: 2, activo: true };

async function estabilizar(f: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 6; i++) {
    f.detectChanges();
    await f.whenStable();
  }
}
const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;

async function elegirInsumo(f: ComponentFixture<unknown>, id: string): Promise<void> {
  raiz(f).querySelector<HTMLInputElement>(`#${id}`)!.dispatchEvent(new Event('focus'));
  await estabilizar(f);
  raiz(f).querySelector(`#${id}-lista [role="option"]`)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  await estabilizar(f);
}
function escribir(f: ComponentFixture<unknown>, selector: string, valor: string): void {
  const el = raiz(f).querySelector<HTMLInputElement>(selector)!;
  el.value = valor;
  el.dispatchEvent(new Event('input'));
}

describe('Insumos', () => {
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
      crearCompra: vi.fn(() => of({ id_compra: 1, insumo: 'Azúcar', unidad_medida: 'KG', cantidad: 10, costo_unitario: 4000 })),
      crearAjuste: vi.fn(() => of({})),
    };
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: INSUMOS_REPOSITORY, useValue: repo }] });
  });

  describe('compra', () => {
    async function crear(): Promise<ComponentFixture<CompraDialogComponent>> {
      const f = TestBed.createComponent(CompraDialogComponent);
      f.componentRef.setInput('insumos', [AZUCAR]);
      f.componentRef.setInput('abierto', true);
      await estabilizar(f);
      return f;
    }

    it('muestra el costo unitario (valor de la factura ÷ cantidad) antes de enviar', async () => {
      const f = await crear();
      await elegirInsumo(f, 'compra-insumo');
      escribir(f, '[formcontrolname=cantidad]', '10');
      escribir(f, '[formcontrolname=valor_total]', '40000');
      await estabilizar(f);

      const texto = (raiz(f).querySelector('[data-testid=costo-unitario]')?.textContent ?? '').replace(/\s+/g, ' ');
      expect(texto).toContain('4.000');
      expect(texto).toContain('por KG');
    });

    it('envía el valor total de la factura (no un precio unitario) y una Idempotency-Key', async () => {
      const f = await crear();
      await elegirInsumo(f, 'compra-insumo');
      escribir(f, '[formcontrolname=cantidad]', '10');
      escribir(f, '[formcontrolname=valor_total]', '40000');
      escribir(f, '[formcontrolname=referencia]', 'FACT-1');
      await estabilizar(f);
      raiz(f).querySelector('#compra-form')!.dispatchEvent(new Event('submit'));
      await estabilizar(f);

      const [cuerpo, clave] = repo['crearCompra'].mock.calls[0];
      expect(cuerpo).toMatchObject({ id_insumo: 1, cantidad: 10, valor_total: 40000, referencia: 'FACT-1' });
      expect(cuerpo.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect('id_proveedor' in cuerpo).toBe(false);
      expect(clave.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('ajuste', () => {
    async function tipos(rol: Rol): Promise<string[]> {
      TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'a', nombre: 'A', email: 'a@example.com', rol, mfa_activo: true });
      const f = TestBed.createComponent(AjusteInsumoDialogComponent);
      f.componentRef.setInput('insumos', [AZUCAR]);
      f.componentRef.setInput('abierto', true);
      await estabilizar(f);
      return Array.from(raiz(f).querySelectorAll<HTMLOptionElement>('select option')).filter((o) => o.value).map((o) => o.value);
    }

    it('un OPERATIVO solo puede elegir MERMA, DANO y VENCIMIENTO', async () => {
      expect(await tipos('OPERATIVO')).toEqual(['MERMA', 'DANO', 'VENCIMIENTO']);
    });

    it('un ADMIN también puede elegir las dos correcciones', async () => {
      expect(await tipos('ADMIN')).toEqual(['MERMA', 'DANO', 'VENCIMIENTO', 'CORRECCION_MAS', 'CORRECCION_MENOS']);
    });
  });
});
