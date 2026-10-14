import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import type { Notificacion } from './models/notificaciones.models';
import { NotificacionFilaComponent } from './notificacion-fila.component';
import { destinoDe } from './notificaciones.logica';
import { NotificacionesService } from './notificaciones.service';

/** All the alerts, grouped by severity. They stay in the list after being marked as read. */
@Component({
  selector: 'app-notificaciones-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificacionFilaComponent, PageHeaderComponent],
  template: `
    <app-page-header title="Notificaciones" description="Lo que necesita atención hoy: stock bajo, lotes por vencer, cartera, quincenas sin cerrar, leche por pagar y documentos con error. Se calculan al momento y desaparecen solas cuando se resuelven.">
      <button type="button" class="sila-btn sila-btn-outline" [disabled]="servicio.noVistas().length === 0" (click)="servicio.marcarTodasLeidas()">Marcar todas como leídas</button>
    </app-page-header>

    @if (!servicio.cargado()) {
      <p class="text-sm text-muted-foreground" aria-busy="true">Cargando…</p>
    } @else if (servicio.items().length === 0) {
      <p class="sila-card p-8 text-center text-sm text-muted-foreground" data-testid="todo-en-orden">Todo en orden: no hay alertas.</p>
    } @else {
      @if (servicio.criticas().length > 0) {
        <section class="mb-6" aria-labelledby="notif-criticas">
          <h2 id="notif-criticas" class="mb-2 text-base font-semibold text-destructive">Críticas ({{ servicio.criticas().length }})</h2>
          <div class="sila-card divide-y divide-border p-1" data-testid="grupo-criticas">
            @for (n of servicio.criticas(); track n.clave) {
              <app-notificacion-fila [notificacion]="n" [leida]="servicio.esLeida(n)" (abrir)="ir($event)" />
            }
          </div>
        </section>
      }
      @if (servicio.advertencias().length > 0) {
        <section aria-labelledby="notif-adv">
          <h2 id="notif-adv" class="mb-2 text-base font-semibold text-warning">Advertencias ({{ servicio.advertencias().length }})</h2>
          <div class="sila-card divide-y divide-border p-1" data-testid="grupo-advertencias">
            @for (n of servicio.advertencias(); track n.clave) {
              <app-notificacion-fila [notificacion]="n" [leida]="servicio.esLeida(n)" (abrir)="ir($event)" />
            }
          </div>
        </section>
      }
    }
  `,
})
export class NotificacionesPageComponent {
  protected readonly servicio = inject(NotificacionesService);
  private readonly router = inject(Router);

  constructor() {
    this.servicio.refrescar();
  }

  protected ir(n: Notificacion): void {
    const { ruta, queryParams } = destinoDe(n);
    void this.router.navigate(ruta, { queryParams });
  }
}
