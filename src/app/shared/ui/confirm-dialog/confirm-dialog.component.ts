import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { DialogComponent } from '../dialog/dialog.component';

export interface MotivoRegla {
  min: number;
  max: number;
}

/**
 * Confirmation for destructive or state-changing actions. With `motivo`
 * set, the confirm button stays disabled until the reason meets the rule.
 */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent],
  template: `
    <app-dialog [open]="open()" [title]="titulo()" (closed)="cancelar.emit()">
      <p class="text-sm">{{ mensaje() }}</p>
      @if (motivo(); as regla) {
        <div class="mt-4 space-y-1.5">
          <label for="confirm-motivo" class="text-sm font-medium">Motivo (obligatorio)</label>
          <textarea
            id="confirm-motivo"
            class="sila-textarea"
            [attr.maxlength]="regla.max"
            aria-describedby="confirm-motivo-ayuda"
            [value]="texto()"
            (input)="texto.set($any($event.target).value)"
          ></textarea>
          <p id="confirm-motivo-ayuda" class="text-xs text-muted-foreground">
            Entre {{ regla.min }} y {{ regla.max }} caracteres. Llevas {{ largo() }}.
          </p>
        </div>
      }
      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="ocupado()" (click)="cancelar.emit()">Cancelar</button>
        <button
          type="button"
          class="sila-btn"
          [class.sila-btn-primary]="!peligro()"
          [class.bg-destructive]="peligro()"
          [class.text-white]="peligro()"
          [disabled]="!puedeConfirmar() || ocupado()"
          [attr.aria-busy]="ocupado()"
          (click)="confirmar.emit(texto().trim())"
        >
          {{ ocupado() ? 'Procesando…' : textoConfirmar() }}
        </button>
      </div>
    </app-dialog>
  `,
})
export class ConfirmDialogComponent {
  readonly open = input(false);
  readonly titulo = input.required<string>();
  readonly mensaje = input.required<string>();
  readonly textoConfirmar = input('Confirmar');
  readonly peligro = input(false);
  readonly motivo = input<MotivoRegla | null>(null);
  readonly ocupado = input(false);

  readonly confirmar = output<string>();
  readonly cancelar = output<void>();

  protected readonly texto = signal('');
  protected readonly largo = computed(() => this.texto().trim().length);
  protected readonly puedeConfirmar = computed(() => {
    const regla = this.motivo();
    return !regla || (this.largo() >= regla.min && this.largo() <= regla.max);
  });

  constructor() {
    // Each opening starts with an empty reason.
    effect(() => {
      if (this.open()) {
        this.texto.set('');
      }
    });
  }
}
