import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';

/**
 * Text for a failed call. For the codes in `delServidor` the SERVER's message is shown as it is (it carries
 * the numbers: stock left, credit limit, how much the payments add up to); any other failure goes through
 * `ApiErrorService`. With `fields` (20001), each field's reason is appended.
 */
export function mensajeDeFallo(errores: ApiErrorService, fallo: unknown, delServidor: readonly number[] = []): string {
  const error = causaDe(fallo);
  if (isApiError(error) && delServidor.includes(error.code)) {
    const campos = error.fields ? Object.values(error.fields).join(' ') : '';
    return campos && !error.message.includes(campos) ? `${error.message} ${campos}` : error.message;
  }
  return errores.describe(fallo).mensaje;
}
