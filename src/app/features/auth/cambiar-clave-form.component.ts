import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { CampoCodigoMfaComponent } from './campo-codigo-mfa.component';
import { SilaValidators } from '../../shared/validators/sila-validators';

export interface CambioClave {
  actual: string;
  nueva: string;
  /** Only when the form asks for the second-factor code (signed in). */
  codigo?: string;
}

/**
 * "Change password" form: current, new and confirmation. Used by the login
 * (with the temporary token) and by "Mi cuenta" (with the access token); the
 * parent makes the call. Checks only what the client can know; the API
 * decides the rest (username in the password, obvious words...).
 */
@Component({
  selector: 'app-cambiar-clave-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CampoCodigoMfaComponent, FormFieldComponent, IconComponent, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="enviar()" novalidate class="space-y-4">
      <app-form-field [etiqueta]="etiquetaActual()" [obligatorio]="true">
        <input class="sila-input" [type]="tipo()" formControlName="actual" autocomplete="current-password" maxlength="200" />
      </app-form-field>

      <app-form-field etiqueta="Clave nueva" ayuda="Mínimo 12 caracteres, distinta de la actual y sin tu usuario ni palabras obvias." [obligatorio]="true">
        <input class="sila-input" [type]="tipo()" formControlName="nueva" autocomplete="new-password" maxlength="200" />
      </app-form-field>

      <app-form-field etiqueta="Repite la clave nueva" [obligatorio]="true">
        <input class="sila-input" [type]="tipo()" formControlName="confirmar" autocomplete="new-password" maxlength="200" />
      </app-form-field>

      @if (pedirCodigo()) {
        <app-campo-codigo-mfa [control]="form.controls.codigo" [error]="errorCodigo()" />
      }

      <button type="button" class="sila-btn sila-btn-ghost sila-btn-sm" [attr.aria-pressed]="ver()" (click)="ver.set(!ver())">
        <app-icon [name]="ver() ? 'lucideEyeOff' : 'lucideEye'" class="size-4" aria-hidden="true" />
        {{ ver() ? 'Ocultar claves' : 'Mostrar claves' }}
      </button>

      @if (error(); as mensaje) {
        <p class="rounded-md bg-destructive/15 px-3 py-2 text-sm" role="alert">{{ mensaje }}</p>
      }

      <button type="submit" class="sila-btn sila-btn-primary w-full" [disabled]="ocupado()" [attr.aria-busy]="ocupado()">
        {{ ocupado() ? 'Procesando…' : textoBoton() }}
      </button>
    </form>
  `,
})
export class CambiarClaveFormComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly etiquetaActual = input('Clave actual');
  readonly textoBoton = input('Cambiar clave');
  readonly ocupado = input(false);
  readonly error = input<string | null>(null);
  /** Put the cursor in the first field when it appears (the login does; "Mi cuenta" must not steal focus). */
  readonly enfocar = input(false);
  /** «Mi cuenta» asks for the app code; the first-login step (temporary token) does NOT. */
  readonly pedirCodigo = input(false);
  /** A failure about the code field reported by the server. */
  readonly errorCodigo = input<string | null>(null);

  readonly cambiar = output<CambioClave>();

  protected readonly ver = signal(false);
  protected readonly tipo = () => (this.ver() ? 'text' : 'password');

  protected readonly form = inject(NonNullableFormBuilder).group({
    actual: ['', [SilaValidators.requerido]],
    nueva: ['', [SilaValidators.requerido, SilaValidators.claveNueva, SilaValidators.distintaDe('actual')]],
    confirmar: ['', [SilaValidators.requerido, SilaValidators.igualA('nueva')]],
    // Its validators are set by `app-campo-codigo-mfa`; without the field it is never validated.
    codigo: [''],
  });

  constructor() {
    afterNextRender(() => {
      if (this.enfocar()) this.host.nativeElement.querySelector('input')?.focus();
    });
    // The checks that compare fields must run again when the other field changes.
    effect((onCleanup) => {
      const { actual, nueva, confirmar } = this.form.controls;
      const a = actual.valueChanges.subscribe(() => nueva.updateValueAndValidity({ emitEvent: false }));
      const b = nueva.valueChanges.subscribe(() => confirmar.updateValueAndValidity({ emitEvent: false }));
      onCleanup(() => {
        a.unsubscribe();
        b.unsubscribe();
      });
    });
  }

  protected enviar(): void {
    if (this.ocupado()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const { actual, nueva, codigo } = this.form.getRawValue();
    this.cambiar.emit(this.pedirCodigo() ? { actual, nueva, codigo: codigo.trim() } : { actual, nueva });
  }

  /** Wipes the typed passwords (called by the parent when the step ends). */
  limpiar(): void {
    this.form.reset();
  }

  /** Clears only the code (wrong or already used). */
  limpiarCodigo(): void {
    this.form.controls.codigo.reset('');
  }
}
