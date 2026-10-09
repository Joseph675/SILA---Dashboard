import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiErrorService } from '../../core/api/api-error';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { SesionesListaComponent } from '../../shared/ui/sesiones-lista/sesiones-lista.component';
import { USUARIOS_REPOSITORY } from './data/usuarios.provider';
import type { Usuario } from './models/usuarios.models';

/** Read-only list of someone's open sessions (admin). Closing them is a separate, confirmed action on the row. */
@Component({
  selector: 'app-usuario-sesiones-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, SesionesListaComponent],
  template: `
    <app-dialog [open]="usuario() !== null" [wide]="true" [title]="'Sesiones de ' + (usuario()?.nombre ?? '')" [description]="usuario()?.usuario ?? ''" (closed)="cerrar.emit()">
      <app-sesiones-lista [sesiones]="lista()" [cargando]="sesiones.isLoading()" [error]="error()" (reintentar)="sesiones.reload()" />
      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" (click)="cerrar.emit()">Cerrar</button>
      </div>
    </app-dialog>
  `,
})
export class UsuarioSesionesDialogComponent {
  private readonly repo = inject(USUARIOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);

  readonly usuario = input<Usuario | null>(null);
  readonly cerrar = output<void>();

  protected readonly sesiones = rxResource({
    params: () => this.usuario()?.id_usuario,
    stream: ({ params }) => this.repo.sesiones(params),
  });
  protected readonly lista = computed(() => (this.sesiones.hasValue() ? this.sesiones.value() : undefined));
  protected readonly error = computed(() => (this.sesiones.error() ? this.errores.describe(this.sesiones.error()).mensaje : null));
}
