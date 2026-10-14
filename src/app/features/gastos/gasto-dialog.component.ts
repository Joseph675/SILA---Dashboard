import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';
import { ClaveIdempotente } from '../../core/api/idempotencia';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { aplicarCamposDelServidor } from '../../shared/utils/errores-formulario';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { hoyColombia } from '../../shared/utils/fecha-co';
import { SilaValidators, limpiarTexto } from '../../shared/validators/sila-validators';
import { GASTOS_REPOSITORY } from './data/gastos.provider';
import type { CategoriaGasto, Gasto, NuevoGasto } from './models/gastos.models';

/** The date is optional; if given it cannot be in the future (Colombia). */
function fechaNoFutura(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '');
  return valor && valor > hoyColombia() ? { servidor: 'La fecha no puede ser futura.' } : null;
}

/** Registers an expense. It cannot be edited or deleted afterwards: an ADMIN annuls it and the right one is registered. */
@Component({
  selector: 'app-gasto-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, IconComponent, ReactiveFormsModule],
  template: `
    <app-dialog [open]="abierto()" title="Registrar gasto" description="No se puede editar ni borrar después: si te equivocas, un administrador lo anula y registras el correcto." [cerrable]="!guardando()" (closed)="cerrar.emit()">
      <form id="gasto-form" [formGroup]="form" (ngSubmit)="guardar()" novalidate class="space-y-4">
        @if (errorGeneral(); as mensaje) {
          <p role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" data-testid="error-gasto">{{ mensaje }}</p>
        }
        <p class="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm" data-testid="aviso-insumos">
          <app-icon name="lucideInfo" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Las compras de ingredientes y empaques se registran en Insumos, no como gasto.
        </p>
        <app-form-field etiqueta="Categoría" ayuda="Solo las categorías activas." [obligatorio]="true">
          <select class="sila-select" formControlName="categoria">
            <option value="">Elige una categoría…</option>
            @for (c of activas(); track c.id_categoria) {
              <option [value]="c.id_categoria">{{ c.nombre }}</option>
            }
          </select>
        </app-form-field>
        <app-form-field etiqueta="Concepto" ayuda="De 3 a 255 caracteres." [obligatorio]="true">
          <input class="sila-input" type="text" maxlength="255" formControlName="concepto" autocomplete="off" />
        </app-form-field>
        <div class="grid gap-4 sm:grid-cols-2">
          <app-form-field etiqueta="Monto (COP)" ayuda="Mayor que 0, hasta 2 decimales." [obligatorio]="true">
            <input class="sila-input" type="number" inputmode="decimal" min="0" step="0.01" formControlName="monto" />
          </app-form-field>
          <app-form-field etiqueta="Fecha del gasto (opcional)" ayuda="Si la dejas vacía, hoy. No puede ser futura.">
            <input class="sila-input" type="date" [max]="hoy()" formControlName="fecha" />
          </app-form-field>
        </div>
      </form>
      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="guardando()" (click)="cerrar.emit()">Cancelar</button>
        <button type="submit" form="gasto-form" class="sila-btn sila-btn-primary" [disabled]="guardando()" [attr.aria-busy]="guardando()">{{ guardando() ? 'Registrando…' : 'Registrar gasto' }}</button>
      </div>
    </app-dialog>
  `,
})
export class GastoDialogComponent {
  private readonly repo = inject(GASTOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly abierto = input(false);
  /** The categories that are active (from `GET /finanzas/categorias?soloActivas=true`). */
  readonly categorias = input.required<readonly CategoriaGasto[]>();

  readonly registrado = output<Gasto>();
  readonly cerrar = output<void>();

  protected readonly hoy = signal(hoyColombia());
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly activas = computed(() => this.categorias().filter((c) => c.activo));
  private readonly clave = new ClaveIdempotente();

  protected readonly form = inject(NonNullableFormBuilder).group({
    categoria: ['', [SilaValidators.requerido]],
    concepto: ['', [SilaValidators.requerido, SilaValidators.longitud(3, 255)]],
    monto: [null as number | null, [SilaValidators.requerido, SilaValidators.montoPositivo]],
    fecha: ['', [fechaNoFutura]],
  });

  constructor() {
    effect(() => {
      if (this.abierto()) {
        this.hoy.set(hoyColombia());
        this.form.reset({ categoria: '', concepto: '', monto: null, fecha: '' });
        this.errorGeneral.set(null);
        this.guardando.set(false);
        this.clave.descartar();
      }
    });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const v = this.form.getRawValue();
    const cuerpo: NuevoGasto = {
      id_categoria: Number(v.categoria),
      concepto: limpiarTexto(v.concepto),
      monto: Number(v.monto),
      ...(v.fecha ? { fecha_gasto: v.fecha } : {}),
    };
    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.repo
      .crear(cuerpo, this.clave.para(cuerpo))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (gasto) => {
          this.guardando.set(false);
          this.clave.exito();
          this.registrado.emit(gasto);
        },
        error: (fallo: unknown) => {
          this.guardando.set(false);
          this.clave.fallo(fallo);
          const error = causaDe(fallo);
          if (isApiError(error) && error.code === 20017) this.clave.descartar();
          if (isApiError(error) && error.code === 20001) {
            const resto = aplicarCamposDelServidor(this.form, error.fields, { id_categoria: 'categoria', fecha_gasto: 'fecha' });
            this.errorGeneral.set(resto.length > 0 ? `${error.message} ${resto.join('; ')}` : 'Hay datos inválidos. Revisa los campos marcados.');
            return;
          }
          // 409 / 20010: the quincena of that date is closed; 409 / 20006: the category is inactive. The server says which.
          this.errorGeneral.set(mensajeDeFallo(this.errores, fallo, [20004, 20006, 20007, 20010]));
        },
      });
  }
}
