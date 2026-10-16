/**
 * Saves a `Blob` as a download (`<a download>` on a `blob:` URL). The URL is released right after: the browser has taken the bytes.
 * Nothing is kept: no storage, no list.
 */
export function guardarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = 'noopener';
  enlace.style.display = 'none';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
