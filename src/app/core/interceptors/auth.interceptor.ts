import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { esRutaAuth, esRutaAuthPublica } from '../auth/rutas-auth';
import { AuthService } from '../services/auth.service';

/**
 * Identifies the caller to the API: `Authorization: Bearer <access token>`.
 * Not sent to `/auth/login`, `/auth/refresh` and `/auth/logout`. A call that
 * already sets its own `Authorization` (the temporary login tokens) keeps it.
 * `/auth/*` calls carry the HttpOnly refresh cookie (`withCredentials`).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const peticion = esRutaAuth(req.url) ? req.clone({ withCredentials: true }) : req;

  if (peticion.headers.has('Authorization') || esRutaAuthPublica(peticion.url)) {
    return next(peticion);
  }
  const token = auth.token;
  return next(token ? peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : peticion);
};
