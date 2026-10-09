import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { URL_INICIO } from '../auth/url-retorno';
import { AuthService } from '../services/auth.service';

/**
 * Private area: without a session go to `/login`, remembering where the user
 * wanted to go (validated again at login, see `urlRetornoSegura`).
 * Not security by itself: the API rejects every call without a valid token.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  if (inject(AuthService).isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login'], state.url === URL_INICIO ? {} : { queryParams: { return: state.url } });
};

/** `/login` only for people without a session. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).isAuthenticated() ? router.createUrlTree([URL_INICIO]) : true;
};
