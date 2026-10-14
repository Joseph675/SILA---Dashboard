import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { Page, PageQuery } from '../../../core/api/page.models';
import type { Documento, DocumentoSubido, DocumentosQuery, EstadoCarga, NuevoDocumento } from '../models/documentos.models';
import { DocumentosRepository } from './documentos.repository';

const BASE = 'documentos';

/** HTTP implementation: `{apiBaseUrl}/api/v1/documentos...`. */
@Injectable({ providedIn: 'root' })
export class HttpDocumentosRepository extends DocumentosRepository {
  private readonly api = inject(ApiService);

  listar(query: PageQuery & DocumentosQuery): Observable<Page<Documento>> {
    return this.api.get<Page<Documento>>(BASE, { ...query });
  }

  pendientes(estado?: EstadoCarga): Observable<Documento[]> {
    return this.api.get<Documento[]>(`${BASE}/pendientes`, { estado });
  }

  crear(datos: NuevoDocumento, claveIdempotencia: string): Observable<Documento> {
    return this.api.post<Documento>(BASE, datos, { idempotencyKey: claveIdempotencia });
  }

  marcarSubido(id: number, datos: DocumentoSubido, claveIdempotencia: string): Observable<Documento> {
    return this.api.post<Documento>(`${BASE}/${id}/subido`, datos, { idempotencyKey: claveIdempotencia });
  }

  marcarError(id: number, mensaje: string, claveIdempotencia: string): Observable<Documento> {
    return this.api.post<Documento>(`${BASE}/${id}/error`, { mensaje }, { idempotencyKey: claveIdempotencia });
  }
}
