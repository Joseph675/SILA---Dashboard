import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { nuevaClaveIdempotencia } from './idempotencia';

/**
 * Writes under these paths MUST carry `Idempotency-Key` (the API answers 400 without it). Safety net: a repository that
 * forgot to pass one still sends a fresh key. The proper way is still a key per USER ATTEMPT from `ClaveIdempotente`,
 * reused only to retry the same data; the key added here is per call (one per `post(...)`, so an HTTP retry of that same
 * call keeps it).
 */
const ESCRITURA_CON_CLAVE = /^\/?(acopio|produccion|ventas|cartera|documentos|finanzas\/gastos|insumos\/(compras|ajustes))(\/|$)/;

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

/** Per-call extras. `/auth/*` calls use `withCredentials` (refresh cookie) and, for the temporary login tokens, an explicit `Authorization`. */
export interface ApiOpciones {
  headers?: Record<string, string>;
  withCredentials?: boolean;
  /**
   * Sent as `Idempotency-Key`. REQUIRED by sales, portfolio and invoicing writes; accepted by any write.
   * One NEW key per user action, reused only to retry that same action (see `nuevaClaveIdempotencia`).
   */
  idempotencyKey?: string;
}

/**
 * Single point of contact with the backend. Every feature service goes through
 * here instead of injecting HttpClient directly, so the API base URL / version
 * only ever needs to change in `environment.ts`.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/${environment.apiVersion}`;

  get<T>(path: string, params?: QueryParams, opciones?: ApiOpciones): Observable<T> {
    return this.http.get<T>(this.buildUrl(path), { params: this.buildParams(params), ...this.buildOptions(opciones) });
  }

  post<T>(path: string, body: unknown, opciones?: ApiOpciones): Observable<T> {
    return this.http.post<T>(this.buildUrl(path), body, this.buildOptions(this.conClave(path, opciones)));
  }

  put<T>(path: string, body: unknown, opciones?: ApiOpciones): Observable<T> {
    return this.http.put<T>(this.buildUrl(path), body, this.buildOptions(this.conClave(path, opciones)));
  }

  patch<T>(path: string, body: unknown, opciones?: ApiOpciones): Observable<T> {
    return this.http.patch<T>(this.buildUrl(path), body, this.buildOptions(this.conClave(path, opciones)));
  }

  delete<T>(path: string, opciones?: ApiOpciones): Observable<T> {
    return this.http.delete<T>(this.buildUrl(path), this.buildOptions(this.conClave(path, opciones)));
  }

  /** The explicit key of the caller wins; otherwise a write that requires one gets a fresh `randomUUID()`. */
  private conClave(path: string, opciones?: ApiOpciones): ApiOpciones | undefined {
    if (opciones?.idempotencyKey || !ESCRITURA_CON_CLAVE.test(path)) return opciones;
    return { ...opciones, idempotencyKey: nuevaClaveIdempotencia() };
  }

  /** Turns `idempotencyKey` into its header and leaves the rest as HttpClient options. */
  private buildOptions(opciones?: ApiOpciones): { headers?: Record<string, string>; withCredentials?: boolean } {
    if (!opciones) return {};
    const { idempotencyKey, headers, withCredentials } = opciones;
    const todas = idempotencyKey ? { ...headers, 'Idempotency-Key': idempotencyKey } : headers;
    return { ...(todas ? { headers: todas } : {}), ...(withCredentials !== undefined ? { withCredentials } : {}) };
  }

  private buildUrl(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
  }

  private buildParams(params?: QueryParams): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null) {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }
}
