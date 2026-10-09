import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';
import { ClaveIdempotente } from '../../core/api/idempotencia';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { OpcionSelector, SelectorBuscableComponent } from '../../shared/ui/selector-buscable/selector-buscable.component';
import { aplicarCamposDelServidor } from '../../shared/utils/errores-formulario';
import { hoyColombia } from '../../shared/utils/fecha-co';
import { formatoCop } from '../../shared/utils/formato-co';
import { SilaValidators } from '../../shared/validators/sila-validators';
import { ACOPIO_REPOSITORY } from './data/acopio.provider';
import type { NuevaRecepcion, Recepcion, Umbrales } from './models/acopio.models';

/** A reception cannot be dated after today (Colombia). Compared as `AAAA-MM-DD` text, which sorts like dates. */
function fechaNoFutura(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '');
  return valor && valor > hoyColombia() ? { servidor: 'La fecha no puede ser futura.' } : null;
}

/** Registers a delivery. The page decides what to show afterwards: a REJECTED delivery is a 201, not an error. */
@Component({
  selector: 'app-recepcion-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, FormFieldComponent, IconComponent, ReactiveFormsModule, SelectorBuscableComponent],
  template: `
    <app-dialog
      [open]="abierto()"
      title="Nueva recepción de leche"
      description="Registra la entrega de un proveedor lechero con su control de calidad. No se puede editar ni borrar después."
      [cerrable]="!guardando()"
      (closed)="cerrar.emit()"
    >
      <form id="recepcion-form" [formGroup]="form" (ngSubmit)="guardar()" novalidate class="space-y-4">
        @if (errorGeneral(); as mensaje) {
          <p role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{{ mensaje }}</p>
        }

        <div class="space-y-1.5">
          <label for="recepcion-proveedor" class="text-sm font-medium">Proveedor lechero <span class="text-destructive" aria-hidden="true">*</span></label>
          <app-selector-buscable
            idCampo="recepcion-proveedor"
            [opciones]="proveedores()"
            [(valor)]="proveedor"
            [etiquetaVacia]="null"
            placeholder="Buscar proveedor…"
            [invalido]="!!errorProveedor()"
          />
          <p class="text-xs font-medium text-destructive" aria-live="polite">{{ errorProveedor() }}</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <app-form-field etiqueta="Litros" ayuda="Mayor que 0, hasta 2 decimales." [obligatorio]="true">
            <input class="sila-input" type="number" inputmode="decimal" min="0" step="0.01" formControlName="litros" />
          </app-form-field>
          <app-form-field etiqueta="Fecha de la entrega" ayuda="Hoy en hora de Colombia, o una anterior." [obligatorio]="true">
            <input class="sila-input" type="date" [max]="hoy()" formControlName="fecha" />
          </app-form-field>
          <app-form-field etiqueta="Temperatura (°C)" [ayuda]="ayudaTemperatura()" [obligatorio]="true">
            <input class="sila-input" type="number" inputmode="decimal" min="-5" max="60" step="0.1" formControlName="temperatura" />
          </app-form-field>
          <app-form-field etiqueta="Acidez (°Dornic)" [ayuda]="ayudaAcidez()" [obligatorio]="true">
            <input class="sila-input" type="number" inputmode="decimal" min="0" max="40" step="0.1" formControlName="acidez" />
          </app-form-field>
        </div>

        <div aria-live="polite">
          @if (estimado(); as e) {
            <p class="mb-3 rounded-md bg-muted px-3 py-2 text-sm" data-testid="valor-estimado">
              Precio vigente: <strong>{{ cop(e.precio) }}</strong> por litro@if (e.porDefecto) { <span class="ms-1 rounded bg-background px-1.5 py-0.5 text-xs">precio por defecto</span> }
              @if (e.valor !== null) {
                · Valor estimado: <strong>{{ cop(e.valor) }}</strong>
              }
              @if (motivosRechazo().length > 0) {
                <span class="block text-xs text-muted-foreground">Si la entrega sale RECHAZADA no se paga: su valor queda en $ 0.</span>
              }
            </p>
          }
          @if (motivosRechazo().length > 0) {
            <div class="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-sm" data-testid="aviso-rechazo">
              <app-icon name="lucideTriangleAlert" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <div>
                <p class="font-semibold">Esta entrega será RECHAZADA y no se pagará.</p>
                <p class="text-muted-foreground">{{ motivosRechazo().join(' · ') }} Aun así podrás registrarla: queda guardada como rechazada.</p>
              </div>
            </div>
          }
        </div>
      </form>

      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="guardando()" (click)="cerrar.emit()">Cancelar</button>
        <button type="submit" form="recepcion-form" class="sila-btn sila-btn-primary" [disabled]="guardando()" [attr.aria-busy]="guardando()">
          {{ guardando() ? 'Registrando…' : 'Registrar recepción' }}
        </button>
      </div>
    </app-dialog>
  `,
})
export class RecepcionDialogComponent {
  private readonly repo = inject(ACOPIO_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly abierto = input(false);
  readonly proveedores = input.required<readonly OpcionSelector[]>();
  /** Limits from `GET /acopio/umbrales`; without them there is simply no live warning. */
  readonly umbrales = input<Umbrales | null>(null);
  /** Price per liter in force for each lechero (its own or the default), to estimate the value before sending. */
  readonly precios = input<ReadonlyMap<number, { precio: number; porDefecto: boolean }>>(new Map());

  readonly registrada = output<Recepcion>();
  readonly cerrar = output<void>();

  protected readonly hoy = signal(hoyColombia());
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly proveedor = signal<number | null>(null);
  private readonly proveedorTocado = signal(false);
  private readonly proveedorServidor = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    litros: [null as number | null, [SilaValidators.requerido, SilaValidators.montoPositivo]],
    temperatura: [null as number | null, [SilaValidators.requerido, SilaValidators.rango(-5, 60)]],
    acidez: [null as number | null, [SilaValidators.requerido, SilaValidators.rango(0, 40)]],
    fecha: [hoyColombia(), [SilaValidators.requerido, fechaNoFutura]],
  });

  /** One key per user action: reused only to retry the same data after a network failure. */
  private readonly clave = new ClaveIdempotente();

  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Why the delivery would be rejected, from what is typed. Informational: the server decides. */
  protected readonly motivosRechazo = computed(() => {
    const u = this.umbrales();
    const v = this.valores();
    if (!u) return [];
    const motivos: string[] = [];
    if (v.temperatura != null && Number(v.temperatura) > u.temperatura_max) motivos.push(`La temperatura supera el máximo de ${u.temperatura_max} °C.`);
    if (v.acidez != null && Number(v.acidez) > u.acidez_max) motivos.push(`La acidez supera el máximo de ${u.acidez_max} °Dornic.`);
    return motivos;
  });

  protected readonly cop = formatoCop;
  /** Informational: litros × price. The server fixes the real price and value (0 if rejected). */
  protected readonly estimado = computed(() => {
    const id = this.proveedor();
    const info = id === null ? undefined : this.precios().get(id);
    if (!info) return null;
    const litros = Number(this.valores().litros);
    const valido = this.valores().litros != null && litros > 0;
    return { precio: info.precio, porDefecto: info.porDefecto, valor: valido && this.motivosRechazo().length === 0 ? Math.round(litros * info.precio * 100) / 100 : valido ? 0 : null };
  });

  protected readonly ayudaTemperatura = computed(() => {
    const u = this.umbrales();
    return u ? `Entre −5 y 60. Más de ${u.temperatura_max} °C se rechaza.` : 'Entre −5 y 60.';
  });
  protected readonly ayudaAcidez = computed(() => {
    const u = this.umbrales();
    return u ? `Entre 0 y 40. Más de ${u.acidez_max} °Dornic se rechaza.` : 'Entre 0 y 40.';
  });

  protected readonly errorProveedor = computed(() => {
    if (this.proveedorServidor()) return this.proveedorServidor();
    return this.proveedorTocado() && this.proveedor() === null ? 'Elige el proveedor.' : null;
  });

  constructor() {
    effect(() => {
      if (this.abierto()) {
        // Opening the dialog is a NEW user action: fresh data and a fresh idempotency key.
        this.hoy.set(hoyColombia());
        this.form.reset({ litros: null, temperatura: null, acidez: null, fecha: hoyColombia() });
        this.proveedor.set(null);
        this.proveedorTocado.set(false);
        this.proveedorServidor.set(null);
        this.errorGeneral.set(null);
        this.guardando.set(false);
        this.clave.descartar();
      }
    });
    effect(() => {
      this.proveedor();
      this.proveedorServidor.set(null);
    });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    this.form.markAllAsTouched();
    this.proveedorTocado.set(true);
    const proveedor = this.proveedor();
    if (this.form.invalid || proveedor === null) {
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const v = this.form.getRawValue();
    const cuerpo: NuevaRecepcion = {
      id_proveedor: proveedor,
      litros: Number(v.litros),
      temperatura: Number(v.temperatura),
      acidez: Number(v.acidez),
      fecha: v.fecha,
    };
    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.repo
      .crearRecepcion(cuerpo, this.clave.para(cuerpo))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (recepcion) => {
          this.guardando.set(false);
          this.clave.exito();
          this.registrada.emit(recepcion);
        },
        error: (fallo: unknown) => {
          this.guardando.set(false);
          this.clave.fallo(fallo);
          this.mostrarError(fallo);
        },
      });
  }

  private mostrarError(fallo: unknown): void {
    const error = causaDe(fallo);
    if (!isApiError(error)) {
      this.errorGeneral.set(this.errores.describe(fallo).mensaje);
      return;
    }
    switch (error.code) {
      case 20004:
        this.errorGeneral.set('La quincena de esa fecha está cerrada. Cambia la fecha o pide a un administrador que la reabra.');
        break;
      case 20006:
        this.errorGeneral.set(error.message);
        break;
      case 20017:
        this.clave.descartar();
        this.errorGeneral.set('Esa operación ya se había enviado con otros datos. Revisa la entrega y vuelve a registrarla: se enviará como una operación nueva.');
        break;
      case 20001: {
        const sinCampo = aplicarCamposDelServidor(this.form, error.fields);
        const delProveedor = error.fields?.['id_proveedor'];
        if (delProveedor) this.proveedorServidor.set(delProveedor);
        const resto = sinCampo.filter((texto) => !texto.startsWith('id_proveedor:'));
        this.errorGeneral.set(resto.length > 0 ? `Hay datos inválidos. ${resto.join('; ')}` : 'Hay datos inválidos. Revisa los campos marcados.');
        break;
      }
      default:
        this.errorGeneral.set(this.errores.describe(fallo).mensaje);
    }
  }
}
