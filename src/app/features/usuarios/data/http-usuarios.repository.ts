import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { SesionAbierta } from '../../../core/auth/auth.models';
import type { Page } from '../../../core/api/page.models';
import type { Usuario, UsuarioActualizar, UsuarioConClaveTemporal, UsuarioCrear, UsuariosQuery } from '../models/usuarios.models';
import { UsuariosRepository } from './usuarios.repository';

const BASE = 'usuarios';

/** HTTP implementation: `{apiBaseUrl}/api/v1/usuarios...`. JSON is snake_case on both sides. */
@Injectable({ providedIn: 'root' })
export class HttpUsuariosRepository extends UsuariosRepository {
  private readonly api = inject(ApiService);

  listar(query: UsuariosQuery): Observable<Page<Usuario>> {
    return this.api.get<Page<Usuario>>(BASE, { ...query });
  }
  crear(datos: UsuarioCrear): Observable<UsuarioConClaveTemporal> {
    return this.api.post<UsuarioConClaveTemporal>(BASE, datos);
  }
  actualizar(id: number, datos: UsuarioActualizar): Observable<Usuario> {
    return this.api.put<Usuario>(`${BASE}/${id}`, datos);
  }
  cambiarEstado(id: number, activo: boolean): Observable<Usuario> {
    return this.api.patch<Usuario>(`${BASE}/${id}/estado`, { activo });
  }
  desbloquear(id: number): Observable<Usuario> {
    return this.api.post<Usuario>(`${BASE}/${id}/desbloquear`, null);
  }
  restablecerClave(id: number): Observable<UsuarioConClaveTemporal> {
    return this.api.post<UsuarioConClaveTemporal>(`${BASE}/${id}/restablecer-clave`, null);
  }
  restablecerMfa(id: number): Observable<Usuario> {
    return this.api.post<Usuario>(`${BASE}/${id}/restablecer-mfa`, null);
  }
  sesiones(id: number): Observable<SesionAbierta[]> {
    return this.api.get<SesionAbierta[]>(`${BASE}/${id}/sesiones`);
  }
  cerrarSesiones(id: number): Observable<Usuario> {
    return this.api.post<Usuario>(`${BASE}/${id}/cerrar-sesiones`, null);
  }
}
