import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNgIconLoader } from '@ng-icons/core';
import { of, throwError } from 'rxjs';
import { PERIODOS_REPOSITORY } from '../periodos/data/periodos.provider';
import { ComprobanteDetalleDialogComponent } from './comprobante-detalle-dialog.component';
import { ComprobantesPageComponent } from './comprobantes-page.component';
import { COMPROBANTES_REPOSITORY } from './data/comprobantes.provider';
import type { Comprobante, ComprobanteDetalle } from './models/comprobantes.models';

const VENTA: Comprobante = { tipo: 'VENTA', id_documento: 123, numero: 'VENTA #123', sentido: 'INGRESO', afecta_caja: true, fecha: '2026-10-13', monto: 119000, id_tercero: 5, tercero_tipo: 'CLIENTE', tercero: 'Tienda La Esquina', descripcion: 'Venta de contado', metodo_pago: 'VARIOS', referencia: null, estado: 'VIGENTE', motivo_anulacion: null, id_periodo: 19, usuario_registro: 'ana' };
const GASTO_ANULADO: Comprobante = { ...VENTA, tipo: 'GASTO', id_documento: 8, numero: 'GASTO #8', sentido: 'EGRESO', monto: 85000, tercero_tipo: null, tercero: null, descripcion: 'Diésel', metodo_pago: null, estado: 'ANULADO', motivo_anulacion: 'Monto equivocado' };
const CREDITO: Comprobante = { ...VENTA, id_documento: 124, numero: 'VENTA #124', afecta_caja: false, metodo_pago: null };

const DETALLE_VENTA: ComprobanteDetalle = {
  comprobante: VENTA,
  lineas: [{ concepto: 'Queso doble crema', cantidad: 2, valor_unitario: 50000, valor: 100000 }],
  pagos: [{ metodo_pago: 'EFECTIVO', monto: 69000, referencia: null }, { metodo_pago: 'TRANSFERENCIA', monto: 50000, referencia: 'TR-889' }],
  subtotal: 100000,
  iva: 19000,
};
const DETALLE_GASTO: ComprobanteDetalle = { comprobante: GASTO_ANULADO, lineas: [{ concepto: 'Diésel', cantidad: null, valor_unitario: null, valor: 85000 }], pagos: [], subtotal: null, iva: null };

async function estabilizar(f: { detectChanges: () => void; whenStable: () => Promise<unknown> } | ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 8; i++) {
    f.detectChanges();
    await f.whenStable();
  }
}
const limpio = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

