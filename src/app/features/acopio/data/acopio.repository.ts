import type { Observable } from 'rxjs';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type {
  CalidadProveedor,
  FijarPrecioLeche,
  NuevoPagoLechero,
  PagoProveedor,
  PagosQuery,
  PrecioProveedor,
  PreciosQuery,
  SaldoProveedor,
  SaldosQuery,
  NuevaRecepcion,
  PagoLechero,
  PagoLecherosQuery,
  Recepcion,
  RecepcionesQuery,
  Umbrales,
} from '../models/acopio.models';

/**
 * Data contract of the Recepción de leche screen (through ACOPIO_REPOSITORY).
 *
 * Errors arrive as `ApiError`: 20001 invalid data (`fields`), 20004 closed quincena,
 * 20006 provider not active / not LECHERO, 20008 role, 20016 same request in process,
 * 20017 same key with other data.
 */
export abstract class AcopioRepository {
  abstract listarRecepciones(query: PageQuery & RecepcionesQuery): Observable<Page<Recepcion>>;
  /**
   * Requires `Idempotency-Key`. A quality REJECTION is not an error: it answers 201 with
   * `estado_calidad: 'RECHAZADO'` and the reason.
   */
  abstract crearRecepcion(datos: NuevaRecepcion, claveIdempotencia: string): Observable<Recepcion>;
  abstract umbrales(): Observable<Umbrales>;
  abstract calidad(query: PageQuery): Observable<Page<CalidadProveedor>>;
  abstract pagoLecheros(query: PageQuery & PagoLecherosQuery): Observable<Page<PagoLechero>>;

  abstract listarPrecios(query: PageQuery & PreciosQuery): Observable<Page<PrecioProveedor>>;
  /** [ADMIN] Only affects NEW deliveries. Requires `Idempotency-Key` (like every write under /acopio). */
  abstract fijarPrecio(datos: FijarPrecioLeche, claveIdempotencia: string): Observable<PrecioProveedor>;
  abstract saldos(query: PageQuery & SaldosQuery): Observable<Page<SaldoProveedor>>;
  abstract listarPagos(query: PageQuery & PagosQuery): Observable<Page<PagoProveedor>>;
  /** [ADMIN] Requires `Idempotency-Key`. 400 / 20005 when the amount exceeds the quincena's balance. */
  abstract registrarPago(datos: NuevoPagoLechero, claveIdempotencia: string): Observable<PagoProveedor>;
  /** [ADMIN] Requires `Idempotency-Key`. Reason of 10 to 255 characters. */
  abstract anularPago(id: number, motivo: string, claveIdempotencia: string): Observable<PagoProveedor>;
}
