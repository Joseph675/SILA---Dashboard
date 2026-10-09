import { environment } from '../../../environments/environment';

const PREFIJO_AUTH = `/api/${environment.apiVersion}/auth/`;

/** Any `/auth/*` call: errors there are shown as they are, never answered with a refresh. */
export function esRutaAuth(url: string): boolean {
  return url.includes(PREFIJO_AUTH);
}

/** Calls that must NOT carry the access token (they run before having one, or end the session). */
export function esRutaAuthPublica(url: string): boolean {
  return ['login', 'refresh', 'logout'].some((paso) => url.includes(`${PREFIJO_AUTH}${paso}`));
}
