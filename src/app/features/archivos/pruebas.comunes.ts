import type { ComponentFixture } from '@angular/core/testing';
import type { Archivo, OpcionesDescarga } from './models/archivos.models';

/** Helpers shared by the specs of this module (not part of the app). */
export async function estabilizar(f: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 6; i++) {
    f.detectChanges();
    await f.whenStable();
    await new Promise((r) => setTimeout(r));
  }
  f.detectChanges();
}

export const limpio = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** `<dialog>` is not implemented by the test DOM. */
export function polyfillDialog(): void {
  const d = HTMLDialogElement.prototype;
  d.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  d.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

export function archivoDe(id: number, extra: Partial<Archivo> = {}): Archivo {
  return {
    id_documento: id,
    origen: 'COMPROBANTE',
    tipo_entidad: 'VENTA',
    id_entidad: 123,
    version: 'ORIGINAL',
    id_documento_original: null,
    nombre_archivo: `VENTA-${id}.pdf`,
    mime_type: 'application/pdf',
    tamano_bytes: 20480,
    checksum_sha256: 'cd'.repeat(32),
    id_carpeta: null,
    carpeta: null,
    archivado: false,
    motivo_archivo: null,
    usuario_archivo: null,
    fecha_archivo: null,
    estado_drive: 'SUBIDO',
    fecha_drive: '2026-10-14T01:00:00',
    usuario_carga: null,
    fecha_registro: '2026-10-14T01:00:00',
    fecha: '2026-10-13',
    numero: `VENTA #${id}`,
    sentido: 'INGRESO',
    monto: 119000,
    id_tercero: 5,
    tercero_tipo: 'CLIENTE',
    tercero: 'Tienda La Esquina',
    estado_comprobante: 'VIGENTE',
    id_periodo: 19,
    anio: 2026,
    mes: 10,
    quincena: 1,
    ...extra,
  };
}

export const OPCIONES_CON_DOCUMENTO: OpcionesDescarga = { documento_disponible: true, motivo_no_disponible: null, tercero: 'Tienda La Esquina', tercero_tipo: 'CLIENTE', pista_clave_documento: '900***567', clave_min: 4, clave_max: 64, es_imagen: false };
export const OPCIONES_SIN_DOCUMENTO: OpcionesDescarga = { documento_disponible: false, motivo_no_disponible: 'Los gastos no tienen cliente ni proveedor.', tercero: null, tercero_tipo: null, pista_clave_documento: null, clave_min: 4, clave_max: 64, es_imagen: false };
