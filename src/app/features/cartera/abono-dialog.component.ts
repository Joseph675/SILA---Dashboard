import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ApiErrorService } from '../../core/api/api-error';
import { ClaveIdempotente } from '../../core/api/idempotencia';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { redondear2 } from '../../shared/utils/dinero';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { formatoCop, formatoFecha } from '../../shared/utils/formato-co';
import { imprimirTicket } from '../../shared/utils/imprimir';
import { MetodoPago } from '../ventas/models/ventas.models';
import { PagoFila, aNumero, montoDePago, totalPagado } from '../ventas/ticket.calculos';
import { METODOS_PAGO, etiquetaMetodo } from '../ventas/ventas.format';
import { repartirAbono } from './cartera.calculos';
import { CARTERA_REPOSITORY } from './data/cartera.provider';
import type { ClienteCartera, Recibo } from './models/cartera.models';

const MAX_FILAS = 6;
let siguiente = 1;
const filaNueva = (metodo: MetodoPago = 'EFECTIVO'): PagoFila => ({ uid: siguiente++, metodo, montoTexto: '', referencia: '' });

/**
 * Registers a payment on a client's debt. Each payment takes ONE method, so a mixed payment is sent as
 * ONE REQUEST PER ROW, in order, each with its own `Idempotency-Key`. If one fails, the next ones are NOT sent
 * and the dialog says what was registered and what was not.
 */
