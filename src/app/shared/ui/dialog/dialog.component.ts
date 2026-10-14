import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Thin wrapper around the native `<dialog>` element (the original template's
 * `.sila-dialog`): `open` drives `showModal()`/`close()`, and Escape,
 * backdrop clicks and the close button all report back through `closed`.
 */
@Component({
  selector: 'app-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <dialog
      #dialog
      class="sila-dialog"
      [class.max-w-2xl]="wide()"
      (cancel)="onCancel($event)"
      (close)="closed.emit()"
      (click)="onDialogClick($event)"
    >
      <div class="flex shrink-0 items-start justify-between gap-4 border-b border-border p-4">
        <div>
          <h2 class="text-base font-semibold">{{ title() }}</h2>
          @if (description()) {
            <p class="mt-0.5 text-xs text-muted-foreground">{{ description() }}</p>
          }
        </div>
        @if (cerrable()) {
          <button type="button" class="sila-btn sila-btn-ghost h-8 w-8 shrink-0 px-0" (click)="closed.emit()">
            <app-icon name="lucideX" class="size-4" />
            <span class="sr-only">Cerrar</span>
          </button>
        }
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <ng-content />
      </div>
      <div class="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border p-4 max-sm:[&>*]:flex-1">
        <ng-content select="[dialogFooter]" />
      </div>
    </dialog>
  `,
})
export class DialogComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly description = input('');
  /** Wider dialog for forms with several columns. */
  readonly wide = input(false);
  /** false = it only closes through its own buttons (not with Escape, the backdrop or the X). */
  readonly cerrable = input(true);

  readonly closed = output<void>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialogRef().nativeElement;
      if (this.open() && !dialog.open) {
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  /** Clicks land on the dialog element itself only when they hit the backdrop. */
  protected onDialogClick(event: MouseEvent): void {
    if (this.cerrable() && event.target === this.dialogRef().nativeElement) {
      this.closed.emit();
    }
  }

  /** Escape closes a native dialog by itself; a non-closable one must stay open. */
  protected onCancel(event: Event): void {
    if (!this.cerrable()) {
      event.preventDefault();
    }
  }
}
