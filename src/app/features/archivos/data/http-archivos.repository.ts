import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { RespuestaArchivo } from '../../../core/api/archivo-cabeceras';
import { ApiService } from '../../../core/api/api.service';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { AccesoArchivo, AccesosQuery, Archivo, ArchivosQuery, Carpeta, EstadoDriveRespuesta, Explorador, ExploradorQuery, ModoClave, OpcionesDescarga, TipoEntidadArchivo } from '../models/archivos.models';
import { ArchivosRepository } from './archivos.repository';

const BASE = 'archivos';

/**
 * HTTP implementation: `{apiBaseUrl}/api/v1/archivos/...`. No call here sends `Idempotency-Key`.
 * `ruta` is a REPEATED query parameter (`?ruta=VENTA&ruta=2026`), which `ApiService.get` (one value per key) cannot express,
 * so it is put in the path as a query string by hand (each key URL-encoded).
 */
@Injectable({ providedIn: 'root' })
export class HttpArchivosRepository extends ArchivosRepository {
  private readonly api = inject(ApiService);

  explorador(query: ExploradorQuery): Observable<Explorador> {
    const { ruta, ...resto } = query;
    const repetidos = (ruta ?? []).map((clave) => `ruta=${encodeURIComponent(clave)}`).join('&');
    return this.api.get<Explorador>(`${BASE}/explorador${repetidos ? `?${repetidos}` : ''}`, { ...resto });
  }

  listar(query: PageQuery & ArchivosQuery): Observable<Page<Archivo>> {
    return this.api.get<Page<Archivo>>(BASE, { ...query });
  }

  obtener(id: number): Observable<Archivo> {
    return this.api.get<Archivo>(`${BASE}/${id}`);
  }

  deComprobante(tipo: TipoEntidadArchivo, id: number): Observable<Archivo[]> {
    return this.api.get<Archivo[]>(`${BASE}/comprobante/${tipo}/${id}`);
  }

  contenido(id: number): Observable<RespuestaArchivo> {
    return this.api.getBlob(`${BASE}/${id}/contenido`);
  }

  opcionesDescarga(id: number): Observable<OpcionesDescarga> {
    return this.api.get<OpcionesDescarga>(`${BASE}/${id}/opciones-descarga`);
  }

  descargar(id: number, modo: ModoClave, clave?: string): Observable<RespuestaArchivo> {
    return this.api.postBlob(`${BASE}/${id}/descarga`, modo === 'ESCRITA' ? { modo_clave: modo, clave } : { modo_clave: modo });
  }

  carpetas(idPadre?: number, incluirArchivadas = false): Observable<Carpeta[]> {
    return this.api.get<Carpeta[]>(`${BASE}/carpetas`, { id_padre: idPadre, incluir_archivadas: incluirArchivadas || undefined });
  }

  accesos(query: PageQuery & AccesosQuery): Observable<Page<AccesoArchivo>> {
    return this.api.get<Page<AccesoArchivo>>(`${BASE}/accesos`, { ...query });
  }

  subir(archivo: File, idCarpeta?: number): Observable<Archivo> {
    const datos = new FormData();
    datos.append('archivo', archivo, archivo.name);
    if (idCarpeta !== undefined) datos.append('id_carpeta', String(idCarpeta));
    return this.api.postFormData<Archivo>(BASE, datos);
  }

  archivar(id: number, motivo: string): Observable<Archivo> {
    return this.api.post<Archivo>(`${BASE}/${id}/archivar`, { motivo });
  }

  crearCarpeta(nombre: string, idPadre: number | null): Observable<Carpeta> {
    return this.api.post<Carpeta>(`${BASE}/carpetas`, { id_padre: idPadre, nombre });
  }

  archivarCarpeta(id: number, motivo: string): Observable<Carpeta> {
    return this.api.post<Carpeta>(`${BASE}/carpetas/${id}/archivar`, { motivo });
  }

  driveEstado(): Observable<EstadoDriveRespuesta> {
    return this.api.get<EstadoDriveRespuesta>(`${BASE}/drive/estado`);
  }

  driveAutorizar(): Observable<{ url: string }> {
    return this.api.get<{ url: string }>(`${BASE}/drive/autorizar`);
  }

  driveSincronizar(): Observable<EstadoDriveRespuesta> {
    return this.api.post<EstadoDriveRespuesta>(`${BASE}/drive/sincronizar`, null);
  }

  driveDesconectar(): Observable<EstadoDriveRespuesta> {
    return this.api.post<EstadoDriveRespuesta>(`${BASE}/drive/desconectar`, null);
  }

  descifrar(archivo: File): Observable<RespuestaArchivo> {
    const datos = new FormData();
    datos.append('archivo', archivo, archivo.name);
    return this.api.postFormDataBlob(`${BASE}/descifrar`, datos);
  }
}
