import type { AbstractControl, FormGroup } from '@angular/forms';

/**
 * Puts the server's per-field reasons (`ApiError.fields`, code 20001) on the form controls so they show under
 * the field like any other error. `mapa` translates a server field name to the control name when they differ.
 * Returns the reasons that matched no control (the caller shows them as a general message).
 */
export function aplicarCamposDelServidor(form: FormGroup, fields: Record<string, string> | undefined, mapa: Record<string, string> = {}): string[] {
  const sinCampo: string[] = [];
  for (const [campo, motivo] of Object.entries(fields ?? {})) {
    const control: AbstractControl | null = form.get(mapa[campo] ?? campo);
    if (control) {
      control.setErrors({ servidor: motivo });
      control.markAsTouched();
    } else {
      sinCampo.push(`${campo}: ${motivo}`);
    }
  }
  return sinCampo;
}
