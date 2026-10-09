import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { ACOPIO_REPOSITORY } from './data/acopio.provider';
import { RecepcionDialogComponent } from './recepcion-dialog.component';

describe('RecepcionDialogComponent · aviso de umbrales', () => {
  beforeAll(() => {
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
    TestBed.configureTestingModule({ providers: [provideNgIconLoader(async () => ''), { provide: ACOPIO_REPOSITORY, useValue: {} }] });
  });

  async function crear(): Promise<ComponentFixture<RecepcionDialogComponent>> {
    const fixture = TestBed.createComponent(RecepcionDialogComponent);
    fixture.componentRef.setInput('proveedores', []);
    fixture.componentRef.setInput('umbrales', { temperatura_max: 10, acidez_max: 18 });
    fixture.componentRef.setInput('abierto', true);
    await estabilizar(fixture);
    return fixture;
  }

  async function estabilizar(fixture: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  async function escribir(fixture: ComponentFixture<unknown>, control: string, valor: string): Promise<void> {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`[formcontrolname="${control}"]`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    await estabilizar(fixture);
  }

  const aviso = (fixture: ComponentFixture<unknown>) => (fixture.nativeElement as HTMLElement).querySelector('[data-testid="aviso-rechazo"]');

  it('sin superar los umbrales no hay aviso', async () => {
    const fixture = await crear();
    await escribir(fixture, 'temperatura', '10');
    await escribir(fixture, 'acidez', '18');

    expect(aviso(fixture)).toBeNull();
  });

  it('avisa que será RECHAZADA cuando la temperatura supera el máximo, sin bloquear el envío', async () => {
    const fixture = await crear();
    await escribir(fixture, 'temperatura', '10.5');

    expect(aviso(fixture)?.textContent).toContain('Esta entrega será RECHAZADA y no se pagará');
    expect(aviso(fixture)?.textContent).toContain('temperatura');
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });

  it('avisa también cuando la acidez supera el máximo', async () => {
    const fixture = await crear();
    await escribir(fixture, 'acidez', '19');

    expect(aviso(fixture)?.textContent).toContain('acidez');
  });
});
