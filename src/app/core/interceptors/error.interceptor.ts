import { HttpErrorResponse, HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { ApiError, ERROR_SIN_CODIGO } from '../api/api-error';
import { esRutaAuth } from '../auth/rutas-auth';
import { AuthService } from '../services/auth.service';

/** Code of "not authenticated": no token, expired or altered token, wrong credentials or MFA code. */
const NO_AUTENTICADO = 20013;

/**
 * Turns every HTTP failure into the dashboard's `ApiError`, so repositories
 * and components never see `HttpErrorResponse`.
 *
 * 401 / 20013 on a normal call = the access token expired: refresh ONCE and
 * retry the call ONCE with the new token. If refreshing fails (or the retry is
 * rejected too) the session is cleared and the user goes to `/login`, keeping
 * the page to come back to, with the notice "Tu sesión se cerró…" (it can be another device, idle
 * time or an administrator). `/auth/*` errors are shown as they are.
 *
 * Nothing is logged here on purpose: request URLs carry search text and
 * could expose personal data (Ley 1581).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const sesionTerminada = (error: ApiError): Observable<never> => {
    // Several calls can fail together: only the first one clears the session and goes to the login, once.
    if (auth.isAuthenticated()) {
      auth.limpiarSesion();
      const destino = router.url;
      const params: Record<string, string> = { aviso: 'sesion-cerrada' };
      if (destino !== '/' && !destino.startsWith('/login')) params['return'] = destino;
      void router.navigate(['/login'], { queryParams: params });
    }
    return throwError(() => error);
  };

  const enviar = (peticion: typeof req, esReintento: boolean): Observable<HttpEvent<unknown>> =>
    next(peticion).pipe(
      catchError((fallo: unknown) => {
        if (!(fallo instanceof HttpErrorResponse)) {
          return throwError(() => fallo);
        }
        const error = aApiError(fallo);
        const tokenVencido = fallo.status === 401 && error.code === NO_AUTENTICADO && !esRutaAuth(peticion.url);
        if (!tokenVencido) {
          return throwError(() => error);
        }
        if (esReintento) {
          // Even the new token was rejected: do not renew again, no loops.
          return sesionTerminada(error);
        }
        return auth.renovar().pipe(
          catchError(() => sesionTerminada(error)),
          switchMap(() => enviar(peticion.clone({ setHeaders: { Authorization: `Bearer ${auth.token}` } }), true)),
        );
      }),
    );

  return enviar(req, false);
};

/** The API answers `{ code, message, support_ref?, fields? }` (snake_case JSON). */
function aApiError(error: HttpErrorResponse): ApiError {
  const cuerpo: unknown = error.error;
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const { code, message, support_ref, fields } = cuerpo as Record<string, unknown>;
    if (typeof code === 'number' && typeof message === 'string') {
      return {
        code,
        message,
        ...(typeof support_ref === 'number' ? { supportRef: support_ref } : {}),
        ...(typeof fields === 'object' && fields !== null ? { fields: fields as Record<string, string> } : {}),
      };
    }
  }
  // No usable body (server down, proxy error, framework default error page...).
  if (error.status === 0) {
    return { code: ERROR_SIN_CODIGO, message: 'No se pudo conectar con el servidor. Revisa que el backend esté en ejecución.' };
  }
  if (error.status >= 500) {
    return { code: 20999, message: 'Error interno del servidor.' };
  }
  return { code: ERROR_SIN_CODIGO, message: 'No se pudo completar la operación.' };
}
