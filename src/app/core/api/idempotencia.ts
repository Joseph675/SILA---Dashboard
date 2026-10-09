/**
 * New `Idempotency-Key` for ONE user action (each time "Guardar" is pressed with new data).
 *
 * Rule of the contract: a new key per action; the SAME key only to retry that very
 * action (network failure, double click), so the server returns the first answer
 * instead of repeating it. Never a fixed key, never one shared between actions.
 * Format accepted by the API: 8-100 characters `A-Z a-z 0-9 . _ : -` (a UUID fits).
 *
 *   const clave = nuevaClaveIdempotencia();          // when the user presses the button
 *   api.post('ventas', cuerpo, { idempotencyKey: clave });   // and again with `clave` on a retry
 */
export function nuevaClaveIdempotencia(): string {
  return crypto.randomUUID();
}

/**
 * Failures after which the SAME action may be retried with the SAME key: the answer never came back
 * (no connection, no usable body), the server failed (the write may or may not have happened) or the
 * first request was still running (20016). Anything else is an answer to the data, so the next try is a new action.
 */
function esReintentable(error: unknown): boolean {
  const causa = error instanceof Error && error.cause !== undefined ? error.cause : error;
  const codigo = typeof causa === 'object' && causa !== null ? (causa as { code?: unknown }).code : undefined;
  return codigo === 0 || codigo === 20999 || codigo === 20016;
}

/**
 * The `Idempotency-Key` of ONE user action. Ask `para(cuerpo)` when the person presses "Guardar":
 * it gives a NEW key, except when the same body is being sent again right after a failure that can be
 * retried (see above), which reuses the key so the server does not repeat the write.
 * Call `exito()` when it worked and `fallo(error)` when it did not.
 */
export class ClaveIdempotente {
  private clave: string | null = null;
  private huella: string | null = null;
  private reintento = false;

  para(cuerpo: unknown): string {
    const huella = JSON.stringify(cuerpo);
    if (!(this.clave && this.reintento && this.huella === huella)) {
      this.clave = nuevaClaveIdempotencia();
      this.huella = huella;
    }
    this.reintento = false;
    return this.clave;
  }

  fallo(error: unknown): void {
    this.reintento = esReintentable(error);
  }

  /** The server saw the same key with different data (20017): the next send starts from scratch. */
  descartar(): void {
    this.clave = null;
    this.huella = null;
    this.reintento = false;
  }

  exito(): void {
    this.descartar();
  }
}

