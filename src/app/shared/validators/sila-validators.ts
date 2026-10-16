import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validators that replicate the database rules on the client, so the user
 * sees the error before sending. The server validates again (20001).
 * Every error key has its message in `mensajeDeError`.
 */

const DOS_DECIMALES = /^-?\d+(\.\d{1,2})?$/;
const DOCUMENTO = /^[A-Za-z0-9-]{5,20}$/;
const SKU = /^[A-Z0-9-]{3,20}$/;
// SUPUESTO: el documento no fija formato de teléfono; se aceptan dígitos, espacios, +, guion y paréntesis (7 a 20).
const TELEFONO = /^[0-9+\-() ]{7,20}$/;

export function esDocumentoValido(valor: string): boolean {
  return DOCUMENTO.test(valor.trim());
}

export function esSkuValido(valor: string): boolean {
  return SKU.test(valor.trim());
}

function vacio(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

export const SilaValidators = {
  /** Required after trimming: only spaces does not count as a value. */
  requerido: ((control: AbstractControl): ValidationErrors | null =>
    vacio(control.value) ? { requerido: true } : null) as ValidatorFn,

  /** Trimmed length between `min` and `max`. */
  longitud(min: number, max: number): ValidatorFn {
    return (control) => {
      if (vacio(control.value)) return null;
      const largo = String(control.value).trim().length;
      return largo < min || largo > max ? { longitud: { min, max, actual: largo } } : null;
    };
  },

  /** At most two decimals. */
  dosDecimales: ((control: AbstractControl): ValidationErrors | null =>
    vacio(control.value) || DOS_DECIMALES.test(String(control.value)) ? null : { dosDecimales: true }) as ValidatorFn,

  /** Amount > 0 with at most two decimals. */
  montoPositivo: ((control: AbstractControl): ValidationErrors | null => {
    if (vacio(control.value)) return null;
    if (!DOS_DECIMALES.test(String(control.value))) return { dosDecimales: true };
    return Number(control.value) > 0 ? null : { mayorQueCero: true };
  }) as ValidatorFn,

  /** Numeric value inside [min, max] with at most two decimals. */
  rango(min: number, max: number): ValidatorFn {
    return (control) => {
      if (vacio(control.value)) return null;
      if (!DOS_DECIMALES.test(String(control.value))) return { dosDecimales: true };
      const valor = Number(control.value);
      return valor < min || valor > max ? { rango: { min, max } } : null;
    };
  },

  /** New password: at least 12 characters and at most 72 BYTES (the API limit; accents take 2). */
  claveNueva: ((control: AbstractControl): ValidationErrors | null => {
    const valor = String(control.value ?? '');
    if (valor === '') return null;
    if ([...valor].length < 12) return { claveCorta: true };
    if (new TextEncoder().encode(valor).length > 72) return { claveLarga: true };
    return null;
  }) as ValidatorFn,

  /** The control must differ from a sibling control (new password vs current one). */
  distintaDe(otro: string): ValidatorFn {
    return (control) => {
      const valor = control.value;
      const ajeno = control.parent?.get(otro)?.value;
      return valor && ajeno && valor === ajeno ? { igualALaActual: true } : null;
    };
  },

  /** The control must equal a sibling control (password confirmation). */
  igualA(otro: string): ValidatorFn {
    return (control) => {
      const valor = control.value;
      const ajeno = control.parent?.get(otro)?.value;
      return valor && ajeno !== valor ? { noCoincide: true } : null;
    };
  },

  /** User name: 3-100 characters in lowercase, `a-z 0-9 _ . @ -`. */
  nombreUsuario: ((control: AbstractControl): ValidationErrors | null =>
    vacio(control.value) || /^[a-z0-9_.@-]{3,100}$/.test(String(control.value)) ? null : { nombreUsuario: true }) as ValidatorFn,

  /** No whitespace at all (login user name). */
  sinEspacios: ((control: AbstractControl): ValidationErrors | null =>
    /\s/.test(String(control.value ?? '').trim()) ? { conEspacios: true } : null) as ValidatorFn,

  /** Backup code: 10 letters/digits, with or without hyphen and spaces. */
  codigoRespaldo: ((control: AbstractControl): ValidationErrors | null => {
    const limpio = String(control.value ?? '').toUpperCase().replace(/[\s-]/g, '');
    return limpio === '' || /^[A-Z0-9]{10}$/.test(limpio) ? null : { codigoRespaldo: true };
  }) as ValidatorFn,

  /** Whole number (no decimals). */
  entero: ((control: AbstractControl): ValidationErrors | null =>
    vacio(control.value) || /^-?\d+$/.test(String(control.value).trim()) ? null : { entero: true }) as ValidatorFn,

  /** 5-20 letters, digits or hyphen. */
  documento: ((control: AbstractControl): ValidationErrors | null =>
    vacio(control.value) || DOCUMENTO.test(String(control.value).trim()) ? null : { documento: true }) as ValidatorFn,

  /** 3-20 uppercase letters, digits or hyphen. */
  sku: ((control: AbstractControl): ValidationErrors | null =>
    vacio(control.value) || SKU.test(String(control.value).trim()) ? null : { sku: true }) as ValidatorFn,

  telefono: ((control: AbstractControl): ValidationErrors | null =>
    vacio(control.value) || TELEFONO.test(String(control.value).trim()) ? null : { telefono: true }) as ValidatorFn,

  /** A name for a folder or file: no `/` or `\\` (they would read as a path). */
  sinBarras: ((control: AbstractControl): ValidationErrors | null =>
    /[\\/]/.test(String(control.value ?? '')) ? { sinBarras: true } : null) as ValidatorFn,

  /** Reason of a destructive action: `min` to `max` characters once trimmed. */
  motivo(min: number, max = 255): ValidatorFn {
    return (control) => {
      const largo = String(control.value ?? '').trim().length;
      return largo < min || largo > max ? { motivo: { min, max, actual: largo } } : null;
    };
  },
};

/** User-facing text for the first error of a control. */
export function mensajeDeError(errors: ValidationErrors | null): string | null {
  if (!errors) return null;
  const [clave, detalle] = Object.entries(errors)[0];
  switch (clave) {
    case 'required':
    case 'requerido':
      return 'Este campo es obligatorio.';
    case 'longitud':
      return `Debe tener entre ${detalle.min} y ${detalle.max} caracteres (tiene ${detalle.actual}).`;
    case 'maxlength':
      return `Máximo ${detalle.requiredLength} caracteres.`;
    case 'dosDecimales':
      return 'Máximo 2 decimales.';
    case 'codigoRespaldo':
      return 'Escribe los 10 caracteres del código (con o sin guion).';
    case 'claveCorta':
      return 'La clave debe tener al menos 12 caracteres.';
    case 'claveLarga':
      return 'La clave es demasiado larga (máximo 72 bytes).';
    case 'igualALaActual':
      return 'La clave nueva debe ser distinta de la actual.';
    case 'noCoincide':
      return 'Las claves no coinciden.';
    case 'nombreUsuario':
      return '3 a 100 caracteres en minúscula: letras, números, punto, guion, guion bajo o @.';
    case 'sinBarras':
      return 'El nombre no puede llevar «/» ni «\\».';
    case 'conEspacios':
      return 'No puede tener espacios.';
    case 'entero':
      return 'Debe ser un número entero.';
    case 'mayorQueCero':
      return 'Debe ser mayor que cero.';
    case 'rango':
      return `Debe estar entre ${detalle.min} y ${detalle.max}.`;
    case 'min':
      return `Debe ser mayor o igual a ${detalle.min}.`;
    case 'documento':
      return 'Entre 5 y 20 caracteres: letras, números o guion.';
    case 'sku':
      return 'Entre 3 y 20 caracteres: mayúsculas, números o guion.';
    case 'telefono':
      return 'Teléfono no válido.';
    case 'email':
      return 'Correo electrónico no válido.';
    case 'motivo':
      return `El motivo debe tener entre ${detalle.min} y ${detalle.max} caracteres (tiene ${detalle.actual}).`;
    case 'codigoMfa':
      return String(detalle);
    case 'servidor':
      return String(detalle);
    case 'duplicado':
      return 'Ya existe un registro con este valor.';
    default:
      return 'Valor no válido.';
  }
}

/** Trims and collapses inner whitespace of free text before sending it. */
export function limpiarTexto(valor: string): string {
  return valor.trim().replace(/\s+/g, ' ');
}
