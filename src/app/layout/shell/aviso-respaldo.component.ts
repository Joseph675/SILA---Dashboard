import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';

/** After signing in with a backup code: warns when 2 or fewer are left (critical at 0) and points to "Mi cuenta". */
@Component({
  selector: 'app-aviso-respaldo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  template: `
    @if (restantes(); as n) {
      <div
        class="mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
        [class]="n.critico ? 'border-destructive bg-destructive/10' : 'border-warning bg-warning/15'"
        role="alert"
      >
        <app-icon [name]="n.critico ? 'lucideCircleAlert' : 'lucideTriangleAlert'" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p class="flex-1">
          <strong>{{ n.critico ? 'Ya no te quedan códigos de respaldo.' : 'Te quedan ' + n.cantidad + (n.cantidad === 1 ? ' código de respaldo.' : ' códigos de respaldo.') }}</strong>
          {{ n.critico ? 'Si pierdes tu teléfono no podrás entrar.' : '' }}
          <a routerLink="/cuenta" class="font-medium underline underline-offset-2">Genera nuevos en Mi cuenta</a>.
        </p>
        <button type="button" class="sila-btn sila-btn-ghost h-7 w-7 shrink-0 px-0" (click)="descartar()">
          <app-icon name="lucideX" class="size-4" aria-hidden="true" />
          <span class="sr-only">Cerrar aviso</span>
        </button>
      </div>
    }
  `,
})
export class AvisoRespaldoComponent {
  private readonly auth = inject(AuthService);

  protected readonly restantes = computed(() => {
    const n = this.auth.codigosRestantes();
    return n !== null && n <= 2 ? { cantidad: n, critico: n === 0 } : null;
  });

  protected descartar(): void {
    this.auth.codigosRestantes.set(null);
  }
}
