import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ApiErrorService } from '../../core/api/api-error';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoFechaHora } from '../../shared/utils/formato-co';
import { ARCHIVOS_REPOSITORY } from './data/archivos.provider';
import type { EstadoDriveRespuesta } from './models/archivos.models';

/** Refreshes the state every 30 s while the tab is visible. */
export const INTERVALO_DRIVE_MS = 30 * 1000;

/**
 * Drive panel (ADMIN): the encrypted backup copy. Connect (goes to Google and comes back with `?drive=ok|error`),
 * sync now and disconnect. Drive only holds encrypted files with meaningless names.
 */
@Component({
  selector: 'app-drive-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, IconComponent, StatusChipComponent],
  template: `
    @if (estado.error() && !datos()) {
      <div role="alert" class="sila-card p-6 text-center" data-testid="error-drive">
        <p class="mb-1 font-medium">No se pudo consultar Google Drive.</p>
        <p class="mb-3 text-sm text-muted-foreground">{{ mensajeError() }}</p>
        <button type="button" class="sila-btn sila-btn-outline" (click)="estado.reload()">Reintentar</button>
      </div>
    } @else if (datos(); as e) {
      @if (!e.configurado) {
        <p class="sila-card p-6 text-sm" role="status" data-testid="drive-no-configurado">Drive no está configurado en el servidor.</p>
      } @else {
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <app-status-chip [texto]="e.conectado ? 'Conectado' : 'No conectado'" [tono]="e.conectado ? 'exito' : 'alerta'" />
          @if (e.conectado && e.cuenta) {
            <span class="text-sm" data-testid="cuenta-drive">Cuenta: <strong>{{ e.cuenta }}</strong></span>
          }
          @if (e.carpeta) {
            <span class="text-xs text-muted-foreground">Carpeta: {{ e.carpeta }}</span>
          }
        </div>

        @if (e.ultimo_error) {
          <p class="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" role="alert" data-testid="ultimo-error">{{ e.ultimo_error }}</p>
        }

        <div class="mb-6 grid gap-4 sm:grid-cols-3">
          <div class="sila-card p-4"><p class="text-sm text-muted-foreground">Pendientes</p><p class="mt-1 text-2xl font-bold tabular-nums" data-testid="pendientes">{{ e.pendientes }}</p></div>
          <div class="sila-card p-4"><p class="text-sm text-muted-foreground">Con error</p><p class="mt-1 text-2xl font-bold tabular-nums" [class.text-destructive]="e.con_error > 0" data-testid="con-error">{{ e.con_error }}</p>
            @if (e.con_error > 0) {
              <p class="mt-1 text-xs text-muted-foreground">Búscalos en «Archivos» filtrando «Copia en Drive: Con error».</p>
            }
          </div>
          <div class="sila-card p-4"><p class="text-sm text-muted-foreground">Subidos</p><p class="mt-1 text-2xl font-bold tabular-nums" data-testid="subidos">{{ e.subidos }}</p></div>
        </div>
        <p class="mb-4 text-sm text-muted-foreground" data-testid="ultima-sync">
          Última sincronización: {{ e.ultima_sincronizacion ? fechaHora(e.ultima_sincronizacion) : 'todavía ninguna' }}
        </p>

        <div class="mb-6 flex flex-wrap gap-2">
          <button type="button" class="sila-btn sila-btn-primary" data-testid="conectar" [disabled]="conectando()" (click)="conectar()">
            <app-icon name="lucideLink" class="size-4" aria-hidden="true" />
            {{ e.conectado ? 'Volver a conectar' : 'Conectar con Google Drive' }}
          </button>
          @if (e.conectado) {
            <button type="button" class="sila-btn sila-btn-outline" data-testid="sincronizar" [disabled]="sincronizando()" [attr.aria-busy]="sincronizando()" (click)="sincronizar()">
              <app-icon name="lucideRefreshCw" class="size-4" [class.animate-spin]="sincronizando()" aria-hidden="true" />
              {{ sincronizando() ? 'Sincronizando…' : 'Sincronizar ahora' }}
            </button>
            <button type="button" class="sila-btn sila-btn-outline text-destructive" data-testid="desconectar" (click)="desconectando.set(true)">Desconectar</button>
          }
        </div>
        <p class="mb-2 text-xs text-muted-foreground">Pide la cuenta de Gmail de la empresa. El permiso es mínimo: solo los archivos que SILA crea.</p>
      }
      <p class="text-sm text-muted-foreground" data-testid="texto-drive">
        En Drive solo hay archivos cifrados con nombres sin sentido: Google no ve nombres de clientes. Para ver uno, bájelo y ábralo en «Ver documento».
      </p>
    } @else {
      <p class="text-sm text-muted-foreground" aria-busy="true">Cargando…</p>
    }

    <app-confirm-dialog
      [open]="desconectando()"
      titulo="Desconectar Google Drive"
      mensaje="Lo ya subido queda en Drive; los nuevos esperarán hasta reconectar."
      textoConfirmar="Desconectar"
      [peligro]="true"
      [ocupado]="procesando()"
      (confirmar)="desconectar()"
      (cancelar)="desconectando.set(false)"
    />
  `,
})
export class DrivePanelComponent {
  private readonly repo = inject(ARCHIVOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly toast = inject(ToastService);

  protected readonly fechaHora = formatoFechaHora;
  protected readonly estado = rxResource({ stream: () => this.repo.driveEstado() });
  /** What a sync / disconnect answered: it replaces the state without asking again. */
  private readonly respuesta = signal<EstadoDriveRespuesta | null>(null);
  /** The last state that arrived (a failed refresh keeps it on screen). */
  protected readonly datos = computed<EstadoDriveRespuesta | null>(() => this.respuesta() ?? (this.estado.hasValue() ? this.estado.value() : null));
  protected readonly mensajeError = computed(() => (this.estado.error() ? this.errores.describe(this.estado.error()).mensaje : ''));
  protected readonly conectando = signal(false);
  protected readonly sincronizando = signal(false);
  protected readonly desconectando = signal(false);
  protected readonly procesando = signal(false);

  constructor() {
    const intervalo = setInterval(() => {
      if (!document.hidden) this.refrescar();
    }, INTERVALO_DRIVE_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalo));
  }

