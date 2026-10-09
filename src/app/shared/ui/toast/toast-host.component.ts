import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:end-4" aria-live="polite" role="status">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="sila-card pointer-events-auto flex w-full max-w-sm items-start gap-3 p-3 text-sm">
          <app-icon
            [name]="toast.tipo === 'exito' ? 'lucideCircleCheck' : 'lucideCircleAlert'"
            class="mt-0.5 size-4"
            [class.text-success]="toast.tipo === 'exito'"
            [class.text-destructive]="toast.tipo === 'error'"
            aria-hidden="true"
          />
          <div class="flex-1 space-y-2">
            <p>{{ toast.mensaje }}</p>
            @if (toast.supportRef !== undefined) {
              <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="copiar(toast.supportRef)">
                <app-icon name="lucideCopy" class="size-3.5" aria-hidden="true" />
                Copiar referencia
              </button>
            }
          </div>
          <button type="button" class="sila-btn sila-btn-ghost h-7 w-7 px-0" (click)="toastService.cerrar(toast.id)">
            <app-icon name="lucideX" class="size-3.5" aria-hidden="true" />
            <span class="sr-only">Cerrar notificación</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly toastService = inject(ToastService);
  private readonly clipboard = inject(Clipboard);

  protected copiar(ref: number): void {
    if (this.clipboard.copy(String(ref))) {
      this.toastService.exito('Referencia copiada.');
    }
  }
}
