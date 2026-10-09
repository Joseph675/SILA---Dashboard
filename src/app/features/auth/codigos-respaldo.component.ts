import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { IconComponent } from '../../shared/ui/icon/icon.component';

/** Anything that is not `[a-z0-9_.@-]` is dropped, so a file name can never be tricked by the user name. */
function nombreSeguro(usuario: string): string {
  return usuario.toLowerCase().replace(/[^a-z0-9_.@-]/g, '') || 'usuario';
}

/** `2026-10-09` in Colombia time. */
function fechaBogota(fecha: Date): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(fecha)
      .map((p) => [p.type, p.value]),
  );
  return `${partes['year']}-${partes['month']}-${partes['day']}`;
}

/**
 * "Guarda tus códigos de respaldo": the 10 one-use codes, shown ONCE. The person has to tick
 * "Ya los guardé" before "Continuar" works; the parent decides what continuing means and drops the codes.
 *
 * The codes live only in this component's inputs: nothing is written to any storage, URL or log.
 * While they are on screen, closing or reloading the tab asks for confirmation, because a reload
 * would lose them for good (new ones can be generated in "Mi cuenta", but the old ones would be gone).
 */
@Component({
  selector: 'app-codigos-respaldo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="zona-impresion-codigos space-y-4">
      <div>
        <h2 class="text-lg font-semibold tracking-tight">Guarda tus códigos de respaldo</h2>
        <p class="hidden text-sm print:block">SILA · Llanolat — códigos de respaldo · {{ usuario() }} · {{ fecha() }}</p>
      </div>

      <p class="rounded-md bg-warning/20 px-3 py-2 text-sm" role="alert">
        Cada código sirve una sola vez. Guárdalos en un lugar seguro, fuera de este computador. No se volverán a mostrar.
      </p>

      <ol class="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border border-border bg-muted/40 p-4 font-mono text-base tracking-wide" aria-label="Códigos de respaldo">
        @for (codigo of codigos(); track codigo; let i = $index) {
          <li class="flex gap-2"><span class="w-7 text-end text-muted-foreground print:text-black">{{ i + 1 }}.</span> <span class="select-all">{{ codigo }}</span></li>
        }
      </ol>

      <div class="flex flex-wrap gap-2 print:hidden">
        <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="copiar()">
          <app-icon name="lucideCopy" class="size-4" aria-hidden="true" />
          {{ copiados() ? 'Copiados' : 'Copiar' }}
        </button>
        <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="descargar()">
          <app-icon name="lucideDownload" class="size-4" aria-hidden="true" />
          Descargar (.txt)
        </button>
        <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="imprimir()">
          <app-icon name="lucidePrinter" class="size-4" aria-hidden="true" />
          Imprimir
        </button>
        <span class="sr-only" aria-live="polite">{{ copiados() ? 'Códigos copiados' : '' }}</span>
      </div>

      <div class="space-y-3 print:hidden">
        <label class="flex items-start gap-2 text-sm">
          <input type="checkbox" class="sila-checkbox mt-0.5" [checked]="guardados()" (change)="guardados.set($any($event.target).checked)" />
          <span>Ya los guardé</span>
        </label>
        <button type="button" class="sila-btn sila-btn-primary w-full" [disabled]="!guardados()" (click)="continuar.emit()">Continuar</button>
      </div>
    </div>
  `,
  host: { '(window:beforeunload)': 'alCerrarPestana($event)' },
})
export class CodigosRespaldoComponent {
  private readonly clipboard = inject(Clipboard);

  readonly codigos = input.required<readonly string[]>();
  /** Only for the file name and the heading: no password, nothing else. */
  readonly usuario = input.required<string>();

  readonly continuar = output<void>();

  protected readonly guardados = signal(false);
  protected readonly copiados = signal(false);
  protected readonly fecha = computed(() => fechaBogota(new Date()));

  constructor() {
    // The print stylesheet shows only `.zona-impresion-codigos` while this class is on <body>.
    const alTerminarImpresion = () => document.body.classList.remove('imprimiendo-codigos');
    window.addEventListener('afterprint', alTerminarImpresion);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('afterprint', alTerminarImpresion);
      document.body.classList.remove('imprimiendo-codigos');
    });
  }

  protected copiar(): void {
    if (this.clipboard.copy(this.codigos().join('\n'))) {
      this.copiados.set(true);
      setTimeout(() => this.copiados.set(false), 2000);
    }
  }

  protected descargar(): void {
    const contenido = [
      'SILA · Llanolat — códigos de respaldo',
      `Usuario: ${this.usuario()}`,
      `Fecha: ${this.fecha()}`,
      '',
      'Cada código sirve una sola vez. Guárdalo en un lugar seguro.',
      '',
      ...this.codigos().map((codigo, i) => `${String(i + 1).padStart(2, ' ')}. ${codigo}`),
      '',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/plain;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `sila-codigos-respaldo-${nombreSeguro(this.usuario())}-${this.fecha()}.txt`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  protected imprimir(): void {
    document.body.classList.add('imprimiendo-codigos');
    window.print();
  }

  protected alCerrarPestana(evento: BeforeUnloadEvent): void {
    evento.preventDefault();
  }
}
