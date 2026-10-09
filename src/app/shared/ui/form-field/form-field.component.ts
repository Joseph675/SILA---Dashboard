import { ChangeDetectionStrategy, Component, ElementRef, Renderer2, computed, contentChild, effect, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NgControl } from '@angular/forms';
import { EMPTY, map, switchMap } from 'rxjs';
import { mensajeDeError } from '../../validators/sila-validators';

let siguienteId = 0;

/**
 * Label + projected control + hint + error. Wires `id`, `aria-invalid` and
 * `aria-describedby` on the projected control, and announces the error.
 *
 * `<app-form-field etiqueta="Nombre" ayuda="Máx. 120"><input formControlName="nombre" class="sila-input" /></app-form-field>`
 */
@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-1.5">
      <label [attr.for]="campoId" class="text-sm font-medium">
        {{ etiqueta() }}
        @if (obligatorio()) {
          <span class="text-destructive" aria-hidden="true">*</span>
        }
      </label>
      <ng-content />
      @if (ayuda() && !error()) {
        <p [id]="ayudaId" class="text-xs text-muted-foreground">{{ ayuda() }}</p>
      }
      <p [id]="errorId" class="text-xs font-medium text-destructive" aria-live="polite">{{ error() }}</p>
    </div>
  `,
})
export class FormFieldComponent {
  readonly etiqueta = input.required<string>();
  readonly ayuda = input('');
  readonly obligatorio = input(false);

  private readonly renderer = inject(Renderer2);
  private readonly ngControl = contentChild(NgControl);
  private readonly elemento = contentChild(NgControl, { read: ElementRef });

  protected readonly campoId = `campo-${siguienteId++}`;
  protected readonly ayudaId = `${this.campoId}-ayuda`;
  protected readonly errorId = `${this.campoId}-error`;

  /** Re-evaluated on every value/status/touched change of the control. */
  private readonly estado = toSignal(
    toObservable(this.ngControl).pipe(
      switchMap((ngControl) => {
        const control = ngControl?.control;
        return control ? control.events.pipe(map(() => (control.invalid && control.touched ? mensajeDeError(control.errors) : null))) : EMPTY;
      }),
    ),
    { initialValue: null },
  );

  protected readonly error = computed(() => this.estado());

  constructor() {
    effect(() => {
      const el = this.elemento()?.nativeElement as HTMLElement | undefined;
      if (!el) return;
      this.renderer.setAttribute(el, 'id', this.campoId);
      this.renderer.setAttribute(el, 'aria-describedby', `${this.ayudaId} ${this.errorId}`);
      if (this.error()) {
        this.renderer.setAttribute(el, 'aria-invalid', 'true');
      } else {
        this.renderer.removeAttribute(el, 'aria-invalid');
      }
    });
  }
}
