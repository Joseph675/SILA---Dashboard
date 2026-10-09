import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, Rol } from '../services/auth.service';

/**
 * `canActivate: [roleGuard('ADMIN')]`. Without the role the user goes to the
 * start page instead of seeing a blank screen. Blocking a route in the
 * browser is a convenience, not security: the API rejects the calls anyway
 * (error 20008).
 */
export function roleGuard(rol: Rol): CanActivateFn {
  // SUPUESTO: no existe aún la página "sin permiso" (20008); se redirige a la raíz.
  return () => inject(AuthService).hasRole(rol) || inject(Router).createUrlTree(['/']);
}
