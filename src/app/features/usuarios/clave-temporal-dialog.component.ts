import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';

export interface ClaveTemporal {
  usuario: string;
  clave: string;
}

/**
 * Shows a temporary password ONCE. It cannot be closed with Escape, the
 * backdrop or an X: only the button "Ya la copié". The parent drops the value
 * when it is confirmed; it is never stored or logged.
 */
@Component({
  selector: 'app-clave-temporal-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, IconComponent],
  template: `
    <app-dialog [open]="datos() !== null" [cerrable]="false" [title]="'Clave temporal de ' + (datos()?.usuario ?? '')">
      <div class="space-y-4">
        <p class="rounded-md bg-warning/20 px-3 py-2 text-sm font-medium" role="alert">
          Anótala o cópiala ahora: no se podrá ver de nuevo.
        </p>
        <div class="flex items-center gap-2">
          <code class="flex-1 select-all break-all rounded-md bg-muted px-3 py-2.5 font-mono text-base tracking-wide">{{ datos()?.clave }}</code>
          <button type="button" class="sila-btn sila-btn-outline" (click)="copiar()">
            <app-icon name="lucideCopy" class="size-4" aria-hidden="true" />
            {{ copiada() ? 'Copiada' : 'Copiar' }}
          </button>
        </div>
        <span class="sr-only" aria-live="polite">{{ copiada() ? 'Clave copiada' : '' }}</span>
        <p class="text-sm text-muted-foreground">La persona deberá cambiarla la primera vez que ingrese.</p>
      </div>

      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-primary" (click)="alConfirmar()">Ya la copié</button>
      </div>
    </app-dialog>
  `,
})
export class ClaveTemporalDialogComponent {
  private readonly clipboard = inject(Clipboard);

  readonly datos = input<ClaveTemporal | null>(null);
  readonly confirmado = output<void>();

  protected readonly copiada = signal(false);

  protected copiar(): void {
    const clave = this.datos()?.clave;
    if (clave && this.clipboard.copy(clave)) {
      this.copiada.set(true);
      setTimeout(() => this.copiada.set(false), 2000);
    }
  }

  protected alConfirmar(): void {
    this.copiada.set(false);
    this.confirmado.emit();
  }
}