@Component({
  selector: 'app-abono-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, IconComponent],
  template: `
    <app-dialog [open]="cliente() !== null" [title]="'Registrar abono' + (cliente() ? ' · ' + cliente()!.cliente : '')" [wide]="true" [cerrable]="!enviando()" (closed)="cerrar()">
      @if (cliente(); as c) {
        <div class="space-y-4 text-sm">
          <p>Deuda total: <strong class="text-base" data-testid="deuda-total">{{ cop(deudaActual()) }}</strong></p>

          @if (recibos().length > 0) {
            <div class="zona-impresion-ticket space-y-3 rounded-md border border-success/40 bg-success/10 p-3" data-testid="recibos" role="status">
              <p class="font-semibold">
                <app-icon name="lucideCircleCheck" class="me-1 inline size-4 text-success" aria-hidden="true" />
                Abonos registrados ({{ recibos().length }})
              </p>
              @for (r of recibos(); track r.id_recibo) {
                <div>
                  <p class="font-medium">Recibo N.º {{ r.id_recibo }} · {{ metodoDe(r) }} · {{ cop(totalDe(r)) }}</p>
                  <ul class="text-xs text-muted-foreground">
                    @for (a of r.abonos; track a.id_abono) {
                      <li>Venta N.º {{ a.id_venta }}: {{ cop(a.monto) }}</li>
                    }
                  </ul>
                  <p class="text-xs">Saldo restante del cliente: <strong>{{ cop(r.saldo_restante) }}</strong></p>
                </div>
              }
            </div>
          }

          @if (error(); as mensaje) {
            <p role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2" data-testid="error-abono">{{ mensaje }}</p>
          }

          @if (filas().length > 0) {
            <div class="space-y-2">
              <p class="font-medium">Medios de pago</p>
              @for (f of filas(); track f.uid) {
                <div class="flex flex-wrap items-end gap-2 rounded-md bg-muted/50 p-2">
                  <div>
                    <label [for]="'ab-metodo-' + f.uid" class="mb-1 block text-xs text-muted-foreground">Medio</label>
                    <select [id]="'ab-metodo-' + f.uid" class="sila-select h-9 w-40" (change)="cambiar(f.uid, { metodo: $any($event.target).value })">
                      @for (m of metodos; track m.valor) {
                        <option [value]="m.valor" [selected]="m.valor === f.metodo">{{ m.etiqueta }}</option>
                      }
                    </select>
                  </div>
                  <div>
                    <label [for]="'ab-monto-' + f.uid" class="mb-1 block text-xs text-muted-foreground">Monto</label>
                    <input [id]="'ab-monto-' + f.uid" type="text" inputmode="decimal" class="sila-input h-9 w-36 text-end" [value]="f.montoTexto" (input)="cambiar(f.uid, { montoTexto: $any($event.target).value })" />
                  </div>
                  <div class="min-w-32 flex-1">
                    <label [for]="'ab-ref-' + f.uid" class="mb-1 block text-xs text-muted-foreground">Referencia (opcional)</label>
                    <input [id]="'ab-ref-' + f.uid" type="text" maxlength="60" class="sila-input h-9" [value]="f.referencia" (input)="cambiar(f.uid, { referencia: $any($event.target).value })" />
                  </div>
                  <button type="button" class="text-xs underline" (click)="toda(f.uid)">Toda la deuda</button>
                  @if (filas().length > 1) {
                    <button type="button" class="sila-btn sila-btn-ghost h-9 w-9 px-0" (click)="quitar(f.uid)">
                      <app-icon name="lucideTrash2" class="size-4" aria-hidden="true" />
                      <span class="sr-only">Quitar este medio</span>
                    </button>
                  }
                </div>
              }
              <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" [disabled]="filas().length >= maxFilas || enviando()" (click)="agregar()">Agregar otro medio</button>
            </div>

            <div>
              <p class="font-medium">Ventas pendientes</p>
              <p class="mb-2 text-xs text-muted-foreground">El pago se aplica primero a la venta más antigua.</p>
              @if (pendientes.error()) {
                <p class="text-xs text-destructive">No se pudieron cargar las ventas pendientes.</p>
              } @else if (pendientes.hasValue()) {
                <ul class="divide-y divide-border rounded-md border border-border" data-testid="reparto">
                  @for (v of pendientes.value(); track v.id_venta) {
                    <li class="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                      <span>Venta N.º {{ v.id_venta }} · vence {{ fecha(v.fecha_vencimiento) }}@if (v.dias_mora > 0) { <span class="text-destructive"> · {{ v.dias_mora }} días de mora</span> }</span>
                      <span class="tabular-nums">
                        Saldo {{ cop(v.saldo_pendiente) }}
                        @if (aplicadoA(v.id_venta); as a) {
                          <span class="ms-2 font-medium text-primary">→ cubre {{ cop(a.aplicado) }} (queda {{ cop(a.saldo_despues) }})</span>
                        }
                      </span>
                    </li>
                  }
                </ul>
                <p class="mt-1 text-xs text-muted-foreground">Vista previa del reparto; el recibo que devuelve el sistema es el definitivo.</p>
              }
            </div>

            <p class="rounded-md bg-muted px-3 py-2 font-medium" role="status" data-testid="total-abono">
              Total a abonar: {{ cop(total()) }}
              @if (bloqueo(); as b) {
                <span class="block text-xs font-normal text-muted-foreground">{{ b }}</span>
              }
            </p>
          } @else if (c) {
            <p class="text-xs text-muted-foreground">Todos los abonos quedaron registrados.</p>
          }
        </div>
      }
      <div dialogFooter class="flex flex-wrap gap-2">
        @if (recibos().length > 0) {
          <button type="button" class="sila-btn sila-btn-outline" (click)="imprimir()">
            <app-icon name="lucidePrinter" class="size-4" aria-hidden="true" />
            Imprimir recibo
          </button>
        }
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="enviando()" (click)="cerrar()">{{ filas().length === 0 ? 'Cerrar' : 'Cancelar' }}</button>
        @if (filas().length > 0) {
          <button type="button" class="sila-btn sila-btn-primary" [disabled]="bloqueo() !== null || enviando()" [attr.aria-busy]="enviando()" (click)="registrar()">
            {{ enviando() ? 'Registrando…' : filas().length > 1 ? 'Registrar abonos' : 'Registrar abono' }}
          </button>
        }
      </div>
    </app-dialog>
  `,
})
export class AbonoDialogComponent {
  private readonly repo = inject(CARTERA_REPOSITORY);
  private readonly errores = inject(ApiErrorService);

  /** The client being paid; `null` = closed. */
  readonly cliente = input<ClienteCartera | null>(null);
  /** At least one receipt was registered: the lists behind must reload. */
  readonly registrado = output<void>();
  readonly cerrado = output<void>();

  protected readonly cop = formatoCop;
  protected readonly fecha = formatoFecha;
  protected readonly metodos = METODOS_PAGO;
  protected readonly maxFilas = MAX_FILAS;

  protected readonly filas = signal<PagoFila[]>([filaNueva()]);
  protected readonly recibos = signal<Recibo[]>([]);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** One key per row: kept for retrying THAT row, never shared. */
  private readonly claves = new Map<number, ClaveIdempotente>();

  protected readonly pendientes = rxResource({
    params: () => this.cliente()?.id_cliente,
    stream: ({ params }) => this.repo.ventasPendientes(params),
  });

