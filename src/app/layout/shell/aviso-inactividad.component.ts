import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { InactividadService } from '../../core/session/inactividad.service';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';

/** "Tu sesión se cerrará en 1:59": it opens `AVISO_MS` before the idle limit and cannot be dismissed, only answered. */
@Component({
  selector: 'app-aviso-inactividad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent],
  template: `
    <app-dialog [open]="inactividad.avisoVisible()" [cerrable]="false" title="¿Sigues ahí?">
      <p class="text-sm">Por seguridad, tu sesión se cerrará por inactividad.</p>
      <p class="mt-3 text-center">
        <span class="text-sm text-muted-foreground">Tu sesión se cerrará en</span>
        <span class="mt-1 block font-mono text-3xl font-semibold tabular-nums" role="timer">{{ tiempo() }}</span>
      </p>
      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" (click)="inactividad.cerrarAhora()">Cerrar sesión</button>
        <button type="button" class="sila-btn sila-btn-primary" (click)="inactividad.seguirConectado()">Seguir conectado</button>
      </div>
    </app-dialog>
  `,
})
export class AvisoInactividadComponent {
  protected readonly inactividad = inject(InactividadService);

  /** `1:59` */
  protected readonly tiempo = computed(() => {
    const segundos = Math.max(0, Math.ceil(this.inactividad.restanteMs() / 1000));
    return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
  });
}