describe('Comprobantes', () => {
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
      listar: vi.fn(() => of({ items: [VENTA, GASTO_ANULADO, CREDITO], total: 3, page: 0, size: 10 })),
      resumen: vi.fn(() => of({ ingresos: 119000, egresos: 0, neto: 119000, cantidad: 2 })),
      detalle: vi.fn((tipo: string) => of(tipo === 'VENTA' ? DETALLE_VENTA : DETALLE_GASTO)),
    };
    TestBed.configureTestingModule({
      providers: [
        provideNgIconLoader(async () => ''),
        provideRouter([{ path: 'comprobantes', component: ComprobantesPageComponent }]),
        { provide: COMPROBANTES_REPOSITORY, useValue: repo },
        { provide: PERIODOS_REPOSITORY, useValue: { listar: vi.fn(() => of({ items: [{ id_periodo: 19, anio: 2026, mes: 10, quincena: 1 }], total: 1, page: 0, size: 50 })), actual: vi.fn(() => of({ id_periodo: 19 })) } },
      ],
    });
  });

  async function pagina(url = '/comprobantes') {
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl(url);
    await estabilizar(h.fixture);
    return h;
  }
  const raiz = (h: RouterTestingHarness) => h.routeNativeElement as HTMLElement;

  describe('pantalla', () => {
    it('las tarjetas muestran ingresos, egresos, neto y cantidad del servidor, con la aclaración de vigentes y crédito', async () => {
      const h = await pagina();
      const t = (id: string) => limpio(raiz(h).querySelector(`[data-testid=${id}]`)?.textContent);

      expect(t('resumen-ingresos')).toContain('119.000');
      expect(t('resumen-egresos')).toContain('0');
      expect(t('resumen-neto')).toContain('119.000');
      expect(t('resumen-cantidad')).toBe('2');
      expect(limpio(raiz(h).querySelector('[data-testid=resumen-comprobantes]')?.textContent)).toContain('a crédito no entra a caja hasta que se abona');
    });

    it('ingresos con «+» en verde, egresos con «−», anulados tachados y con el motivo; la venta a crédito lo indica', async () => {
      const h = await pagina();
      const filas = raiz(h).querySelectorAll('tbody tr');
      const monto = (i: number) => filas[i].querySelector<HTMLElement>('[data-testid=monto-comprobante]')!;

      expect(limpio(monto(0).textContent)).toMatch(/^\+ \$/);
      expect(monto(0).classList.contains('text-success')).toBe(true);
      expect(limpio(monto(1).textContent).startsWith('−')).toBe(true);
      expect(monto(1).classList.contains('text-destructive')).toBe(true);
      expect(monto(1).classList.contains('line-through')).toBe(true);
      expect(filas[1].textContent).toContain('Anulado');
      expect(filas[1].querySelector('[title="Motivo: Monto equivocado"]')).toBeTruthy();
      expect(filas[2].textContent).toContain('A crédito');
    });

    it('los filtros viajan a la lista Y al resumen, y el resumen no lleva «estado»', async () => {
      const h = await pagina('/comprobantes?tipo=VENTA&sentido=INGRESO&estado=ANULADO&periodo=19&desde=2026-10-01&hasta=2026-10-13&q=pérez');

      const lista = repo['listar'].mock.calls.at(-1)![0];
      const resumen = repo['resumen'].mock.calls.at(-1)![0];
      expect(lista).toMatchObject({ tipo: 'VENTA', sentido: 'INGRESO', estado: 'ANULADO', id_periodo: 19, desde: '2026-10-01', hasta: '2026-10-13', texto: 'pérez' });
      expect(resumen).toMatchObject({ tipo: 'VENTA', sentido: 'INGRESO', id_periodo: 19, desde: '2026-10-01', hasta: '2026-10-13', texto: 'pérez' });
      expect('estado' in resumen && resumen.estado !== undefined).toBe(false);
      expect(raiz(h).querySelector<HTMLSelectElement>('#comp-tipo')!.value).toBe('VENTA');
      expect(raiz(h).querySelector<HTMLInputElement>('#comp-texto')!.value).toBe('pérez');
    });

    it('un valor inválido en la URL se ignora (nunca llega al servidor)', async () => {
      await pagina('/comprobantes?tipo=FACTURA&sentido=XX&periodo=abc');

      const lista = repo['listar'].mock.calls.at(-1)![0];
      expect(lista.tipo).toBeUndefined();
      expect(lista.sentido).toBeUndefined();
      expect(lista.id_periodo).toBeUndefined();
    });

    it('al cambiar un filtro se escribe en la URL y la lista se vuelve a pedir', async () => {
      const h = await pagina();
      const sel = raiz(h).querySelector<HTMLSelectElement>('#comp-tipo')!;
      sel.value = 'GASTO';
      sel.dispatchEvent(new Event('change'));
      await estabilizar(h.fixture);

      expect(TestBed.inject(Router).url).toContain('tipo=GASTO');
      expect(repo['listar'].mock.calls.at(-1)![0].tipo).toBe('GASTO');
    });

    it('la búsqueda de texto espera 300 ms y se guarda en la URL como «q»', async () => {
      vi.useFakeTimers();
      try {
        const h = await pagina();
        const input = raiz(h).querySelector<HTMLInputElement>('#comp-texto')!;
        input.value = 'diesel';
        input.dispatchEvent(new Event('input'));
        await estabilizar(h.fixture);
        expect(TestBed.inject(Router).url).not.toContain('q=');

        await vi.advanceTimersByTimeAsync(350);
        await estabilizar(h.fixture);
        expect(TestBed.inject(Router).url).toContain('q=diesel');
        expect(repo['listar'].mock.calls.at(-1)![0].texto).toBe('diesel');
      } finally {
        vi.useRealTimers();
      }
    });

    it('«Ver» abre el detalle y lo deja en la URL (?ver=); «Cerrar» lo quita', async () => {
      const h = await pagina();
      raiz(h).querySelector<HTMLButtonElement>('[data-testid=abrir-comprobante]')!.click();
      await estabilizar(h.fixture);

      expect(TestBed.inject(Router).url).toContain('ver=VENTA-123');
      expect(repo['detalle']).toHaveBeenCalledWith('VENTA', 123);
      expect(limpio(raiz(h).querySelector('[data-testid=numero-comprobante]')?.textContent)).toBe('VENTA #123');

      Array.from(raiz(h).querySelectorAll('dialog button')).find((b) => b.textContent?.includes('Cerrar') && !b.classList.contains('h-8'))!.dispatchEvent(new Event('click'));
      await estabilizar(h.fixture);
      expect(TestBed.inject(Router).url).not.toContain('ver=');
    });

    it('un enlace «Ver comprobante» de otra pantalla (?ver=ABONO-77) abre ese comprobante con el id del recibo', async () => {
      await pagina('/comprobantes?ver=ABONO-77');

      expect(repo['detalle']).toHaveBeenCalledWith('ABONO', 77);
    });
  });

  describe('detalle', () => {
    async function dialogo(documento: { tipo: 'VENTA' | 'GASTO'; id: number }): Promise<ComponentFixture<ComprobanteDetalleDialogComponent>> {
      const f = TestBed.createComponent(ComprobanteDetalleDialogComponent);
      f.componentRef.setInput('documento', documento);
      await estabilizar(f);
      return f;
    }
    const t = (f: ComponentFixture<unknown>, sel: string) => limpio((f.nativeElement as HTMLElement).querySelector(sel)?.textContent);

    it('una venta muestra encabezado, líneas, subtotal, IVA, total y pagos', async () => {
      const f = await dialogo({ tipo: 'VENTA', id: 123 });

      expect(t(f, '[data-testid=numero-comprobante]')).toBe('VENTA #123');
      expect(limpio((f.nativeElement as HTMLElement).textContent)).toContain('Tienda La Esquina');
      expect(limpio((f.nativeElement as HTMLElement).textContent)).toContain('Queso doble crema');
      expect(t(f, '[data-testid=subtotal]')).toContain('100.000');
      expect(t(f, '[data-testid=iva]')).toContain('19.000');
      expect(t(f, '[data-testid=total-comprobante]')).toContain('119.000');
      expect(t(f, '[data-testid=pagos-comprobante]')).toContain('Transferencia');
      expect(t(f, '[data-testid=pagos-comprobante]')).toContain('TR-889');
    });

    it('un gasto no muestra subtotal ni IVA, y uno anulado muestra el motivo', async () => {
      const f = await dialogo({ tipo: 'GASTO', id: 8 });

      expect(f.nativeElement.querySelector('[data-testid=subtotal]')).toBeNull();
      expect(f.nativeElement.querySelector('[data-testid=iva]')).toBeNull();
      expect(t(f, '[data-testid=aviso-anulado]')).toContain('Monto equivocado');
    });

    it('una línea sin cantidad ni valor unitario (gasto, abono, pago) muestra «—», no «$ 0»', async () => {
      const f = await dialogo({ tipo: 'GASTO', id: 8 });
      const celdas = Array.from((f.nativeElement as HTMLElement).querySelectorAll('tbody tr td')).map((td) => limpio(td.textContent));

      expect(celdas).toEqual(['Diésel', '—', '—', expect.stringContaining('85.000')]);
    });

    it('todo comprobante dice «Comprobante interno — no es factura electrónica» y trae el encabezado de impresión', async () => {
      const f = await dialogo({ tipo: 'VENTA', id: 123 });

      expect(t(f, '[data-testid=aviso-interno]')).toBe('Comprobante interno — no es factura electrónica.');
      expect(f.nativeElement.querySelector('.zona-impresion-ticket .print\\:block')?.textContent).toContain('Llanolat');
      expect(limpio((f.nativeElement as HTMLElement).textContent)).not.toMatch(/factura (?!electrónica)/i);
    });

    it('Imprimir usa la impresión de ticket (solo se imprime el comprobante)', async () => {
      const imprimir = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      const f = await dialogo({ tipo: 'VENTA', id: 123 });
      Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Imprimir'))!.click();

      expect(imprimir).toHaveBeenCalled();
      expect(document.body.classList.contains('imprimiendo-ticket')).toBe(true);
      document.body.classList.remove('imprimiendo-ticket');
    });

    it('si no existe (404) muestra el error y permite reintentar', async () => {
      repo['detalle'].mockReturnValue(throwError(() => ({ status: 404, error: { code: 20007, message: 'No existe' } })));
      const f = await dialogo({ tipo: 'VENTA', id: 999 });

      expect(f.nativeElement.querySelector('[data-testid=error-comprobante]')).toBeTruthy();
      expect(Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).some((b) => b.textContent?.includes('Reintentar'))).toBe(true);
    });
  });
});
