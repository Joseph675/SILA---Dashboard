import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { EsMovilService } from '../../services/es-movil.service';
import type { SesionAbierta } from '../../../core/auth/auth.models';
import { describirDispositivo } from '../../utils/dispositivo';
import { formatoFechaHora } from '../../utils/formato-co';
import { IconComponent } from '../icon/icon.component';
import { StatusChipComponent } from '../status-chip/status-chip.component';

/**
 * Open sessions: device, IP, start and last activity (UTC -> Colombia time).
 * "Mis sesiones" lets the person close each one; the admin's view of someone else's is read only.
 */
@Component({
  selector: 'app-sesiones-lista',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, StatusChipComponent],
  template: `
    @if (error(); as mensaje) {
      <div class="flex flex-col items-start gap-2" role="alert">
        <p class="text-sm">{{ mensaje }}</p>
        <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="reintentar.emit()">Reintentar</button>
      </div>
    } @else if (cargando() && !sesiones()) {
      <p class="text-sm text-muted-foreground" role="status">Cargando sesiones…</p>
    } @else if (sesiones()?.length === 0) {
      <p class="text-sm text-muted-foreground">No hay sesiones abiertas.</p>
    } @else if (movil()) {
      <ul class="divide-y divide-border" aria-label="Sesiones abiertas">
        @for (sesion of sesiones(); track sesion.familia) {
          <li class="min-w-0 space-y-2 py-3">
            <p class="flex flex-wrap items-center gap-2">
              <span class="font-medium" [attr.title]="sesion.user_agent">{{ dispositivo(sesion.user_agent) }}</span>
              @if (sesion.actual) {
                <app-status-chip texto="Esta sesión" tono="info" />
              }
            </p>
            <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
              <dt class="text-muted-foreground">IP</dt>
              <dd class="break-all text-end font-mono text-xs">{{ sesion.ip }}</dd>
              <dt class="text-muted-foreground">Iniciada</dt>
              <dd class="text-end">{{ fechaHora(sesion.iniciada) }}</dd>
              <dt class="text-muted-foreground">Última actividad</dt>
              <dd class="text-end">{{ fechaHora(sesion.ultima_actividad) }}</dd>
            </dl>
            @if (permitirCerrar()) {
              <button type="button" class="sila-btn sila-btn-outline w-full" [disabled]="ocupado()" (click)="cerrar.emit(sesion)">
                <app-icon name="lucideLogOut" class="size-4" aria-hidden="true" />
                Cerrar esta sesión<span class="sr-only"> ({{ dispositivo(sesion.user_agent) }})</span>
              </button>
            }
          </li>
        }
      </ul>
    } @else {
      <div class="relative overflow-x-auto">
        <table class="w-full text-sm">
          <caption class="sr-only">Sesiones abiertas</caption>
          <thead>
            <tr class="border-b border-border text-start text-xs text-muted-foreground">
              <th scope="col" class="px-3 py-2 text-start font-medium">Dispositivo</th>
              <th scope="col" class="px-3 py-2 text-start font-medium">IP</th>
              <th scope="col" class="px-3 py-2 text-start font-medium">Iniciada</th>
              <th scope="col" class="px-3 py-2 text-start font-medium">Última actividad</th>
              @if (permitirCerrar()) {
                <th scope="col" class="px-3 py-2 text-end font-medium"><span class="sr-only">Acciones</span></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (sesion of sesiones(); track sesion.familia) {
              <tr class="border-b border-border/50 last:border-0">
                <td class="px-3 py-2.5">
                  <span class="flex flex-wrap items-center gap-2">
                    <span class="font-medium" [attr.title]="sesion.user_agent">{{ dispositivo(sesion.user_agent) }}</span>
                    @if (sesion.actual) {
                      <app-status-chip texto="Esta sesión" tono="info" />
                    }
                  </span>
                </td>
                <td class="px-3 py-2.5 font-mono text-xs">{{ sesion.ip }}</td>
                <td class="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{{ fechaHora(sesion.iniciada) }}</td>
                <td class="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{{ fechaHora(sesion.ultima_actividad) }}</td>
                @if (permitirCerrar()) {
                  <td class="px-3 py-2.5 text-end">
                    <button type="button" class="sila-btn sila-btn-ghost sila-btn-sm" [disabled]="ocupado()" (click)="cerrar.emit(sesion)">
                      <app-icon name="lucideLogOut" class="size-3.5" aria-hidden="true" />
                      Cerrar<span class="sr-only"> la sesión de {{ dispositivo(sesion.user_agent) }}</span>
                    </button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class SesionesListaComponent {
  readonly sesiones = input<readonly SesionAbierta[] | undefined>(undefined);
  readonly cargando = input(false);
  readonly error = input<string | null>(null);
  readonly permitirCerrar = input(false);
  readonly ocupado = input(false);

  readonly cerrar = output<SesionAbierta>();
  readonly reintentar = output<void>();

  protected readonly movil = inject(EsMovilService).movil;
  protected readonly dispositivo = describirDispositivo;
  protected readonly fechaHora = formatoFechaHora;
}
