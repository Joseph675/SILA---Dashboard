import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoCop, formatoFecha, formatoFechaHora } from '../../shared/utils/formato-co';
import { etiquetaTipoArchivo, formatoTamano, insigniasDe, tituloArchivo } from './archivos.logica';
import { ARCHIVOS_REPOSITORY } from './data/archivos.provider';
import type { Archivo } from './models/archivos.models';

/**
 * Side detail of a file: who made or uploaded it, its SHA-256 (with «Copiar»), the OTHER PDF of the same voucher
 * (original ↔ cancellation), the state of the Drive copy and, if archived, why. The path on disk never exists in the API.
 */
@Component({
  selector: 'app-detalle-archivo-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, HasRoleDirective, IconComponent, RouterLink, StatusChipComponent],
  template: `
    <app-dialog [open]="archivo() !== null" [title]="archivo() ? titulo(archivo()!) : 'Detalle'" [wide]="true" (closed)="cerrar.emit()">
      @if (archivo(); as a) {
        <div class="mb-3 flex flex-wrap gap-2" data-testid="insignias">
          @for (i of insignias(a); track i.texto) {
            <app-status-chip [texto]="i.texto" [tono]="i.tono" />
          }
        </div>
        <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2" data-testid="detalle-archivo">
          <div><dt class="text-xs text-muted-foreground">Nombre del archivo</dt><dd class="break-all">{{ a.nombre_archivo }}</dd></div>
          <div><dt class="text-xs text-muted-foreground">Tipo</dt><dd>{{ tipo(a.tipo_entidad) }}{{ a.version === 'ANULADO' ? ' · PDF de anulación' : '' }}</dd></div>
          <div><dt class="text-xs text-muted-foreground">Tamaño</dt><dd>{{ tamano(a.tamano_bytes) }} · {{ a.mime_type }}</dd></div>
          <div><dt class="text-xs text-muted-foreground">Fecha</dt><dd>{{ fecha(a.fecha) }}</dd></div>
          @if (a.tercero) {
            <div><dt class="text-xs text-muted-foreground">{{ a.tercero_tipo === 'PROVEEDOR' ? 'Proveedor' : 'Cliente' }}</dt><dd>{{ a.tercero }}</dd></div>
          }
          @if (a.monto !== null) {
            <div><dt class="text-xs text-muted-foreground">Monto</dt><dd class="tabular-nums">{{ cop(a.monto) }}</dd></div>
          }
          <div class="sm:col-span-2">
            <dt class="text-xs text-muted-foreground">Huella SHA-256 (no cambia si el archivo no cambia)</dt>
            <dd class="flex flex-wrap items-center gap-2">
              <code class="break-all text-xs" data-testid="huella">{{ a.checksum_sha256 }}</code>
              <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" data-testid="copiar-huella" (click)="copiar(a.checksum_sha256)">
                <app-icon name="lucideCopy" class="size-4" aria-hidden="true" />Copiar
              </button>
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ a.origen === 'COMPROBANTE' ? 'Generado por el sistema' : 'Subido por' }}</dt>
            <dd>{{ a.usuario_carga ?? 'El sistema' }} · {{ fechaHora(a.fecha_registro) }}</dd>
          </div>
          @if (a.carpeta) {
            <div><dt class="text-xs text-muted-foreground">Carpeta</dt><dd>{{ a.carpeta }}</dd></div>
          }
          <div>
            <dt class="text-xs text-muted-foreground">Copia en Google Drive</dt>
            <dd data-testid="estado-drive">{{ textoDrive(a) }}</dd>
          </div>
          @if (a.archivado) {
            <div class="sm:col-span-2" data-testid="datos-archivado">
              <dt class="text-xs text-muted-foreground">Archivado</dt>
              <dd>Motivo: {{ a.motivo_archivo }} · {{ a.usuario_archivo }} · {{ fechaHora(a.fecha_archivo) }}</dd>
            </div>
          }
        </dl>

        @if (otro(); as o) {
          <div class="mt-4 rounded-lg border border-border p-3 text-sm" data-testid="otro-pdf">
            <p class="mb-1 text-xs text-muted-foreground">{{ a.version === 'ANULADO' ? 'El original se conserva sin modificar' : 'Este comprobante fue anulado: tiene un segundo PDF' }}</p>
            <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" (click)="irA.emit(o)">
              <app-icon name="lucideFileText" class="size-4" aria-hidden="true" />
              {{ o.version === 'ANULADO' ? 'Ver el PDF de anulación' : 'Ver el PDF original' }}
            </button>
          </div>
        }
      }
      <div dialogFooter class="flex flex-wrap gap-2">
        <a *hasRole="'ADMIN'" class="sila-btn sila-btn-outline" data-testid="quien-lo-abrio" [routerLink]="['/archivos', 'accesos']" [queryParams]="{ id_documento: archivo()?.id_documento }" (click)="cerrar.emit()">
          <app-icon name="lucideHistory" class="size-4" aria-hidden="true" />Ver quién lo abrió
        </a>
        <button type="button" class="sila-btn sila-btn-primary" (click)="cerrar.emit()">Cerrar</button>
      </div>
    </app-dialog>
  `,
})
export class DetalleArchivoDialogComponent {
  private readonly repo = inject(ARCHIVOS_REPOSITORY);
  private readonly toast = inject(ToastService);

  readonly archivo = input<Archivo | null>(null);
  readonly cerrar = output<void>();
  /** The other PDF of the voucher was chosen: the parent shows its detail. */
  readonly irA = output<Archivo>();

  protected readonly titulo = tituloArchivo;
  protected readonly tipo = etiquetaTipoArchivo;
  protected readonly tamano = formatoTamano;
  protected readonly insignias = insigniasDe;
  protected readonly cop = formatoCop;
  protected readonly fecha = formatoFecha;
  protected readonly fechaHora = formatoFechaHora;

  /** The PDFs of the same voucher (only a voucher has them): found by its type and id, the same call the voucher screen makes. */
  private readonly hermanos = rxResource({
    params: () => {
      const a = this.archivo();
      return a && a.origen === 'COMPROBANTE' && a.id_entidad !== null ? { tipo: a.tipo_entidad, id: a.id_entidad } : undefined;
    },
    stream: ({ params }) => this.repo.deComprobante(params.tipo, params.id),
  });
  /** The other version, if the voucher has one. */
  protected readonly otro = computed(() => {
    const a = this.archivo();
    if (!a || !this.hermanos.hasValue()) return null;
    return this.hermanos.value().find((x) => x.id_documento !== a.id_documento) ?? null;
  });
  protected readonly copiada = signal(false);

  protected textoDrive(a: Archivo): string {
    switch (a.estado_drive) {
      case 'SUBIDO':
        return `Respaldado${a.fecha_drive ? ` el ${formatoFechaHora(a.fecha_drive)}` : ''}`;
      case 'ERROR':
        return 'Con error: el sistema lo vuelve a intentar (ver «Drive»).';
      default:
        return 'Pendiente: todavía no tiene respaldo.';
    }
  }

  protected async copiar(texto: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      this.toast.exito('Huella copiada.');
    } catch {
      this.toast.error('No se pudo copiar.');
    }
  }
}
