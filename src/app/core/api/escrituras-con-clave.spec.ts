import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpAcopioRepository } from '../../features/acopio/data/http-acopio.repository';
import { HttpCarteraRepository } from '../../features/cartera/data/http-cartera.repository';
import { HttpDocumentosRepository } from '../../features/documentos/data/http-documentos.repository';
import { HttpGastosRepository } from '../../features/gastos/data/http-gastos.repository';
import { HttpInsumosRepository } from '../../features/insumos/data/http-insumos.repository';
import { HttpProduccionRepository } from '../../features/produccion/data/http-produccion.repository';
import { HttpVentasRepository } from '../../features/ventas/data/http-ventas.repository';

/**
 * Every write method of the repositories whose routes require `Idempotency-Key` must send it, and the one the CALLER gives
 * (the user attempt's key) must be the one that goes out. A new write method added to one of them without the key shows up here.
 */
describe('Repositorios · toda escritura lleva la Idempotency-Key del intento', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const K = 'clave-del-intento-01';
  const casos: [string, () => unknown, string][] = [
    ['acopio.crearRecepcion', () => TestBed.inject(HttpAcopioRepository).crearRecepcion({ id_proveedor: 1, litros: 1, temperatura: 1, acidez: 1 }, K), '/acopio/recepciones'],
    ['acopio.fijarPrecio', () => TestBed.inject(HttpAcopioRepository).fijarPrecio({ id_proveedor: 1, precio_litro: 1900 }, K), '/acopio/precios'],
    ['acopio.registrarPago', () => TestBed.inject(HttpAcopioRepository).registrarPago({ id_proveedor: 1, id_periodo_liquidado: 1, monto: 1, metodo_pago: 'EFECTIVO' }, K), '/acopio/pagos'],
    ['acopio.anularPago', () => TestBed.inject(HttpAcopioRepository).anularPago(1, 'motivo largo', K), '/acopio/pagos/1/anular'],
    ['produccion.crearLote', () => TestBed.inject(HttpProduccionRepository).crearLote({ id_producto: 1, litros_leche_usados: 1, cantidad_obtenida: 1, costo_por_litro: 0 }, K), '/produccion/lotes'],
    ['produccion.crearAjuste', () => TestBed.inject(HttpProduccionRepository).crearAjuste({ id_producto: 1, tipo_ajuste: 'MERMA', cantidad: 1, observacion: 'observación' }, K), '/produccion/ajustes'],
    ['ventas.crear', () => TestBed.inject(HttpVentasRepository).crear({ id_cliente: 1, tipo_venta: 'CREDITO', lineas: [{ id_producto: 1, cantidad: 1 }] }, K), '/ventas'],
    ['ventas.anular', () => TestBed.inject(HttpVentasRepository).anular(1, 'motivo largo', K), '/ventas/1/anular'],
    ['cartera.registrarAbono', () => TestBed.inject(HttpCarteraRepository).registrarAbono({ id_cliente: 1, monto: 1, metodo_pago: 'EFECTIVO' }, K), '/cartera/abonos'],
    ['cartera.castigar', () => TestBed.inject(HttpCarteraRepository).castigar({ id_cliente: 1, motivo: 'motivo largo' }, K), '/cartera/castigos'],
    ['insumos.crearCompra', () => TestBed.inject(HttpInsumosRepository).crearCompra({ id_insumo: 1, cantidad: 1, valor_total: 1 }, K), '/insumos/compras'],
    ['insumos.anularCompra', () => TestBed.inject(HttpInsumosRepository).anularCompra(1, 'motivo largo', K), '/insumos/compras/1/anular'],
    ['insumos.crearAjuste', () => TestBed.inject(HttpInsumosRepository).crearAjuste({ id_insumo: 1, tipo_ajuste: 'MERMA', cantidad: 1, observacion: 'observación' }, K), '/insumos/ajustes'],
    ['gastos.crear', () => TestBed.inject(HttpGastosRepository).crear({ id_categoria: 1, concepto: 'concepto', monto: 1 }, K), '/finanzas/gastos'],
    ['gastos.anular', () => TestBed.inject(HttpGastosRepository).anular(1, 'motivo largo', K), '/finanzas/gastos/1/anular'],
    ['documentos.crear', () => TestBed.inject(HttpDocumentosRepository).crear({ tipo_entidad: 'FACTURA', id_entidad: 1, nombre_archivo: 'a.pdf' }, K), '/documentos'],
    ['documentos.marcarSubido', () => TestBed.inject(HttpDocumentosRepository).marcarSubido(1, { drive_file_id: 'x' }, K), '/documentos/1/subido'],
    ['documentos.marcarError', () => TestBed.inject(HttpDocumentosRepository).marcarError(1, 'fallo', K), '/documentos/1/error'],
  ];

  it.each(casos)('%s envía la clave que recibe (%s)', (_nombre, llamar, ruta) => {
    (llamar() as { subscribe: () => void }).subscribe();
    const req = http.expectOne((r) => new URL(r.url, 'http://host').pathname === `/api/v1${ruta}`);
    expect(req.request.headers.get('Idempotency-Key')).toBe(K);
    req.flush({});
  });
});
