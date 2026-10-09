import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, model, output, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export interface OpcionSelector {
  valor: number;
  etiqueta: string;
}

/** Lower case and no accents, so "ordeno" finds "Ordeño". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * A select you can search: type to filter, arrows + Enter to pick, Escape to close (ARIA combobox).
 * `valor` is the chosen option's `valor` (or `null` when "Todos"/nothing is chosen).
 */
@Component({
  selector: 'app-selector-buscable',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="relative">
      <input
        type="text"
        role="combobox"
        class="sila-input pe-9"
        autocomplete="off"
        [id]="idCampo()"
        [placeholder]="placeholder()"
        [disabled]="deshabilitado()"
        [attr.aria-expanded]="abierto()"
        [attr.aria-controls]="idLista()"
        [attr.aria-activedescendant]="abierto() && todas().length ? idLista() + '-' + activo() : null"
        [attr.aria-invalid]="invalido() ? 'true' : null"
        aria-autocomplete="list"
        [value]="abierto() ? busqueda() : etiquetaElegida()"
        (focus)="abrir()"
        (click)="abrir()"
        (input)="escribir($any($event.target).value)"
        (keydown)="teclas($event)"
        (blur)="cerrar()"
      />
      <app-icon name="lucideChevronsUpDown" class="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      @if (abierto()) {
        <ul
          [id]="idLista()"
          role="listbox"
          class="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-popover p-1 text-sm shadow-xl"
        >
          @for (opcion of todas(); track opcion.valor ?? 'todos'; let i = $index) {
            <li
              [id]="idLista() + '-' + i"
              role="option"
              class="cursor-pointer rounded-md px-3 py-2"
              [class.bg-muted]="i === activo()"
              [class.font-semibold]="opcion.valor === valor()"
              [attr.aria-selected]="opcion.valor === valor()"
              (mousedown)="$event.preventDefault(); elegir(opcion.valor)"
              (mouseenter)="activo.set(i)"
            >
              {{ opcion.etiqueta }}
            </li>
          } @empty {
            <li class="px-3 py-2 text-muted-foreground" role="presentation">Sin resultados</li>
          }
        </ul>
      }
    </div>
  `,
})
export class SelectorBuscableComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /** `id` of the input, so a `<label for>` can point at it. */
  readonly idCampo = input.required<string>();
  readonly opciones = input<readonly OpcionSelector[]>([]);
  readonly valor = model<number | null>(null);
  /** Text of the "nothing chosen" row; `null` hides it (a required field). */
  readonly etiquetaVacia = input<string | null>('Todos');
  readonly placeholder = input('Buscar…');
  readonly deshabilitado = input(false);
  readonly invalido = input(false);
  /** false = the options already come filtered (server-side search), so they are not filtered again here. */
  readonly filtrarLocal = input(true);
  /** What the person typed; `''` when the list opens. Use it to ask the server for matching options. */
  readonly buscar = output<string>();

  /** Label of the last chosen option, so it stays visible after a new search replaces `opciones`. */
  private readonly ultima = signal<{ valor: number; etiqueta: string } | null>(null);

  protected readonly abierto = signal(false);
  protected readonly busqueda = signal('');
  protected readonly activo = signal(0);

  protected readonly idLista = computed(() => `${this.idCampo()}-lista`);
  protected readonly etiquetaElegida = computed(() => {
    const valor = this.valor();
    const ultima = this.ultima();
    return this.opciones().find((o) => o.valor === valor)?.etiqueta ?? (ultima && ultima.valor === valor ? ultima.etiqueta : '');
  });

  /** The "Todos" row (valor `null`) followed by the options that match what was typed. */
  protected readonly todas = computed<{ valor: number | null; etiqueta: string }[]>(() => {
    const filtro = normalizar(this.busqueda().trim());
    const coinciden = this.opciones().filter((o) => !filtro || !this.filtrarLocal() || normalizar(o.etiqueta).includes(filtro));
    const vacia = this.etiquetaVacia();
    return vacia !== null && !filtro ? [{ valor: null, etiqueta: vacia }, ...coinciden] : coinciden;
  });

  protected abrir(): void {
    if (this.deshabilitado() || this.abierto()) return;
    this.busqueda.set('');
    this.buscar.emit('');
    this.activo.set(Math.max(0, this.todas().findIndex((o) => o.valor === this.valor())));
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
  }

  protected escribir(texto: string): void {
    this.busqueda.set(texto);
    this.buscar.emit(texto);
    this.activo.set(0);
    this.abierto.set(true);
  }

  protected elegir(valor: number | null): void {
    const opcion = this.opciones().find((o) => o.valor === valor);
    this.ultima.set(opcion && valor !== null ? { valor, etiqueta: opcion.etiqueta } : null);
    this.valor.set(valor);
    this.abierto.set(false);
  }

  protected teclas(evento: KeyboardEvent): void {
    const total = this.todas().length;
    switch (evento.key) {
      case 'ArrowDown':
        evento.preventDefault();
        if (!this.abierto()) this.abrir();
        else this.activo.update((i) => (total ? (i + 1) % total : 0));
        break;
      case 'ArrowUp':
        evento.preventDefault();
        if (this.abierto()) this.activo.update((i) => (total ? (i - 1 + total) % total : 0));
        break;
      case 'Enter':
        if (this.abierto() && total) {
          evento.preventDefault();
          this.elegir(this.todas()[this.activo()].valor);
        }
        break;
      case 'Escape':
        if (this.abierto()) {
          evento.preventDefault();
          evento.stopPropagation();
          this.cerrar();
        }
        break;
    }
  }
}
