import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { of } from 'rxjs';
import { AuthService, Rol } from '../../../core/services/auth.service';
import { CATALOGOS_REPOSITORY } from '../data/catalogos.provider';
import type { Producto } from '../models/catalogos.models';
import { ProductoFormDialogComponent } from './producto-form-dialog.component';

const PRODUCTO: Producto = { id_producto: 7, codigo_sku: 'AREQ', nombre: 'Arequipe', unidad_medida: 'UND', precio_base: 5000, tarifa_iva: 19, stock: 3, stock_minimo: 5, bajo_minimo: true, activo: true };

async function estabilizar(f: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 6; i++) {
    f.detectChanges();
    await f.whenStable();
  }
}
const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;

describe('Stock mínimo (alerta) del producto', () => {
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
      actualizarProducto: vi.fn(() => of(PRODUCTO)),
      cambiarStockMinimoProducto: vi.fn(() => of(PRODUCTO)),
      crearProducto: vi.fn(() => of(PRODUCTO)),
    };
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: CATALOGOS_REPOSITORY, useValue: repo }] });
  });

  async function abrir(rol: Rol, modo: 'crear' | 'editar' | 'minimo'): Promise<ComponentFixture<ProductoFormDialogComponent>> {
    TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'a', nombre: 'A', email: 'a@example.com', rol, mfa_activo: true });
    const f = TestBed.createComponent(ProductoFormDialogComponent);
    f.componentRef.setInput('modo', modo);
    if (modo !== 'crear') f.componentRef.setInput('producto', PRODUCTO);
    f.componentRef.setInput('abierto', true);
    await estabilizar(f);
    return f;
  }
  const campo = (f: ComponentFixture<unknown>) => raiz(f).querySelector<HTMLInputElement>('[formcontrolname=stock_minimo]')!;
  function escribir(f: ComponentFixture<unknown>, valor: string): void {
    campo(f).value = valor;
    campo(f).dispatchEvent(new Event('input'));
  }

  it('un ADMIN lo ve editable con su valor actual; un OPERATIVO lo ve de solo lectura', async () => {
    const admin = await abrir('ADMIN', 'editar');
    expect(campo(admin).disabled).toBe(false);
    expect(campo(admin).value).toBe('5');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: CATALOGOS_REPOSITORY, useValue: repo }] });

    const operativo = await abrir('OPERATIVO', 'editar');
    expect(campo(operativo).disabled).toBe(true);
    expect(campo(operativo).value).toBe('5');
    expect(raiz(operativo).textContent).toContain('Solo un administrador lo cambia');
  });

  it('un ADMIN que lo cambia lo envía en el PUT; un OPERATIVO nunca lo envía (daría 403)', async () => {
    const admin = await abrir('ADMIN', 'editar');
    escribir(admin, '8,5'.replace(',', '.'));
    await estabilizar(admin);
    raiz(admin).querySelector('#producto-form')!.dispatchEvent(new Event('submit'));
    await estabilizar(admin);
    expect(repo['actualizarProducto'].mock.calls[0][1]).toEqual({ nombre: 'Arequipe', unidad_medida: 'UND', stock_minimo: 8.5 });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: CATALOGOS_REPOSITORY, useValue: repo }] });
    repo['actualizarProducto'].mockClear();
    const operativo = await abrir('OPERATIVO', 'editar');
    raiz(operativo).querySelector('#producto-form')!.dispatchEvent(new Event('submit'));
    await estabilizar(operativo);
    expect(repo['actualizarProducto'].mock.calls[0][1]).toEqual({ nombre: 'Arequipe', unidad_medida: 'UND' });
  });

  it('si el ADMIN no lo cambió, tampoco se envía', async () => {
    const f = await abrir('ADMIN', 'editar');
    raiz(f).querySelector('#producto-form')!.dispatchEvent(new Event('submit'));
    await estabilizar(f);

    expect('stock_minimo' in repo['actualizarProducto'].mock.calls[0][1]).toBe(false);
  });

  it('edición rápida: PATCH con solo el mínimo; acepta 0 (sin alerta) y rechaza más de 3 decimales', async () => {
    const f = await abrir('ADMIN', 'minimo');
    escribir(f, '1.2345');
    await estabilizar(f);
    raiz(f).querySelector('#producto-form')!.dispatchEvent(new Event('submit'));
    await estabilizar(f);
    expect(repo['cambiarStockMinimoProducto']).not.toHaveBeenCalled();
    expect(raiz(f).textContent).toContain('Máximo 3 decimales');

    escribir(f, '0');
    await estabilizar(f);
    raiz(f).querySelector('#producto-form')!.dispatchEvent(new Event('submit'));
    await estabilizar(f);
    expect(repo['cambiarStockMinimoProducto']).toHaveBeenCalledExactlyOnceWith(7, 0);
  });

  it('al crear, el mínimo es opcional: vacío no se envía y escrito sí', async () => {
    const llenar = (f: ComponentFixture<unknown>) => {
      const set = (n: string, v: string) => {
        const el = raiz(f).querySelector<HTMLInputElement>(`[formcontrolname=${n}]`)!;
        el.value = v;
        el.dispatchEvent(new Event('input'));
      };
      set('codigo_sku', 'AREQ');
      set('nombre', 'Arequipe');
      set('precio_base', '5000');
      set('tarifa_iva', '19');
    };
    const f = await abrir('ADMIN', 'crear');
    llenar(f);
    await estabilizar(f);
    raiz(f).querySelector('#producto-form')!.dispatchEvent(new Event('submit'));
    await estabilizar(f);
    expect('stock_minimo' in repo['crearProducto'].mock.calls[0][0]).toBe(false);

    escribir(f, '10');
    await estabilizar(f);
    raiz(f).querySelector('#producto-form')!.dispatchEvent(new Event('submit'));
    await estabilizar(f);
    expect(repo['crearProducto'].mock.calls[1][0].stock_minimo).toBe(10);
    void signal;
  });
});
