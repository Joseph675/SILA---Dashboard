import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import type { Notificacion } from './models/notificaciones.models';
import { NotificacionFilaComponent } from './notificacion-fila.component';
import { destinoDe } from './notificaciones.logica';
import { INTERVALO_REFRESCO_MS, NotificacionesService } from './notificaciones.service';

/**
 * The bell of the header: the alerts of the backend, with a dot and the count of the ones not seen yet
 * (red if any is critical, amber otherwise). Refreshes when opened, when the tab is shown again and every 2 minutes.
 */
@Component({
  selector: 'app-notificaciones-campana',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, NotificacionFilaComponent, RouterLink],
  template: `
    <div class="relative">
      <button
        type="button"
        class="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        [attr.aria-label]="etiqueta()"
        aria-haspopup="true"
        [attr.aria-expanded]="abierta()"
        (click)="alternar()"
      >
        <app-icon name="lucideBell" class="h-4 w-4" aria-hidden="true" />
        @if (cantidad() > 0) {
          <span
            class="absolute -end-1 -top-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-4 text-white"
            [class.bg-destructive]="hayCriticas()"
            [class.bg-warning]="!hayCriticas()"
            data-testid="punto-notificaciones"
            aria-hidden="true"
          >{{ cantidad() > 99 ? '99+' : cantidad() }}</span>
        }
      </button>

      @if (abierta()) {
        <div
          class="fixed inset-x-3 top-[4.25rem] z-40 rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-xl sm:absolute sm:inset-x-auto sm:end-0 sm:top-auto sm:mt-2 sm:w-96"
          role="region"
          aria-label="Notificaciones"
        >
          <div class="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p class="text-sm font-semibold">Notificaciones</p>
            <button type="button" class="text-xs font-medium text-primary hover:underline disabled:opacity-50" [disabled]="cantidad() === 0" (click)="servicio.marcarTodasLeidas()">Marcar todas como leídas</button>
          </div>
          <div class="max-h-[60dvh] overflow-y-auto p-2 sm:max-h-96" data-testid="lista-notificaciones">
            @for (n of servicio.items(); track n.clave) {
              <app-notificacion-fila [notificacion]="n" [leida]="servicio.esLeida(n)" (abrir)="ir($event)" />
            } @empty {
              <p class="px-3 py-8 text-center text-sm text-muted-foreground" data-testid="sin-notificaciones">
                {{ servicio.cargado() ? 'Todo en orden: no hay alertas.' : 'Cargando…' }}
              </p>
            }
          </div>
          <div class="border-t border-border p-2">
            <a routerLink="/notificaciones" class="flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-primary hover:bg-muted" (click)="abierta.set(false)">
              Ver todas
              <app-icon name="lucideArrowUpRight" class="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      }
    </div>
  `,
})
export class NotificacionesCampanaComponent {
  protected readonly servicio = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  protected readonly abierta = signal(false);
  protected readonly cantidad = computed(() => this.servicio.noVistas().length);
  protected readonly hayCriticas = computed(() => this.servicio.criticasNoVistas().length > 0);
  protected readonly etiqueta = computed(() => (this.cantidad() > 0 ? `Notificaciones: ${this.cantidad()} sin leer` : 'Notificaciones'));

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.servicio.refrescar();
    const intervalo = setInterval(() => this.servicio.refrescar(), INTERVALO_REFRESCO_MS);
    // Coming back to the tab: the alerts may have changed meanwhile.
    const alVolver = () => {
      if (document.visibilityState === 'visible') this.servicio.refrescar();
    };
    document.addEventListener('visibilitychange', alVolver);
    destroyRef.onDestroy(() => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
    });
  }

  protected alternar(): void {
    const abrir = !this.abierta();
    this.abierta.set(abrir);
    if (abrir) this.servicio.refrescar();
  }

  protected ir(n: Notificacion): void {
    this.abierta.set(false);
    const { ruta, queryParams } = destinoDe(n);
    void this.router.navigate(ruta, { queryParams });
  }

  @HostListener('document:click', ['$event'])
  protected alHacerClicFuera(evento: MouseEvent): void {
    if (this.abierta() && !this.host.nativeElement.contains(evento.target as Node)) this.abierta.set(false);
  }

  @HostListener('document:keydown.escape')
  protected alEscape(): void {
    this.abierta.set(false);
  }
}
