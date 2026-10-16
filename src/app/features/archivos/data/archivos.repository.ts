import type { Observable } from 'rxjs';
import type { RespuestaArchivo } from '../../../core/api/archivo-cabeceras';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { AccesoArchivo, AccesosQuery, Archivo, ArchivosQuery, Carpeta, EstadoDriveRespuesta, Explorador, ExploradorQuery, ModoClave, OpcionesDescarga, TipoEntidadArchivo } from '../models/archivos.models';

/**
 * Data contract of the file manager (through ARCHIVOS_REPOSITORY).
 * NEVER send `Idempotency-Key` on these routes. Errors arrive as `ApiError`: 400 invalid path / password length,
 * 404 not found, 409 conflicts (archived folder, duplicate name, document without ID), 413 too big, 422 (20018) the file is not
 * admitted, 503 (20019) the antivirus does not answer. Their `message` is meant for the user.
 */
export abstract class ArchivosRepository {
  // ---- Reading ----
  abstract explorador(query: ExploradorQuery): Observable<Explorador>;
  abstract listar(query: PageQuery & ArchivosQuery): Observable<Page<Archivo>>;
  abstract obtener(id: number): Observable<Archivo>;
  /** The PDFs of one voucher: `[]`, `[ORIGINAL]` or `[ORIGINAL, ANULADO]`. For an ABONO the `id` is the receipt. */
  abstract deComprobante(tipo: TipoEntidadArchivo, id: number): Observable<Archivo[]>;
  /** The bytes as they are (to see). Logged as `VER`. */
  abstract contenido(id: number): Observable<RespuestaArchivo>;
  abstract opcionesDescarga(id: number): Observable<OpcionesDescarga>;
  /** A password-protected PDF. With `ALEATORIA` the answer carries `claveGenerada` (once). */
  abstract descargar(id: number, modo: ModoClave, clave?: string): Observable<RespuestaArchivo>;
  abstract carpetas(idPadre?: number, incluirArchivadas?: boolean): Observable<Carpeta[]>;
  abstract accesos(query: PageQuery & AccesosQuery): Observable<Page<AccesoArchivo>>;

  // ---- [ADMIN] ----
  /** `multipart`: antivirus + checks happen on the server. */
  abstract subir(archivo: File, idCarpeta?: number): Observable<Archivo>;
  abstract archivar(id: number, motivo: string): Observable<Archivo>;
  abstract crearCarpeta(nombre: string, idPadre: number | null): Observable<Carpeta>;
  abstract archivarCarpeta(id: number, motivo: string): Observable<Carpeta>;
  abstract driveEstado(): Observable<EstadoDriveRespuesta>;
  /** The Google address to send the ADMIN to. */
  abstract driveAutorizar(): Observable<{ url: string }>;
  abstract driveSincronizar(): Observable<EstadoDriveRespuesta>;
  abstract driveDesconectar(): Observable<EstadoDriveRespuesta>;

  // ---- Any user ----
  /** Opens a `.sila` file (from Drive). Answers the ORIGINAL document's bytes. Logged as `DESCIFRAR`. */
  abstract descifrar(archivo: File): Observable<RespuestaArchivo>;
}
