import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { AuthService, Rol } from '../../core/services/auth.service';
import { AjusteDialogComponent } from './ajuste-dialog.component';
import { PRODUCCION_REPOSITORY } from './data/produccion.provider';
import type { ProductoOpcion } from './models/ajuste-tipos';

const PRODUCTOS: ProductoOpcion[] = [{ id_producto: 3, nombre: 'Queso campesino', codigo_sku: 'QSO', unidad_medida: 'KG', stock: 12 }];

describe('AjusteDialogComponent', () => {
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
    TestBed.configureTestingModule({
      providers: [provideNgIconLoader(async () => ''), { provide: PRODUCCION_REPOSITORY, useValue: {} }],
    });
  });

  async function crear(rol: Rol): Promise<ComponentFixture<AjusteDialogComponent>> {
    TestBed.inject(AuthService).sesion.set({ id_usuario: 1, usuario: 'prueba', nombre: 'Prueba', email: 'prueba@example.com', rol, mfa_activo: false });
    const fixture = TestBed.createComponent(AjusteDialogComponent);
    fixture.componentRef.setInput('productos', PRODUCTOS);
    fixture.componentRef.setInput('abierto', true);
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    return fixture;
  }

  const tipos = (fixture: ComponentFixture<unknown>) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLOptionElement>('select option'))
      .filter((o) => o.value !== '')
      .map((o) => o.value);

  it('un OPERATIVO solo puede elegir los 4 tipos que restan stock', async () => {
    const fixture = await crear('OPERATIVO');

    expect(tipos(fixture)).toEqual(['MERMA', 'DANO', 'VENCIMIENTO', 'MUESTRA']);
  });

  it('un ADMIN puede elegir los 7 tipos, con los de solo administrador en su propio grupo', async () => {
    const fixture = await crear('ADMIN');

    expect(tipos(fixture)).toEqual(['MERMA', 'DANO', 'VENCIMIENTO', 'MUESTRA', 'INGRESO_INICIAL', 'CORRECCION_MAS', 'CORRECCION_MENOS']);
    expect(fixture.nativeElement.querySelectorAll('select optgroup').length).toBe(2);
  });
});
