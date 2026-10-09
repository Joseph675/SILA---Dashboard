import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { causaDe, isApiError } from '../../core/api/api-error';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { AuthService } from '../../core/services/auth.service';
import { PERIODOS_REPOSITORY } from '../../features/periodos/data/periodos.provider';
import { etiquetaQuincenaCorta } from '../../features/periodos/periodos.format';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';

/** Código de "la entidad no existe": para `periodos/actual`, que no hay quincena creada para hoy. */
const NO_EXISTE = 20007;

/**
 * Chip of the header with the quincena that contains today. Loaded once when
 * the header is created, so it does not follow a close/reopen done later on
 * the Períodos screen until the page is reloaded.
 */
@Component({
  selector: 'app-quincena-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HasRoleDirective, RouterLink, StatusChipComponent],
  template: `
    @if (periodo(); as p) {
      @if (esAdmin()) {
        <!-- SUPUESTO: CP-01. Para un ADMIN el chip lleva a «Cuentas de la quincena» (esa pantalla es de Finanzas, solo ADMIN). -->
        <a [routerLink]="['/periodos', p.id_periodo]" class="hidden rounded-md hover:opacity-80 sm:inline-flex" title="Ver las cuentas de esta quincena">
          <app-status-chip [texto]="etiqueta(p)" [tono]="p.estado === 'ABIERTA' ? 'exito' : 'neutro'" />
        </a>
      } @else {
        <app-status-chip class="hidden sm:inline-flex" [texto]="etiqueta(p)" [tono]="p.estado === 'ABIERTA' ? 'exito' : 'neutro'" />
      }
    } @else if (sinQuincena()) {
      <!-- SUPUESTO: sin quincena creada, solo un ADMIN ve el aviso (con enlace para crearla); un OPERATIVO no ve nada. -->
      <a
        *hasRole="'ADMIN'"
        routerLink="/periodos"
        class="hidden items-center rounded-md px-2 py-0.5 text-xs font-medium underline underline-offset-2 hover:text-primary sm:inline-flex"
      >
        Sin quincena
      </a>
    }
  `,
})
export class QuincenaChipComponent {
  private readonly repo = inject(PERIODOS_REPOSITORY);
  private readonly auth = inject(AuthService);
  protected readonly esAdmin = computed(() => this.auth.rol() === 'ADMIN');
  private readonly actual = rxResource({ stream: () => this.repo.actual() });

  protected readonly periodo = computed(() => (this.actual.hasValue() ? this.actual.value() : null));
  protected readonly sinQuincena = computed(() => {
    const causa = causaDe(this.actual.error());
    return isApiError(causa) && causa.code === NO_EXISTE;
  });

  protected etiqueta(p: { mes: number; quincena: number; anio: number; estado: string }): string {
    return `${etiquetaQuincenaCorta(p.mes, p.quincena, p.anio)} · ${p.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'}`;
  }
}
