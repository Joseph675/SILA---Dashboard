import type { Observable } from 'rxjs';
import type { SesionAbierta } from '../../../core/auth/auth.models';
import type { Page } from '../../../core/api/page.models';
import type { Usuario, UsuarioActualizar, UsuarioConClaveTemporal, UsuarioCrear, UsuariosQuery } from '../models/usuarios.models';

/**
 * Data contract of the Usuarios screen (everything is ADMIN-only).
 *
 * Errors arrive as `ApiError`: 20001 invalid data, 20006 duplicate user or a
 * rule of the base (nobody can deactivate themselves, change their own role or
 * reset their own password/MFA, and one active ADMIN must always remain),
 * 20007 not found, 20008 insufficient role.
 */
export abstract class UsuariosRepository {
  abstract listar(query: UsuariosQuery): Observable<Page<Usuario>>;
  abstract crear(datos: UsuarioCrear): Observable<UsuarioConClaveTemporal>;
  abstract actualizar(id: number, datos: UsuarioActualizar): Observable<Usuario>;
  abstract cambiarEstado(id: number, activo: boolean): Observable<Usuario>;
  abstract desbloquear(id: number): Observable<Usuario>;
  abstract restablecerClave(id: number): Observable<UsuarioConClaveTemporal>;
  abstract restablecerMfa(id: number): Observable<Usuario>;
  /** Open sessions of that person (no `actual` flag: it is not the admin's own list). */
  abstract sesiones(id: number): Observable<SesionAbierta[]>;
  /** Closes all their sessions; their access token stops working within seconds. Allowed on oneself. */
  abstract cerrarSesiones(id: number): Observable<Usuario>;
}
