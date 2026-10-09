/** Prints only the element marked `.zona-impresion-ticket` (see styles.css) and removes the print mode afterwards. */
export function imprimirTicket(): void {
  document.body.classList.add('imprimiendo-ticket');
  window.addEventListener('afterprint', () => document.body.classList.remove('imprimiendo-ticket'), { once: true });
  window.print();
}