  private refrescar(): void {
    if (this.estado.isLoading() || this.sincronizando()) return;
    this.respuesta.set(null);
    this.estado.reload();
  }

  /** Sends the ADMIN to Google. Only an `https:` address is followed. */
  protected async conectar(): Promise<void> {
    if (this.conectando()) return;
    this.conectando.set(true);
    try {
      const { url } = await firstValueFrom(this.repo.driveAutorizar());
      if (new URL(url).protocol !== 'https:') throw new Error('url');
      this.irA(url);
    } catch (fallo) {
      this.conectando.set(false);
      const { mensaje, supportRef } = this.errores.describe(fallo);
      this.toast.error(mensaje, supportRef);
    }
  }

  /** The one place that leaves the app (a seam for tests). */
  protected irA(url: string): void {
    window.location.href = url;
  }

  protected async sincronizar(): Promise<void> {
    if (this.sincronizando()) return;
    this.sincronizando.set(true);
    try {
      this.respuesta.set(await firstValueFrom(this.repo.driveSincronizar()));
      this.toast.exito('Sincronización terminada.');
    } catch (fallo) {
      const { mensaje, supportRef } = this.errores.describe(fallo);
      this.toast.error(mensaje, supportRef);
    } finally {
      this.sincronizando.set(false);
    }
  }

  protected async desconectar(): Promise<void> {
    if (this.procesando()) return;
    this.procesando.set(true);
    try {
      this.respuesta.set(await firstValueFrom(this.repo.driveDesconectar()));
      this.toast.exito('Google Drive desconectado.');
    } catch (fallo) {
      const { mensaje, supportRef } = this.errores.describe(fallo);
      this.toast.error(mensaje, supportRef);
    } finally {
      this.procesando.set(false);
      this.desconectando.set(false);
    }
  }
}
