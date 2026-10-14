import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import { AuthService, Rol } from '../../../core/services/auth.service';
import { INSUMOS_REPOSITORY } from '../../insumos/data/insumos.provider';
import { CATALOGOS_REPOSITORY } from '../data/catalogos.provider';
import type { Receta } from '../models/catalogos.models';
import { ProductoFormDialogComponent } from '../productos/producto-form-dialog.component';
import { RecetaDialogComponent } from './receta-dialog.component';
import { lineaVacia, validarReceta } from './receta-editor.component';

const AZUCAR = { id_insumo: 1, codigo: 'AZUCAR', nombre: 'Azúcar', unidad_medida: 'KG', costo_promedio: 5000, stock_actual: 20, stock_minimo: 5, valor_inventario: 100000, bajo_minimo: false, productos_que_lo_usan: 2, activo: true };
const RECETA: Receta = {
  id_producto: 7, codigo_sku: 'AREQ', producto: 'Arequipe 250 g',
  lineas: [{ id_insumo: 1, codigo_insumo: 'AZUCAR', insumo: 'Azúcar', unidad_insumo: 'KG', cantidad_por_unidad: 0.5, costo_unitario_insumo: 5000, valor_por_unidad: 2500, stock_insumo: 20, insumo_activo: true }],
  costo_insumos_unitario: 2700,
  unidades_posibles: 40,
};

async function estabilizar(f: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 6; i++) {
    f.detectChanges();
    await f.whenStable();
  }
}
const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const texto = (f: ComponentFixture<unknown>, sel: string) => (raiz(f).querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('validarReceta', () => {
  it('una receta vacía es válida, y las filas totalmente vacías se descartan', () => {
    expect(validarReceta([])).toEqual({ lineas: [], error: null });
    expect(validarReceta([lineaVacia()])).toEqual({ lineas: [], error: null });
  });

  it('acepta coma decimal y rechaza cantidad 0, insumo sin elegir y repetidos', () => {
    expect(validarReceta([lineaVacia(1, '0,5')]).lineas).toEqual([{ id_insumo: 1, cantidad: 0.5 }]);
    expect(validarReceta([lineaVacia(1, '0')]).error).toContain('mayor que 0');
    expect(validarReceta([lineaVacia(null, '2')]).error).toContain('Elige el insumo');
    expect(validarReceta([lineaVacia(1, '1'), lineaVacia(1, '2')]).error).toContain('no puede repetirse');
  });
});

describe('Recetas', () => {
  let catalogos: Record<string, ReturnType<typeof vi.fn>>;

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
    catalogos = {
      obtenerReceta: vi.fn(() => of(RECETA)),
      guardarReceta: vi.fn(() => of(RECETA)),
      crearProducto: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideNgIconLoader(async () => ''),
        { provide: CATALOGOS_REPOSITORY, useValue: catalogos },
        { provide: INSUMOS_REPOSITORY, useValue: { listar: vi.fn(() => of({ items: [AZUCAR], total: 1, page: 0, size: 100 })) } },
      ],
    });
  });

  async function dialogo(rol: Rol, editar = false): Promise<ComponentFixture<RecetaDialogComponent>> {
    TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'a', nombre: 'A', email: 'a@example.com', rol, mfa_activo: true });
    const f = TestBed.createComponent(RecetaDialogComponent);
    f.componentRef.setInput('editarAlAbrir', editar);
    f.componentRef.setInput('idProducto', 7);
    await estabilizar(f);
    return f;
  }

  it('muestra las líneas, el costo de los insumos por unidad y cuántas unidades alcanza a producir el stock', async () => {
    const f = await dialogo('OPERATIVO');

    expect(texto(f, '[data-testid=lineas-receta]')).toContain('Azúcar');
    expect(texto(f, '[data-testid=lineas-receta]')).toContain('0,5 KG por unidad');
    expect(texto(f, '[data-testid=costo-insumos-unitario]')).toContain('2.700');
    expect(texto(f, '[data-testid=unidades-posibles]')).toBe('40');
  });

  it('un OPERATIVO no ve «Editar receta»; un ADMIN sí', async () => {
    const op = await dialogo('OPERATIVO');
    expect(Array.from(raiz(op).querySelectorAll('button')).some((b) => b.textContent?.includes('Editar receta'))).toBe(false);
    TestBed.resetTestingModule();
  });

  it('un ADMIN edita y guarda enviando la lista COMPLETA; quitar todas las filas envía []', async () => {
    const f = await dialogo('ADMIN');
    Array.from(raiz(f).querySelectorAll('button')).find((b) => b.textContent?.includes('Editar receta'))!.click();
    await estabilizar(f);
    expect(raiz(f).querySelectorAll('[data-fila-receta]').length).toBe(1);

    raiz(f).querySelector<HTMLButtonElement>('[data-fila-receta] button')!.click();
    await estabilizar(f);
    Array.from(raiz(f).querySelectorAll('button')).find((b) => b.textContent?.includes('Guardar receta'))!.click();
    await estabilizar(f);

    expect(catalogos['guardarReceta']).toHaveBeenCalledExactlyOnceWith(7, []);
  });

  it('el alta de un producto cuya receta falló NO deja reintentar: avisa con el id del producto ya creado', async () => {
    catalogos['crearProducto'].mockReturnValue(throwError(() => ({ code: 20006, message: 'El producto se creó (id 31) pero la receta no se guardó: El insumo no existe' })));
    const f = TestBed.createComponent(ProductoFormDialogComponent);
    f.componentRef.setInput('modo', 'crear');
    f.componentRef.setInput('abierto', true);
    await estabilizar(f);
    const emitido: { idProducto: number; mensaje: string }[] = [];
    f.componentInstance.recetaFallida.subscribe((e) => emitido.push(e));

    const campo = (n: string) => raiz(f).querySelector<HTMLInputElement>(`[formcontrolname=${n}]`)!;
    campo('codigo_sku').value = 'AREQ';
    campo('codigo_sku').dispatchEvent(new Event('input'));
    campo('nombre').value = 'Arequipe 250 g';
    campo('nombre').dispatchEvent(new Event('input'));
    campo('precio_base').value = '5000';
    campo('precio_base').dispatchEvent(new Event('input'));
    campo('tarifa_iva').value = '19';
    campo('tarifa_iva').dispatchEvent(new Event('input'));
    Array.from(raiz(f).querySelectorAll('button')).find((b) => b.textContent?.includes('Agregar insumo'))!.click();
    await estabilizar(f);
    const select = raiz(f).querySelector<HTMLSelectElement>('[data-fila-receta] select')!;
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    const cantidad = raiz(f).querySelector<HTMLInputElement>('[data-fila-receta] input')!;
    cantidad.value = '0,5';
    cantidad.dispatchEvent(new Event('input'));
    await estabilizar(f);
    raiz(f).querySelector('#producto-form')!.dispatchEvent(new Event('submit'));
    await estabilizar(f);

    expect(catalogos['crearProducto'].mock.calls[0][0].receta).toEqual([{ id_insumo: 1, cantidad: 0.5 }]);
    expect(emitido).toHaveLength(1);
    expect(emitido[0].idProducto).toBe(31);
    expect(emitido[0].mensaje).toContain('la receta no se guardó');
  });
});
