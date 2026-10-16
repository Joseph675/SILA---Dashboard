import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiErrorService } from '../../core/api/api-error';
import { EsMovilService } from '../../shared/services/es-movil.service';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { hoyColombia } from '../../shared/utils/fecha-co';
import { ARCHIVOS_REPOSITORY } from '../archivos/data/archivos.provider';
import { DescargaDialogComponent } from '../archivos/descarga-dialog.component';
import type { Archivo } from '../archivos/models/archivos.models';
import { VisorArchivosService } from '../archivos/visor-archivos.service';
import { formatoCop, formatoFecha, formatoNumero } from '../../shared/utils/formato-co';
import { imprimirTicket } from '../../shared/utils/imprimir';
import { chipEstadoComprobante, etiquetaMetodoComprobante, etiquetaTipoComprobante, montoConSigno, numeroLegible } from './comprobantes.format';
import { COMPROBANTES_REPOSITORY } from './data/comprobantes.provider';
import type { TipoComprobante } from './models/comprobantes.models';

/** Detail of one voucher with a print button (the block with `.zona-impresion-ticket` is the only thing printed). */
@Component({
  selector: 'app-comprobante-detalle-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DescargaDialogComponent, DialogComponent, IconComponent, StatusChipComponent],
  template: `
    <app-dialog [open]="documento() !== null" [title]="titulo()" [wide]="true" (closed)="cerrar.emit()">
      @if (detalle.error()) {
        <div role="alert" class="py-6 text-center">
          <p class="mb-3 font-medium" data-testid="error-comprobante">{{ mensajeError() }}</p>
          <button type="button" class="sila-btn sila-btn-outline" (click)="detalle.reload()">Reintentar</button>
        </div>
      } @else if (detalle.hasValue()) {
        @let d = detalle.value();
        @let c = d.comprobante;
        <div class="zona-impresion-ticket space-y-4 text-sm" data-testid="comprobante-impreso">
          <div class="hidden print:block">
            <p class="text-base font-bold">Llanolat · SILA</p>
            <p class="text-xs">Comprobante interno — no es factura electrónica</p>
          </div>
          <dl class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <dt class="text-xs text-muted-foreground">Comprobante</dt>
              <dd class="font-semibold" data-testid="numero-comprobante">{{ numeroLegible(c.numero) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">Fecha</dt>
              <dd>{{ fecha(c.fecha) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">Tipo y estado</dt>
              <dd class="flex flex-wrap items-center gap-2">
                {{ tipo(c.tipo) }}
                <app-status-chip [texto]="chip().texto" [tono]="chip().tono" />
              </dd>
            </div>
            @if (c.tercero) {
              <div>
                <dt class="text-xs text-muted-foreground">{{ c.tercero_tipo === 'PROVEEDOR' ? 'Proveedor' : 'Cliente' }}</dt>
                <dd>{{ c.tercero }}</dd>
              </div>
            }
            @if (c.descripcion) {
              <div class="sm:col-span-2">
                <dt class="text-xs text-muted-foreground">Descripción</dt>
                <dd>{{ c.descripcion }}</dd>
              </div>
            }
            <div>
              <dt class="text-xs text-muted-foreground">Método de pago</dt>
              <dd>{{ metodo(c.metodo_pago) }}@if (c.referencia) { <span class="text-muted-foreground"> · Ref. {{ c.referencia }}</span> }</dd>
            </div>
            @if (!c.afecta_caja) {
              <div>
                <dt class="text-xs text-muted-foreground">Caja</dt>
                <dd>A crédito: no entra a caja hasta que se abona.</dd>
              </div>
            }
            @if (c.usuario_registro) {
              <div class="text-xs text-muted-foreground sm:col-span-2">Registrado por {{ c.usuario_registro }}</div>
            }
          </dl>

          @if (c.estado === 'ANULADO') {
            <p class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2" role="status" data-testid="aviso-anulado">
              <strong>Comprobante anulado.</strong>@if (c.motivo_anulacion) { Motivo: {{ c.motivo_anulacion }} }
            </p>
          }

          @if (d.lineas.length > 0) {
            @if (movil()) {
              <ul class="divide-y divide-border" aria-label="Líneas del comprobante">
                @for (l of d.lineas; track $index) {
                  <li class="min-w-0 space-y-1 py-2">
                    <p class="break-words font-medium">{{ l.concepto }}</p>
                    @if (l.cantidad !== null && l.valor_unitario !== null) {
                      <p class="text-xs text-muted-foreground">{{ numero(l.cantidad) }} × {{ cop(l.valor_unitario) }}</p>
                    }
                    <p class="text-end font-medium tabular-nums">{{ cop(l.valor) }}</p>
                  </li>
                }
              </ul>
            } @else {
              <div class="relative overflow-x-auto">
                <table class="w-full text-left">
                  <caption class="sr-only">Líneas del comprobante</caption>
                  <thead class="text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" class="py-1 pe-2 font-medium">Concepto</th>
                      <th scope="col" class="px-2 py-1 text-end font-medium">Cant.</th>
                      <th scope="col" class="px-2 py-1 text-end font-medium">Valor unitario</th>
                      <th scope="col" class="py-1 ps-2 text-end font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (l of d.lineas; track $index) {
                      <tr class="border-t border-border align-top">
                        <td class="py-1.5 pe-2">{{ l.concepto }}</td>
                        <td class="px-2 py-1.5 text-end tabular-nums">{{ l.cantidad === null ? '—' : numero(l.cantidad) }}</td>
                        <td class="px-2 py-1.5 text-end tabular-nums">{{ l.valor_unitario === null ? '—' : cop(l.valor_unitario) }}</td>
                        <td class="py-1.5 ps-2 text-end tabular-nums">{{ cop(l.valor) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }

          <dl class="ms-auto max-w-xs space-y-1">
            @if (d.subtotal !== null) {
              <div class="flex justify-between"><dt>Subtotal</dt><dd class="tabular-nums" data-testid="subtotal">{{ cop(d.subtotal) }}</dd></div>
            }
            @if (d.iva !== null) {
              <div class="flex justify-between"><dt>IVA</dt><dd class="tabular-nums" data-testid="iva">{{ cop(d.iva) }}</dd></div>
            }
            <div class="flex justify-between border-t border-border pt-1 text-base font-bold">
              <dt>Total</dt>
              <dd class="tabular-nums" data-testid="total-comprobante" [class.line-through]="c.estado === 'ANULADO'">{{ cop(c.monto) }}</dd>
            </div>
            <div class="flex justify-between text-xs text-muted-foreground"><dt>Efecto</dt><dd [class]="signo().clase">{{ signo().texto }}</dd></div>
          </dl>

          @if (d.pagos.length > 0) {
            <div>
              <h3 class="mb-1 text-xs font-medium text-muted-foreground">Pagos</h3>
              <ul class="space-y-0.5" data-testid="pagos-comprobante">
                @for (p of d.pagos; track $index) {
                  <li class="flex justify-between gap-4">
                    <span>{{ metodo(p.metodo_pago) }}@if (p.referencia) { <span class="text-muted-foreground"> · Ref. {{ p.referencia }}</span> }</span>
                    <span class="tabular-nums">{{ cop(p.monto) }}</span>
                  </li>
                }
              </ul>
            </div>
          }

          <!-- The PDFs of the voucher (made by the server). Hidden when printing: only the voucher itself is printed. -->
          <section class="rounded-lg border border-border p-3 print:hidden" aria-labelledby="pdf-comprobante" data-testid="pdf-comprobante">
            <h3 id="pdf-comprobante" class="mb-2 text-sm font-semibold">PDF del comprobante</h3>
            @if (pdfs.error()) {
              <p class="text-sm" role="alert">No se pudo consultar el PDF. <button type="button" class="underline" (click)="pdfs.reload()">Reintentar</button></p>
            } @else if (!pdfs.hasValue()) {
              <p class="text-sm text-muted-foreground" aria-busy="true">Buscando el PDF…</p>
            } @else if (pdfs.value().length === 0) {
              @if (generando()) {
                <p class="text-sm" role="status" data-testid="pdf-generando">El PDF se está generando…</p>
              } @else {
                <p class="text-sm text-muted-foreground" data-testid="pdf-anterior">Este comprobante es anterior a la función de PDF y no tiene archivo.</p>
              }
              <div class="mt-2 flex flex-wrap gap-2">
                <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" disabled>Ver PDF</button>
                <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" disabled>Descargar con clave</button>
              </div>
            } @else {
              <ul class="space-y-3">
                @for (p of pdfs.value(); track p.id_documento) {
                  <li class="flex flex-wrap items-center justify-between gap-2" data-testid="pdf-fila">
                    <span class="flex items-center gap-2 text-sm">
                      {{ p.version === 'ANULADO' ? 'PDF de anulación' : 'PDF original' }}
                      @if (p.version === 'ANULADO') {
                        <app-status-chip texto="ANULADO" tono="peligro" />
                      }
                    </span>
                    <span class="flex flex-wrap gap-2">
                      <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" data-testid="ver-pdf" (click)="verPdf(p)">
                        <app-icon name="lucideEye" class="size-4" aria-hidden="true" />Ver PDF<span class="sr-only"> {{ p.version === 'ANULADO' ? 'de anulación' : 'original' }}</span>
                      </button>
                      <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" data-testid="descargar-pdf" (click)="descargando.set(p)">
                        <app-icon name="lucideDownload" class="size-4" aria-hidden="true" />Descargar con clave<span class="sr-only"> {{ p.version === 'ANULADO' ? 'de anulación' : 'original' }}</span>
                      </button>
                    </span>
                  </li>
                }
              </ul>
              @if (pdfs.value().length > 1) {
                <p class="mt-2 text-xs text-muted-foreground" data-testid="original-conservado">El original se conserva sin modificar.</p>
              }
            }
          </section>

          <p class="border-t border-border pt-2 text-xs text-muted-foreground" data-testid="aviso-interno">Comprobante interno — no es factura electrónica.</p>
        </div>
      } @else {
        <p class="py-6 text-center text-sm text-muted-foreground" aria-busy="true">Cargando…</p>
      }
      <div dialogFooter class="flex flex-wrap gap-2">
        <button type="button" class="sila-btn sila-btn-outline" data-testid="imprimir" [disabled]="!detalle.hasValue()" (click)="imprimir()">
          <app-icon name="lucidePrinter" class="size-4" aria-hidden="true" />
          Imprimir
        </button>
        <button type="button" class="sila-btn sila-btn-primary" (click)="cerrar.emit()">Cerrar</button>
      </div>
    </app-dialog>

    <app-descarga-dialog [archivo]="descargando()" (cerrar)="descargando.set(null)" />
  `,
})
export class ComprobanteDetalleDialogComponent {
  private readonly repo = inject(COMPROBANTES_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly archivos = inject(ARCHIVOS_REPOSITORY);
  private readonly visor = inject(VisorArchivosService);

  /** `null` = closed. For an ABONO the `id` is the receipt. */
  readonly documento = input<{ tipo: TipoComprobante; id: number } | null>(null);
  readonly cerrar = output<void>();

  protected readonly movil = inject(EsMovilService).movil;
  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;
  protected readonly fecha = formatoFecha;
  protected readonly tipo = etiquetaTipoComprobante;
  protected readonly numeroLegible = numeroLegible;
  protected readonly metodo = etiquetaMetodoComprobante;

  protected readonly detalle = rxResource({
    params: () => this.documento() ?? undefined,
    stream: ({ params }) => this.repo.detalle(params.tipo, params.id),
  });

  /** The PDFs of this voucher (`[]`, `[ORIGINAL]` or `[ORIGINAL, ANULADO]`): asked only when the detail is opened, never per row. */
  protected readonly pdfs = rxResource({
    params: () => this.documento() ?? undefined,
    stream: ({ params }) => this.archivos.deComprobante(params.tipo, params.id),
  });
  protected readonly descargando = signal<Archivo | null>(null);
  /** A voucher of TODAY with no PDF yet: the server makes it right away, but it can take a moment (or fail and recover). */
  protected readonly generando = computed(() => {
    const d = this.detalle.hasValue() ? this.detalle.value() : null;
    return d !== null && d.comprobante.fecha.slice(0, 10) >= hoyColombia();
  });
  private reintentado = '';

  constructor() {
    // Just registered and no PDF yet: ask once more after 5 s.
    effect((limpiar) => {
      const doc = this.documento();
      const vacio = this.pdfs.hasValue() && this.pdfs.value().length === 0;
      const clave = doc ? `${doc.tipo}-${doc.id}` : '';
      if (!doc || !vacio || !this.generando() || this.reintentado === clave) return;
      const temporizador = setTimeout(() => {
        this.reintentado = clave;
        this.pdfs.reload();
      }, 5000);
      limpiar(() => clearTimeout(temporizador));
    });
  }

  protected verPdf(p: Archivo): void {
    void this.visor.ver(p.id_documento, p.nombre_archivo);
  }

  protected readonly titulo = computed(() => {
    const d = this.documento();
    return d ? `${etiquetaTipoComprobante(d.tipo)} N.º ${d.id}` : 'Comprobante';
  });
  protected readonly chip = computed(() => chipEstadoComprobante(this.detalle.value()!.comprobante.estado));
  protected readonly signo = computed(() => montoConSigno(this.detalle.value()!.comprobante));
  protected readonly mensajeError = computed(() => {
    const e = this.detalle.error();
    return e ? this.errores.describe(e).mensaje : '';
  });

  /**
   * «Imprimir» opens the OFFICIAL PDF (the one the server made and froze; the cancellation PDF if the voucher was annulled and has one),
   * from where it is printed. A voucher from before the PDFs has none: it prints the screen like before.
   */
  protected imprimir(): void {
    const lista = this.pdfs.hasValue() ? this.pdfs.value() : [];
    const anulado = this.detalle.hasValue() && this.detalle.value().comprobante.estado === 'ANULADO';
    const oficial = (anulado ? lista.find((p) => p.version === 'ANULADO') : undefined) ?? lista.find((p) => p.version === 'ORIGINAL') ?? lista[0];
    if (oficial) this.verPdf(oficial);
    else imprimirTicket();
  }
}