  /** The client's debt now: the balance of the last receipt, if any was registered; otherwise the one in the list. */
  protected readonly deudaActual = computed(() => {
    const recibos = this.recibos();
    return recibos.length > 0 ? recibos[recibos.length - 1].saldo_restante : (this.cliente()?.saldo_deudor ?? 0);
  });
  protected readonly total = computed(() => totalPagado(this.filas()));

  /** Why «Registrar» is disabled, or `null`. */
  protected readonly bloqueo = computed<string | null>(() => {
    const filas = this.filas();
    if (filas.some((f) => montoDePago(f) === null)) return 'Escribe un monto mayor que 0, con máximo 2 decimales, en cada medio.';
    if (this.total() > this.deudaActual()) return `El total supera la deuda del cliente (${formatoCop(this.deudaActual())}).`;
    return null;
  });

  private readonly reparto = computed(() => new Map(repartirAbono(this.total(), this.pendientes.hasValue() ? this.pendientes.value() : []).map((r) => [r.id_venta, r])));

  constructor() {
    effect(() => {
      if (this.cliente()) {
        untracked(() => {
          this.filas.set([filaNueva()]);
          this.recibos.set([]);
          this.error.set(null);
          this.enviando.set(false);
          this.claves.clear();
        });
      }
    });
  }

  protected aplicadoA(idVenta: number) {
    return this.reparto().get(idVenta) ?? null;
  }

  protected otrosMontos(uid: number): number {
    return totalPagado(this.filas().filter((f) => f.uid !== uid));
  }

  /** Puts in this row the part of the debt the other rows do not cover. */
  protected toda(uid: number): void {
    const resto = redondear2(this.deudaActual() - this.otrosMontos(uid));
    this.cambiar(uid, { montoTexto: resto > 0 ? String(resto) : '' });
  }

  protected cambiar(uid: number, cambio: Partial<PagoFila>): void {
    this.filas.update((fs) => fs.map((f) => (f.uid === uid ? { ...f, ...cambio } : f)));
  }

  protected agregar(): void {
    if (this.filas().length < MAX_FILAS) this.filas.update((fs) => [...fs, filaNueva('TRANSFERENCIA')]);
  }

  protected quitar(uid: number): void {
    this.filas.update((fs) => (fs.length > 1 ? fs.filter((f) => f.uid !== uid) : fs));
  }

  protected metodoDe(r: Recibo): string {
    return r.abonos[0] ? etiquetaMetodo(r.abonos[0].metodo_pago) : '';
  }

  protected totalDe(r: Recibo): number {
    return r.abonos.reduce((s, a) => s + a.monto, 0);
  }

  protected imprimir(): void {
    imprimirTicket();
  }

  protected cerrar(): void {
    if (this.enviando()) return;
    this.cerrado.emit();
  }

  /** One request per row, in order. The first failure stops the rest. */
  protected async registrar(): Promise<void> {
    const c = this.cliente();
    if (!c || this.bloqueo() !== null || this.enviando()) return;
    this.enviando.set(true);
    this.error.set(null);
    const hechos = this.recibos().length;
    let registrados = 0;
    for (const fila of [...this.filas()]) {
      const referencia = fila.referencia.trim();
      const cuerpo = { id_cliente: c.id_cliente, monto: aNumero(fila.montoTexto), metodo_pago: fila.metodo, ...(referencia ? { referencia } : {}) };
      const clave = this.claves.get(fila.uid) ?? new ClaveIdempotente();
      this.claves.set(fila.uid, clave);
      try {
        const recibo = await firstValueFrom(this.repo.registrarAbono(cuerpo, clave.para(cuerpo)));
        clave.exito();
        registrados++;
        this.recibos.update((rs) => [...rs, recibo]);
        this.filas.update((fs) => fs.filter((f) => f.uid !== fila.uid));
        this.claves.delete(fila.uid);
      } catch (fallo) {
        clave.fallo(fallo);
        const motivo = mensajeDeFallo(this.errores, fallo, [20001, 20005]);
        const pendientesFilas = this.filas().length;
        const previo = hechos + registrados;
        this.error.set(
          `No se pudo registrar el abono de ${formatoCop(cuerpo.monto)} en ${etiquetaMetodo(fila.metodo)}: ${motivo} ` +
            (previo > 0
              ? `Ya quedaron registrados ${previo} abono(s) y NO se enviaron los demás (${pendientesFilas - 1}). Los que faltan siguen en la lista: corrige y vuelve a intentar.`
              : 'No se registró ningún abono.'),
        );
        break;
      }
    }
    this.enviando.set(false);
    if (registrados > 0) {
      this.pendientes.reload();
      this.registrado.emit();
    }
  }
}
