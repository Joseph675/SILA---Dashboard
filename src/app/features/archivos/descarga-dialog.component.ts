import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { nombreDescarga, tituloArchivo, validarClaveEscrita } from './archivos.logica';
import { ARCHIVOS_REPOSITORY } from './data/archivos.provider';
import { guardarBlob } from './guardar-archivo';
import type { Archivo, ModoClave } from './models/archivos.models';

/**
 * «Descargar copia protegida»: the file leaves as a PDF locked with a password. Three ways to choose it:
 * the identity document of the third party, one the person types, or a random one that the server makes.
 * The random one is shown ONCE (with «Copiar») and dropped from memory when its dialog closes: it is never stored anywhere.
 */
@Component({
  selector: 'app-descarga-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, IconComponent],
  template: `
    <app-dialog [open]="archivo() !== null && claveGenerada() === null" title="Descargar copia protegida" [description]="archivo() ? titulo(archivo()!) : ''" [wide]="true" [cerrable]="!ocupado()" (closed)="alCerrarPrincipal()">
      @if (opciones.error()) {
        <div role="alert" class="py-4 text-center text-sm">
          <p class="mb-2 font-medium" data-testid="error-opciones">{{ mensajeOpciones() }}</p>
          <button type="button" class="sila-btn sila-btn-outline" (click)="opciones.reload()">Reintentar</button>
        </div>
      } @else if (opciones.hasValue()) {
        @let o = opciones.value();
        <fieldset class="space-y-3" [disabled]="ocupado()">
          <legend class="mb-1 text-sm font-medium">¿Con qué clave se protege el PDF?</legend>

          <label class="flex items-start gap-3 rounded-lg border border-border p-3" [class.opacity-60]="!o.documento_disponible" [class.border-primary]="modo() === 'DOCUMENTO'">
            <input type="radio" name="modo-clave" class="mt-1" value="DOCUMENTO" [checked]="modo() === 'DOCUMENTO'" [disabled]="!o.documento_disponible" (change)="elegir('DOCUMENTO')" data-testid="modo-documento" />
            <span class="min-w-0 text-sm">
              <span class="block font-medium">Documento de identidad{{ o.tercero ? ' de ' + o.tercero : '' }}</span>
              @if (o.documento_disponible) {
                <span class="block text-muted-foreground">Clave: su número de documento. Pista: <span class="font-mono" data-testid="pista">{{ o.pista_clave_documento }}</span></span>
                <span class="mt-1 block text-xs text-muted-foreground">La clave es el número de documento, solo letras y números, sin puntos ni guiones (900.123.456-7 → 9001234567).</span>
              } @else {
                <span class="block text-xs text-muted-foreground" data-testid="motivo-no-disponible">{{ o.motivo_no_disponible }}</span>
              }
            </span>
          </label>

          <label class="flex items-start gap-3 rounded-lg border border-border p-3" [class.border-primary]="modo() === 'ESCRITA'">
            <input type="radio" name="modo-clave" class="mt-1" value="ESCRITA" [checked]="modo() === 'ESCRITA'" (change)="elegir('ESCRITA')" data-testid="modo-escrita" />
            <span class="min-w-0 flex-1 text-sm">
              <span class="block font-medium">Una clave que escribo yo</span>
              @if (modo() === 'ESCRITA') {
                <span class="mt-2 flex items-center gap-2">
                  <input class="sila-input" [type]="verClave() ? 'text' : 'password'" [value]="clave()" [attr.maxlength]="o.clave_max" autocomplete="off" aria-label="Clave del PDF" data-testid="clave-escrita" (input)="alEscribir($any($event.target).value)" />
                  <button type="button" class="sila-btn sila-btn-outline sila-btn-sm shrink-0" [attr.aria-pressed]="verClave()" (click)="verClave.set(!verClave())">
                    <app-icon [name]="verClave() ? 'lucideEyeOff' : 'lucideEye'" class="size-4" aria-hidden="true" />
                    <span class="sr-only">{{ verClave() ? 'Ocultar la clave' : 'Mostrar la clave' }}</span>
                  </button>
                </span>
                <span class="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>Entre {{ o.clave_min }} y {{ o.clave_max }} caracteres.</span>
                  <span data-testid="contador">{{ clave().length }} / {{ o.clave_max }}</span>
                </span>
                @if (errorClave(); as e) {
                  <span class="mt-1 block text-xs font-medium text-destructive" role="alert" data-testid="error-clave">{{ e }}</span>
                }
              }
            </span>
          </label>

          <label class="flex items-start gap-3 rounded-lg border border-border p-3" [class.border-primary]="modo() === 'ALEATORIA'">
            <input type="radio" name="modo-clave" class="mt-1" value="ALEATORIA" [checked]="modo() === 'ALEATORIA'" (change)="elegir('ALEATORIA')" data-testid="modo-aleatoria" />
            <span class="min-w-0 text-sm">
              <span class="block font-medium">Clave aleatoria</span>
              <span class="block text-muted-foreground">El sistema inventa una y te la muestra una sola vez al terminar.</span>
            </span>
          </label>
        </fieldset>

        @if (o.es_imagen) {
          <p class="mt-3 text-xs" data-testid="aviso-imagen">La imagen se entregará dentro de un PDF.</p>
        }
        <p class="mt-3 text-xs text-muted-foreground" data-testid="ayuda-canales">
          El archivo se descarga como PDF protegido con la clave. Mande el PDF y la clave por canales distintos (por ejemplo, el PDF por correo y la clave por WhatsApp). La clave es una barrera para que no lo abra quien no debe; no reemplaza el cuidado al enviarlo.
        </p>
        @if (error(); as e) {
          <p class="mt-3 rounded-md bg-destructive/15 px-3 py-2 text-sm" role="alert" data-testid="error-descarga">{{ e }}</p>
        }
      } @else {
        <p class="py-6 text-center text-sm text-muted-foreground" aria-busy="true">Cargando…</p>
      }
      <div dialogFooter class="flex flex-wrap gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="ocupado()" (click)="cerrar.emit()">Cancelar</button>
        <button type="button" class="sila-btn sila-btn-primary" data-testid="descargar" [disabled]="ocupado() || !opciones.hasValue() || !puedeDescargar()" [attr.aria-busy]="ocupado()" (click)="descargar()">
          <app-icon name="lucideDownload" class="size-4" aria-hidden="true" />
          {{ ocupado() ? 'Preparando…' : 'Descargar PDF protegido' }}
        </button>
      </div>
    </app-dialog>

    <!-- The random password: once, with «Copiar», and gone when this closes. -->
    <app-dialog [open]="claveGenerada() !== null" title="Clave de este PDF" [cerrable]="false" (closed)="cerrarClave()">
      <p class="mb-2 text-sm">Esta es la clave para abrir el PDF que acaba de descargar:</p>
      <p class="select-all rounded-lg bg-muted px-4 py-4 text-center font-mono text-3xl font-bold tracking-wider" data-testid="clave-generada" aria-live="polite">{{ claveGenerada() }}</p>
      <p class="mt-3 rounded-md bg-warning/15 px-3 py-2 text-sm font-medium" role="status">Se muestra una sola vez. Anótela antes de cerrar.</p>
      <div dialogFooter class="flex flex-wrap gap-2">
        <button type="button" class="sila-btn sila-btn-outline" data-testid="copiar-clave" (click)="copiar()">
          <app-icon name="lucideCopy" class="size-4" aria-hidden="true" />
          {{ copiada() ? 'Copiada' : 'Copiar' }}
        </button>
        <button type="button" class="sila-btn sila-btn-primary" data-testid="cerrar-clave" (click)="cerrarClave()">Ya la anoté</button>
      </div>
    </app-dialog>
  `,
})
export class DescargaDialogComponent {
  private readonly repo = inject(ARCHIVOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly toast = inject(ToastService);

  /** The file to download; `null` = closed. */
  readonly archivo = input<Archivo | null>(null);
  readonly cerrar = output<void>();

  protected readonly titulo = tituloArchivo;
  protected readonly opciones = rxResource({
    params: () => this.archivo()?.id_documento,
    stream: ({ params }) => this.repo.opcionesDescarga(params),
  });
  protected readonly mensajeOpciones = computed(() => (this.opciones.error() ? this.errores.describe(this.opciones.error()).mensaje : ''));

  /** The way a file starts: its document's password if it has one, a random one otherwise. The person's choice lasts until the file changes. */
  private readonly modoPorDefecto = computed<ModoClave>(() => (this.opciones.hasValue() && this.opciones.value().documento_disponible ? 'DOCUMENTO' : 'ALEATORIA'));
  protected readonly modo = linkedSignal<{ id: number | undefined; porDefecto: ModoClave }, ModoClave>({
    source: () => ({ id: this.archivo()?.id_documento, porDefecto: this.modoPorDefecto() }),
    computation: ({ porDefecto }) => porDefecto,
  });
  protected readonly clave = signal('');
  protected readonly verClave = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  /** The server's complaint about the typed password (`fields.clave`). */
  private readonly errorServidor = signal<string | null>(null);
  protected readonly claveGenerada = signal<string | null>(null);
  protected readonly copiada = signal(false);

  /** The message under the typed password: the local rule first, then what the server said. */
  protected readonly errorClave = computed(() => {
    const o = this.opciones.hasValue() ? this.opciones.value() : null;
    if (this.modo() !== 'ESCRITA' || !o) return null;
    if (this.clave().length > 0) return validarClaveEscrita(this.clave(), o.clave_min, o.clave_max) ?? this.errorServidor();
    return this.errorServidor();
  });

  protected readonly puedeDescargar = computed(() => {
    const o = this.opciones.hasValue() ? this.opciones.value() : null;
    if (!o) return false;
    if (this.modo() === 'DOCUMENTO') return o.documento_disponible;
    if (this.modo() === 'ESCRITA') return validarClaveEscrita(this.clave(), o.clave_min, o.clave_max) === null;
    return true;
  });

  constructor() {
    // A new file (or closing): everything starts clean, and a typed password never survives.
    effect(() => {
      this.archivo();
      this.claveGenerada.set(null);
      this.clave.set('');
      this.verClave.set(false);
      this.error.set(null);
      this.errorServidor.set(null);
    });
  }

  protected elegir(modo: ModoClave): void {
    this.modo.set(modo);
    this.error.set(null);
    this.errorServidor.set(null);
  }

  protected alEscribir(valor: string): void {
    this.clave.set(valor);
    this.errorServidor.set(null);
  }

  protected async descargar(): Promise<void> {
    const a = this.archivo();
    if (!a || this.ocupado() || !this.puedeDescargar()) return;
    const modo = this.modo();
    this.ocupado.set(true);
    this.error.set(null);
    this.errorServidor.set(null);
    try {
      const r = await firstValueFrom(this.repo.descargar(a.id_documento, modo, modo === 'ESCRITA' ? this.clave() : undefined));
      guardarBlob(r.blob, nombreDescarga(r.nombre, `${a.nombre_archivo.replace(/\.[^.]+$/, '')}.pdf`));
      this.clave.set('');
      if (modo === 'ALEATORIA' && r.claveGenerada) {
        this.claveGenerada.set(r.claveGenerada);
      } else {
        this.toast.exito('PDF protegido descargado.');
        this.cerrar.emit();
      }
    } catch (fallo) {
      const causa = causaDe(fallo);
      const campo = isApiError(causa) ? causa.fields?.['clave'] : undefined;
      if (campo) this.errorServidor.set(campo);
      else this.error.set(this.errores.describe(fallo).mensaje);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async copiar(): Promise<void> {
    const clave = this.claveGenerada();
    if (!clave) return;
    try {
      await navigator.clipboard.writeText(clave);
      this.copiada.set(true);
    } catch {
      this.toast.error('No se pudo copiar. Anótela a mano.');
    }
  }

  /**
   * The first dialog also «closes» by itself when it hands over to the password one (a native `close` event): that is not the
   * person leaving, so it must NOT tell the parent (which would drop the file and the password with it).
   */
  protected alCerrarPrincipal(): void {
    if (this.claveGenerada() === null) this.cerrar.emit();
  }

  /** The password is dropped from memory, then the whole dialog closes. Safe to call twice (the native `close` event calls it again). */
  protected cerrarClave(): void {
    if (this.claveGenerada() === null) return;
    this.claveGenerada.set(null);
    this.copiada.set(false);
    this.cerrar.emit();
  }
}
