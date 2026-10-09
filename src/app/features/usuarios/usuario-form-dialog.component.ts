import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiErrorService, isApiError } from '../../core/api/api-error';
import type { Rol } from '../../core/auth/auth.models';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { SilaValidators, limpiarTexto } from '../../shared/validators/sila-validators';
import { USUARIOS_REPOSITORY } from './data/usuarios.provider';
import { ROLES, Usuario, UsuarioConClaveTemporal } from './models/usuarios.models';

export interface UsuarioGuardado {
  usuario: Usuario;
  /** Only when a user was created. */
  clave_temporal?: string;
}

@Component({
  selector: 'app-usuario-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule],
  template: `
    <app-dialog [open]="abierto()" [title]="titulo()" [wide]="true" (closed)="cerrar.emit()">
      <form id="usuario-form" class="grid grid-cols-1 gap-4 sm:grid-cols-2" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        <app-form-field
          class="sm:col-span-2"
          etiqueta="Usuario"
          [ayuda]="usuario() ? 'El usuario no se puede cambiar.' : '3 a 100 caracteres en minúscula: letras, números, punto, guion, guion bajo o @.'"
          [obligatorio]="true"
        >
          <input class="sila-input font-mono" formControlName="usuario" maxlength="100" autocomplete="off" autocapitalize="none" spellcheck="false" />
        </app-form-field>

        <app-form-field class="sm:col-span-2" etiqueta="Nombre" ayuda="3 a 120 caracteres." [obligatorio]="true">
          <input class="sila-input" formControlName="nombre" maxlength="120" autocomplete="off" />
        </app-form-field>

        <app-form-field etiqueta="Correo electrónico" [obligatorio]="true">
          <input class="sila-input" type="email" formControlName="email" maxlength="150" autocomplete="off" />
        </app-form-field>

        <app-form-field etiqueta="Rol" [ayuda]="soyYo() ? 'No puedes cambiar tu propio rol.' : ''" [obligatorio]="true">
          <select class="sila-select" formControlName="rol">
            @for (rol of roles; track rol) {
              <option [value]="rol">{{ rol === 'ADMIN' ? 'Administrador' : 'Operativo' }}</option>
            }
          </select>
        </app-form-field>
      </form>

      @if (errorGeneral(); as mensaje) {
        <p class="mt-4 rounded-md bg-destructive/15 px-3 py-2 text-sm" role="alert">{{ mensaje }}</p>
      }

      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="guardando()" (click)="cerrar.emit()">Cancelar</button>
        <button type="submit" form="usuario-form" class="sila-btn sila-btn-primary" [disabled]="guardando()" [attr.aria-busy]="guardando()">
          {{ guardando() ? 'Guardando…' : usuario() ? 'Guardar' : 'Crear usuario' }}
        </button>
      </div>
    </app-dialog>
  `,
})
export class UsuarioFormDialogComponent {
  private readonly repo = inject(USUARIOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /** `null` = new user. */
  readonly usuario = input<Usuario | null>(null);
  readonly abierto = input(false);
  /** Editing my own account: the role cannot change (the API refuses it too). */
  readonly soyYo = input(false);

  readonly guardado = output<UsuarioGuardado>();
  readonly cerrar = output<void>();

  protected readonly roles = ROLES;
  protected readonly titulo = computed(() => (this.usuario() ? 'Editar usuario' : 'Nuevo usuario'));
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    usuario: ['', [SilaValidators.requerido, SilaValidators.nombreUsuario]],
    nombre: ['', [SilaValidators.requerido, SilaValidators.longitud(3, 120)]],
    email: ['', [SilaValidators.requerido, Validators.email, SilaValidators.longitud(1, 150)]],
    rol: ['OPERATIVO' as Rol, Validators.required],
  });

  constructor() {
    effect(() => {
      if (!this.abierto()) return;
      const u = this.usuario();
      this.errorGeneral.set(null);
      this.form.reset({ usuario: u?.usuario ?? '', nombre: u?.nombre ?? '', email: u?.email ?? '', rol: u?.rol ?? 'OPERATIVO' });
      // The user name is the identity: it is only typed when creating.
      if (u) this.form.controls.usuario.disable();
      else this.form.controls.usuario.enable();
      if (u && this.soyYo()) this.form.controls.rol.disable();
      else this.form.controls.rol.enable();
    });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const valor = this.form.getRawValue();
    const nombre = limpiarTexto(valor.nombre);
    const email = valor.email.trim().toLowerCase();
    const actual = this.usuario();

    this.guardando.set(true);
    this.errorGeneral.set(null);
    const peticion: Observable<Usuario | UsuarioConClaveTemporal> = actual
      ? this.repo.actualizar(actual.id_usuario, { nombre, email, rol: valor.rol })
      : this.repo.crear({ usuario: valor.usuario.trim(), nombre, email, rol: valor.rol });
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (respuesta) => {
        this.guardando.set(false);
        // Create answers { usuario, clave_temporal }; update answers the user itself.
        this.guardado.emit('clave_temporal' in respuesta ? { usuario: respuesta.usuario, clave_temporal: respuesta.clave_temporal } : { usuario: respuesta });
      },
      error: (fallo: unknown) => {
        this.guardando.set(false);
        if (isApiError(fallo) && fallo.code === 20006) {
          this.form.controls.usuario.setErrors({ duplicado: true });
        }
        this.errorGeneral.set(this.errores.describe(fallo).mensaje);
      },
    });
  }
}
