import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';
import { ClaveIdempotente } from '../../core/api/idempotencia';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { aplicarCamposDelServidor } from '../../shared/utils/errores-formulario';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { hoyColombia } from '../../shared/utils/fecha-co';
import { formatoCop } from '../../shared/utils/formato-co';
import { SilaValidators } from '../../shared/validators/sila-validators';
import { etiquetaQuincena } from '../periodos/periodos.format';
import { ACOPIO_REPOSITORY } from './data/acopio.provider';
import type { MetodoPagoLechero, PagoLechero, PagoProveedor } from './models/acopio.models';

function fechaNoFutura(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '');
  return valor && valor > hoyColombia() ? { servidor: 'La fecha no puede ser futura.' } : null;
}

const METODOS: readonly { valor: MetodoPagoLechero; etiqueta: string }[] = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
  { valor: 'CHEQUE', etiqueta: 'Cheque' },
  { valor: 'OTRO', etiqueta: 'Otro' },
];

/**
 * Pays a lechero. Milk is paid BY QUINCENA: each payment settles one quincena of milk and cannot exceed its balance.
 * `cerrado` = the person closed the dialog; `registrado` = the payment was made.
 */
@Component({
  selector: 'app-pago-lechero-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, ReactiveFormsModule],
  template: `
    <app-dialog [open]="proveedor() !== null" [title]="'Registrar pago' + (proveedor() ? ' · ' + proveedor()!.nombre : '')" [wide]="true" [cerrable]="!guardando()" (closed)="cerrado.emit()">
      <form id="pago-lechero-form" [formGroup]="form" (ngSubmit)="guardar()" novalidate class="space-y-4">
        @if (errorGeneral(); as mensaje) {
          <p role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" data-testid="error-pago">{{ mensaje }}</p>
        }
        @if (quincenas.error()) {
          <p class="text-sm text-destructive" role="alert">No se pudieron cargar las quincenas del lechero.</p>
        } @else if (conSaldo().length === 0 && quincenas.hasValue()) {
          <p class="rounded-md bg-muted px-3 py-2 text-sm" data-testid="sin-saldo">Este lechero no tiene saldo pendiente en ninguna quincena.</p>
        }

        <app-form-field etiqueta="Quincena que se paga" ayuda="Cada pago liquida una quincena de leche. Por defecto, la más antigua con saldo." [obligatorio]="true">
          <select class="sila-select" formControlName="periodo">
            @for (q of conSaldo(); track q.id_periodo) {
              <option [value]="q.id_periodo">{{ q.anio }} · {{ etiqueta(q) }} — saldo {{ cop(q.saldo) }}</option>
            }
          </select>
        </app-form-field>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <app-form-field etiqueta="Monto (COP)" [ayuda]="seleccionada() ? 'Saldo de esa quincena: ' + cop(seleccionada()!.saldo) : ''" [obligatorio]="true">
              <input class="sila-input" type="number" inputmode="decimal" min="0" step="0.01" formControlName="monto" />
            </app-form-field>
            <button type="button" class="mt-1 text-xs underline" [disabled]="!seleccionada()" (click)="pagarTodo()">Pagar todo el saldo</button>
          </div>
          <app-form-field etiqueta="Fecha del pago" ayuda="Hoy en hora de Colombia, o una anterior." [obligatorio]="true">
            <input class="sila-input" type="date" [max]="hoy()" formControlName="fecha" />
          </app-form-field>
          <app-form-field etiqueta="Medio de pago" [obligatorio]="true">
            <select class="sila-select" formControlName="metodo">
              @for (m of metodos; track m.valor) {
                <option [value]="m.valor">{{ m.etiqueta }}</option>
              }
            </select>
          </app-form-field>
          <app-form-field etiqueta="Referencia (opcional)">
            <input class="sila-input" type="text" maxlength="60" formControlName="referencia" />
          </app-form-field>
        </div>
      </form>

      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="guardando()" (click)="cerrado.emit()">Cancelar</button>
        <button type="submit" form="pago-lechero-form" class="sila-btn sila-btn-primary" [disabled]="guardando() || conSaldo().length === 0" [attr.aria-busy]="guardando()">
          {{ guardando() ? 'Registrando…' : 'Registrar pago' }}
        </button>
      </div>
    </app-dialog>
  `,
})
export class PagoLecheroDialogComponent {
  private readonly repo = inject(ACOPIO_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /** The lechero being paid; `null` = closed. */
  readonly proveedor = input<{ id_proveedor: number; nombre: string } | null>(null);
  /** Quincena preselected (when the dialog opens from a quincena row). */
  readonly periodoInicial = input<number | null>(null);

  readonly registrado = output<PagoProveedor>();
  readonly cerrado = output<void>();

  protected readonly metodos = METODOS;
  protected readonly cop = formatoCop;
  protected readonly etiqueta = (q: PagoLechero) => etiquetaQuincena(q.mes, q.quincena);
  protected readonly hoy = signal(hoyColombia());
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  private readonly clave = new ClaveIdempotente();

  protected readonly quincenas = rxResource({
    params: () => this.proveedor()?.id_proveedor,
    stream: ({ params }) => this.repo.pagoLecheros({ id_proveedor: params, page: 0, size: 50 }),
  });
  /** Quincenas with something still owed, oldest first. */
  protected readonly conSaldo = computed(() =>
    (this.quincenas.hasValue() ? this.quincenas.value().items : [])
      .filter((q) => q.saldo > 0)
      .sort((a, b) => a.anio - b.anio || a.mes - b.mes || a.quincena - b.quincena),
  );

  protected readonly form = inject(NonNullableFormBuilder).group({
    periodo: ['', [SilaValidators.requerido]],
    monto: [null as number | null, [SilaValidators.requerido, SilaValidators.montoPositivo]],
    fecha: [hoyColombia(), [SilaValidators.requerido, fechaNoFutura]],
    metodo: ['EFECTIVO' as MetodoPagoLechero, [SilaValidators.requerido]],
    referencia: [''],
  });
  private readonly periodoElegido = signal('');
  protected readonly seleccionada = computed(() => this.conSaldo().find((q) => String(q.id_periodo) === this.periodoElegido()) ?? null);

  constructor() {
    effect(() => {
      if (this.proveedor()) {
        this.hoy.set(hoyColombia());
        this.form.reset({ periodo: '', monto: null, fecha: hoyColombia(), metodo: 'EFECTIVO', referencia: '' });
        this.errorGeneral.set(null);
        this.guardando.set(false);
        this.clave.descartar();
      }
    });
    // Default quincena: the preselected one or the oldest with a balance, once the list arrives.
    effect(() => {
      const lista = this.conSaldo();
      if (lista.length === 0) return;
      const inicial = this.periodoInicial();
      const elegida = lista.find((q) => q.id_periodo === inicial) ?? lista[0];
      this.form.controls.periodo.setValue(String(elegida.id_periodo));
    });
    this.form.controls.periodo.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => this.periodoElegido.set(v));
  }

