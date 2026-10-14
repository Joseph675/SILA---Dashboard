import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiErrorService } from '../../core/api/api-error';
import { ClaveIdempotente } from '../../core/api/idempotencia';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { imprimirTicket } from '../../shared/utils/imprimir';
import { VerComprobanteComponent } from '../comprobantes/ver-comprobante.component';
import { VENTAS_REPOSITORY } from './data/ventas.provider';
import { VentaResumenComponent } from './venta-resumen.component';

/** Detail of one sale; an ADMIN can annul it while it is PAGADA or PENDIENTE (reason of 10 to 255 characters). */
@Component({
  selector: 'app-venta-detalle-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, DialogComponent, HasRoleDirective, IconComponent, VentaResumenComponent, VerComprobanteComponent],
  template: `
    <app-dialog [open]="idVenta() !== null" [title]="'Venta N.º ' + (idVenta() ?? '')" [wide]="true" (closed)="cerrar.emit()">
      @if (detalle.error()) {
        <div role="alert" class="py-6 text-center">
          <p class="mb-3 font-medium">No se pudo cargar la venta.</p>
          <button type="button" class="sila-btn sila-btn-outline" (click)="detalle.reload()">Reintentar</button>
        </div>
      } @else if (detalle.hasValue()) {
        <app-venta-resumen [detalle]="detalle.value()" />
      } @else {
        <p class="py-6 text-center text-sm text-muted-foreground" aria-busy="true">Cargando…</p>
      }
      <div dialogFooter class="flex flex-wrap gap-2">
        @if (puedeAnular()) {
          <button *hasRole="'ADMIN'" type="button" class="sila-btn sila-btn-outline text-destructive" (click)="confirmando.set(true)">Anular venta</button>
        }
        @if (idVenta() !== null) {
          <app-ver-comprobante tipo="VENTA" [id]="idVenta()!" />
        }
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="!detalle.hasValue()" (click)="imprimir()">
          <app-icon name="lucidePrinter" class="size-4" aria-hidden="true" />
          Imprimir
        </button>
        <button type="button" class="sila-btn sila-btn-primary" (click)="cerrar.emit()">Cerrar</button>
      </div>
    </app-dialog>

    <app-confirm-dialog
      [open]="confirmando()"
      titulo="Anular venta"
      mensaje="La venta quedará anulada: se devuelve el stock y se descuenta la deuda. No se puede deshacer. Si tiene abonos o una factura enviada a la DIAN, no se podrá anular."
      textoConfirmar="Anular venta"
      [peligro]="true"
      [motivo]="regla"
      [ocupado]="anulando()"
      (confirmar)="anular($event)"
      (cancelar)="confirmando.set(false)"
    />
  `,
})
export class VentaDetalleDialogComponent {
  private readonly repo = inject(VENTAS_REPOSITORY);
  private readonly toast = inject(ToastService);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  readonly idVenta = input<number | null>(null);
  readonly cerrar = output<void>();
  /** The sale was annulled: the list must reload. */
  readonly anulada = output<void>();

  protected readonly regla = { min: 10, max: 255 };
  protected readonly confirmando = signal(false);
  protected readonly anulando = signal(false);
  private readonly clave = new ClaveIdempotente();

  protected readonly detalle = rxResource({
    params: () => this.idVenta() ?? undefined,
    stream: ({ params }) => this.repo.detalle(params),
  });

  protected readonly puedeAnular = computed(() => {
    if (!this.detalle.hasValue()) return false;
    const estado = this.detalle.value().venta.estado_pago;
    return estado === 'PAGADA' || estado === 'PENDIENTE';
  });

  protected imprimir(): void {
    imprimirTicket();
  }

  protected anular(motivo: string): void {
    const id = this.idVenta();
    if (id === null || this.anulando()) return;
    this.anulando.set(true);
    this.repo
      .anular(id, motivo, this.clave.para({ id, motivo }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.anulando.set(false);
          this.clave.exito();
          this.confirmando.set(false);
          this.detalle.reload();
          this.anulada.emit();
          this.toast.exito(`Venta N.º ${id} anulada.`);
        },
        error: (fallo: unknown) => {
          this.anulando.set(false);
          this.clave.fallo(fallo);
          this.confirmando.set(false);
          // 20006: the server says why (it has payments, or an invoice sent to the DIAN).
          this.toast.error(mensajeDeFallo(this.errores, fallo, [20006]));
        },
      });
  }
}
