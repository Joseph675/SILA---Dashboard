import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChildren } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

export interface Pestana {
  id: string;
  etiqueta: string;
  icono: IconName;
}

/**
 * WAI-ARIA tablist: arrows, Home and End move between tabs. It only draws the tabs and reports the choice;
 * the page owns which one is active (usually in `?pestana=`) and renders the panel with `id="panel-<id>"`.
 */
@Component({
  selector: 'app-pestanas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div role="tablist" [attr.aria-label]="etiqueta()" class="mb-6 flex w-full snap-x gap-1 overflow-x-auto overscroll-x-contain rounded-lg bg-muted p-1 sm:inline-flex sm:w-auto sm:max-w-full">
      @for (pestana of pestanas(); track pestana.id; let i = $index) {
        <button
          #tab
          type="button"
          role="tab"
          class="sila-tab shrink-0 snap-start focus-visible:outline-2 focus-visible:outline-ring"
          [class.sila-tab-active]="activa() === pestana.id"
          [id]="'tab-' + pestana.id"
          [attr.aria-selected]="activa() === pestana.id"
          [attr.aria-controls]="'panel-' + pestana.id"
          [tabIndex]="activa() === pestana.id ? 0 : -1"
          (click)="elegir(pestana.id, $event)"
          (keydown)="navegar($event, i)"
        >
          <app-icon [name]="pestana.icono" class="size-4" aria-hidden="true" />
          {{ pestana.etiqueta }}
        </button>
      }
    </div>
  `,
})
export class PestanasComponent {
  readonly pestanas = input.required<readonly Pestana[]>();
  readonly activa = input.required<string>();
  readonly etiqueta = input.required<string>();
  readonly seleccionada = output<string>();

  private readonly tabs = viewChildren<ElementRef<HTMLButtonElement>>('tab');

  /** Chooses a tab and brings it into view (on a phone the row scrolls sideways). */
  protected elegir(id: string, evento: Event): void {
    this.seleccionada.emit(id);
    (evento.currentTarget as HTMLElement | null)?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  protected navegar(evento: KeyboardEvent, indice: number): void {
    const total = this.pestanas().length;
    const destino: Record<string, number> = { ArrowRight: (indice + 1) % total, ArrowLeft: (indice - 1 + total) % total, Home: 0, End: total - 1 };
    const siguiente = destino[evento.key];
    if (siguiente === undefined) return;
    evento.preventDefault();
    this.seleccionada.emit(this.pestanas()[siguiente].id);
    this.tabs()[siguiente]?.nativeElement.focus();
  }
}