  protected pagarTodo(): void {
    const q = this.seleccionada();
    if (q) this.form.controls.monto.setValue(q.saldo);
  }

  protected guardar(): void {
    const p = this.proveedor();
    if (!p || this.guardando()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const v = this.form.getRawValue();
    const referencia = v.referencia.trim();
    const cuerpo = {
      id_proveedor: p.id_proveedor,
      id_periodo_liquidado: Number(v.periodo),
      monto: Number(v.monto),
      metodo_pago: v.metodo,
      ...(referencia ? { referencia_pago: referencia } : {}),
      fecha_pago: v.fecha,
    };
    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.repo
      .registrarPago(cuerpo, this.clave.para(cuerpo))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pago) => {
          this.guardando.set(false);
          this.clave.exito();
          this.registrado.emit(pago);
        },
        error: (fallo: unknown) => {
          this.guardando.set(false);
          this.clave.fallo(fallo);
          const error = causaDe(fallo);
          if (isApiError(error) && error.code === 20017) this.clave.descartar();
          if (isApiError(error) && error.code === 20005) {
            this.errorGeneral.set(`El pago supera el saldo de esa quincena (${error.message})`);
            return;
          }
          if (isApiError(error) && error.code === 20001) {
            const resto = aplicarCamposDelServidor(this.form, error.fields, { id_periodo_liquidado: 'periodo', referencia_pago: 'referencia', fecha_pago: 'fecha', metodo_pago: 'metodo' });
            this.errorGeneral.set(resto.length > 0 ? `${error.message} ${resto.join('; ')}` : error.message);
            return;
          }
          // 409: the quincena of the payment date is closed (or other state); the server says it.
          this.errorGeneral.set(mensajeDeFallo(this.errores, fallo, [20004, 20006, 20007, 20009, 20010]));
        },
      });
  }
}
