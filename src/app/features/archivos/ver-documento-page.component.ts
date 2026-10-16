import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { RespuestaArchivo } from '../../core/api/archivo-cabeceras';
import { ApiErrorService } from '../../core/api/api-error';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ACCEPT_SILA, nombreDescarga, validarArchivoSila } from './archivos.logica';
import { ARCHIVOS_REPOSITORY } from './data/archivos.provider';
import { guardarBlob } from './guardar-archivo';
import { VisorArchivosService } from './visor-archivos.service';

/**
 * «Ver documento»: a `.sila` file that came down from Google Drive is decrypted by the server and shown like any other file
 * (an image in the viewer, a PDF in a new tab). Nothing is kept: the bytes live in this component's memory and go away when you leave.
 */
@Component({
  selector: 'app-ver-documento-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  template: `
    <div class="sila-card max-w-2xl p-5">
      <h2 class="mb-1 text-base font-semibold">Abrir un archivo de Drive</h2>
      <p class="mb-4 text-sm text-muted-foreground" data-testid="explicacion">
        Si necesita un archivo desde Google Drive, descárguelo (termina en <code>.sila</code>) y súbalo aquí para verlo.
      </p>
      <div
        class="rounded-lg border-2 border-dashed p-6 text-center"
        [class.border-primary]="arrastrando()"
        [class.border-border]="!arrastrando()"
        data-testid="zona-sila"
        (dragover)="$event.preventDefault(); arrastrando.set(true)"
        (dragleave)="arrastrando.set(false)"
        (drop)="soltar($event)"
      >
        <app-icon name="lucideFileKey" class="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden="true" />
        <p class="mb-3 text-sm">Arrastra aquí el archivo .sila (hasta 11 MB)</p>
        <label class="sila-btn sila-btn-outline cursor-pointer" [class.opacity-60]="ocupado()">
          Elegir archivo .sila
          <input type="file" class="sr-only" [accept]="accept" [disabled]="ocupado()" data-testid="input-sila" (change)="elegir($any($event.target))" />
        </label>
      </div>

      @if (ocupado()) {
        <p class="mt-4 text-sm" aria-live="polite" data-testid="descifrando">Abriendo el archivo…</p>
      }
      @if (error(); as e) {
        <p class="mt-4 rounded-md bg-destructive/15 px-3 py-2 text-sm" role="alert" data-testid="error-sila">{{ e }}</p>
      }
      @if (resultado(); as r) {
        <div class="mt-4 rounded-lg border border-border p-3 text-sm" data-testid="resultado-sila">
          <p class="mb-2 font-medium break-all">{{ nombre(r) }}</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" data-testid="ver-de-nuevo" (click)="mostrar(r)">
              <app-icon name="lucideEye" class="size-4" aria-hidden="true" />Ver
            </button>
            <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" data-testid="descargar-original" (click)="descargar(r)">
              <app-icon name="lucideDownload" class="size-4" aria-hidden="true" />Descargar el original
            </button>
            @if (r.idArchivo !== null) {
              <a class="sila-btn sila-btn-outline sila-btn-sm" data-testid="ir-al-archivo" routerLink="/archivos" [queryParams]="{ documento: r.idArchivo }">
                <app-icon name="lucideFolderOpen" class="size-4" aria-hidden="true" />Ir al archivo
              </a>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class VerDocumentoPageComponent {
  private readonly repo = inject(ARCHIVOS_REPOSITORY);
  private readonly visor = inject(VisorArchivosService);
  private readonly errores = inject(ApiErrorService);

  protected readonly accept = ACCEPT_SILA;
  protected readonly ocupado = signal(false);
  protected readonly arrastrando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** The decrypted file, only in memory while this screen is open. */
  protected readonly resultado = signal<RespuestaArchivo | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.resultado.set(null));
  }

  protected nombre(r: RespuestaArchivo): string {
    return nombreDescarga(r.nombre, 'documento');
  }

  protected soltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(false);
    const archivo = evento.dataTransfer?.files?.[0];
    if (archivo) void this.abrir(archivo);
  }

  protected elegir(input: HTMLInputElement): void {
    const archivo = input.files?.[0];
    input.value = '';
    if (archivo) void this.abrir(archivo);
  }

  /** Validates what the browser can see (extension, 11 MB); the server decides if it is really a SILA file. */
  async abrir(archivo: File): Promise<void> {
    if (this.ocupado()) return;
    this.error.set(null);
    this.resultado.set(null);
    const problema = validarArchivoSila(archivo);
    if (problema) {
      this.error.set(problema);
      return;
    }
    this.ocupado.set(true);
    try {
      const r = await firstValueFrom(this.repo.descifrar(archivo));
      this.resultado.set(r);
      this.mostrar(r);
    } catch (fallo) {
      this.error.set(this.errores.describe(fallo).mensaje);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected mostrar(r: RespuestaArchivo): void {
    this.visor.mostrar(r, 'documento');
  }

  protected descargar(r: RespuestaArchivo): void {
    guardarBlob(r.blob, nombreDescarga(r.nombre, 'documento'));
  }
}
