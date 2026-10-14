import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { formatoFechaHora } from '../../shared/utils/formato-co';
import type { Notificacion } from './models/notificaciones.models';
import { iconoDe } from './notificaciones.logica';

/** One alert as a row: icon by kind, severity in color AND text, and a mark when it has not been seen. */
@Component({
  selector: 'app-notificacion-fila',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="flex w-full min-w-0 items-start gap-3 rounded-lg border-s-4 px-2 py-2.5 text-start transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      [class.border-destructive]="notificacion().severidad === 'CRITICA'"
      [class.border-warning]="notificacion().severidad !== 'CRITICA'"
      (click)="abrir.emit(notificacion())"
    >
      <span class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <app-icon [name]="icono()" class="size-4" [class.text-destructive]="notificacion().severidad === 'CRITICA'" [class.text-warning]="notificacion().severidad !== 'CRITICA'" aria-hidden="true" />
      </span>
      <span class="min-w-0 flex-1 space-y-0.5">
        <span class="flex flex-wrap items-center gap-x-2 text-sm leading-snug" [class.font-semibold]="!leida()" [class.font-medium]="leida()">
          {{ notificacion().titulo }}
          <span class="text-xs font-semibold" [class.text-destructive]="notificacion().severidad === 'CRITICA'" [class.text-warning]="notificacion().severidad !== 'CRITICA'">
            {{ notificacion().severidad === 'CRITICA' ? 'Crítica' : 'Advertencia' }}
          </span>
          @if (!leida()) {
            <span class="size-2 rounded-full bg-primary" data-testid="sin-leer"></span>
            <span class="sr-only">Sin leer</span>
          }
        </span>
        <span class="block break-words text-xs leading-snug text-muted-foreground">{{ notificacion().detalle }}</span>
        @if (fecha()) {
          <span class="block text-[11px] text-muted-foreground/70">{{ fecha() }}</span>
        }
      </span>
    </button>
  `,
})
export class NotificacionFilaComponent {
  readonly notificacion = input.required<Notificacion>();
  readonly leida = input(false);
  readonly abrir = output<Notificacion>();

  protected readonly icono = computed(() => iconoDe(this.notificacion().tipo));
  protected readonly fecha = computed(() => {
    const f = this.notificacion().fecha;
    // `fecha` may be a day or a UTC timestamp: a day is shown as it is, never shifted by a time zone.
    return f ? (f.length <= 10 ? f.split('-').reverse().join('/') : formatoFechaHora(f)) : '';
  });
}
