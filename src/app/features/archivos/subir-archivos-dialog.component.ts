import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ACCEPT_SUBIDA, describirFalloSubida, formatoTamano, validarArchivoParaSubir } from './archivos.logica';
import { ARCHIVOS_REPOSITORY } from './data/archivos.provider';

type EstadoSubida = 'esperando' | 'subiendo' | 'listo' | 'rechazado';

interface ItemSubida {
  id: number;
  archivo: File;
  estado: EstadoSubida;
  mensaje: string | null;
  /** Only the antivirus being down: the file was not saved and trying again later can work. */
  reintentable: boolean;
}

let siguiente = 0;

/**
 * Upload (ADMIN): drag and drop or pick. Several files go up ONE AT A TIME, each with its own state. The server scans with the
 * antivirus, cleans and encrypts; this screen only checks the obvious (type by extension, 10 MB) to save a trip.
 */
@Component({
  selector: 'app-subir-archivos-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, IconComponent],
  template: `
    <app-dialog [open]="abierto()" title="Subir archivos" [description]="destino()" [wide]="true" [cerrable]="!subiendo()" (closed)="cerrar.emit()">
      <div
        class="rounded-lg border-2 border-dashed p-6 text-center"
        [class.border-primary]="arrastrando()"
        [class.bg-primary/5]="arrastrando()"
        [class.border-border]="!arrastrando()"
        data-testid="zona-soltar"
        (dragover)="alArrastrar($event)"
        (dragleave)="arrastrando.set(false)"
        (drop)="alSoltar($event)"
      >
        <app-icon name="lucideUpload" class="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden="true" />
        <p class="mb-3 text-sm">Arrastra aquí tus archivos PDF, JPG o PNG (hasta 10 MB cada uno)</p>
        <label class="sila-btn sila-btn-outline cursor-pointer">
          Elegir archivos
          <input type="file" class="sr-only" multiple [accept]="accept" data-testid="input-archivos" (change)="alElegir($any($event.target))" />
        </label>
      </div>
      <p class="mt-3 text-xs text-muted-foreground" data-testid="aviso-seguridad">Los archivos se revisan con antivirus, se limpian y se guardan cifrados.</p>

      @if (items().length > 0) {
        <ul class="mt-4 divide-y divide-border rounded-lg border border-border" aria-label="Archivos para subir" data-testid="lista-subida">
          @for (it of items(); track it.id) {
            <li class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" [attr.data-estado]="it.estado">
              <span class="min-w-0">
                <span class="block break-all font-medium">{{ it.archivo.name }}</span>
                <span class="block text-xs text-muted-foreground">{{ tamano(it.archivo.size) }}</span>
                @if (it.mensaje; as m) {
                  <span class="mt-0.5 block text-xs" [class.text-destructive]="it.estado === 'rechazado'" data-testid="mensaje-subida">{{ m }}</span>
                }
              </span>
              <span class="flex shrink-0 items-center gap-2">
                @switch (it.estado) {
                  @case ('esperando') {
                    <span class="text-xs text-muted-foreground">Esperando</span>
                  }
                  @case ('subiendo') {
                    <span class="text-xs" aria-live="polite">Revisando con el antivirus…</span>
                  }
                  @case ('listo') {
                    <span class="flex items-center gap-1 text-xs text-success"><app-icon name="lucideCircleCheck" class="size-4" aria-hidden="true" />Listo</span>
                  }
                  @case ('rechazado') {
                    <span class="flex items-center gap-1 text-xs font-medium text-destructive"><app-icon name="lucideCircleX" class="size-4" aria-hidden="true" />Rechazado</span>
                    @if (it.reintentable) {
                      <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" data-testid="reintentar-subida" [disabled]="subiendo()" (click)="reintentar(it)">Reintentar</button>
                    }
                  }
                }
              </span>
            </li>
          }
        </ul>
      }
      <div dialogFooter class="flex flex-wrap gap-2">
        <button type="button" class="sila-btn sila-btn-primary" [disabled]="subiendo()" (click)="cerrar.emit()">{{ subiendo() ? 'Subiendo…' : 'Cerrar' }}</button>
      </div>
    </app-dialog>
  `,
})
export class SubirArchivosDialogComponent {
  private readonly repo = inject(ARCHIVOS_REPOSITORY);

  readonly abierto = input(false);
  /** The folder of «Mis carpetas» where they go; `null` = its root. */
  readonly idCarpeta = input<number | null>(null);
  readonly nombreCarpeta = input('Mis carpetas');

  readonly cerrar = output<void>();
  /** One file is up: the list behind can refresh. */
  readonly subido = output<void>();

  protected readonly accept = ACCEPT_SUBIDA;
  protected readonly tamano = formatoTamano;
  protected readonly items = signal<ItemSubida[]>([]);
  protected readonly arrastrando = signal(false);
  protected readonly subiendo = computed(() => this.items().some((i) => i.estado === 'subiendo'));
  protected readonly destino = computed(() => `Se guardan en: ${this.nombreCarpeta()}`);
  private procesando = false;

  protected alArrastrar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(true);
  }

  protected alSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(false);
    this.agregar(Array.from(evento.dataTransfer?.files ?? []));
  }

  protected alElegir(input: HTMLInputElement): void {
    this.agregar(Array.from(input.files ?? []));
    input.value = '';
  }

  /** What the browser can see is checked now; what only the server can see (real type, antivirus) comes back as a rejection. */
  agregar(archivos: File[]): void {
    const nuevos = archivos.map<ItemSubida>((archivo) => {
      const problema = validarArchivoParaSubir(archivo);
      return { id: siguiente++, archivo, estado: problema ? 'rechazado' : 'esperando', mensaje: problema, reintentable: false };
    });
    this.items.update((lista) => [...lista, ...nuevos]);
    void this.procesar();
  }

  protected reintentar(item: ItemSubida): void {
    this.cambiar(item.id, { estado: 'esperando', mensaje: null, reintentable: false });
    void this.procesar();
  }

  private cambiar(id: number, cambio: Partial<ItemSubida>): void {
    this.items.update((lista) => lista.map((i) => (i.id === id ? { ...i, ...cambio } : i)));
  }

  /** One at a time, in order. */
  private async procesar(): Promise<void> {
    if (this.procesando) return;
    this.procesando = true;
    try {
      for (let item = this.items().find((i) => i.estado === 'esperando'); item; item = this.items().find((i) => i.estado === 'esperando')) {
        this.cambiar(item.id, { estado: 'subiendo' });
        try {
          await firstValueFrom(this.repo.subir(item.archivo, this.idCarpeta() ?? undefined));
          this.cambiar(item.id, { estado: 'listo' });
          this.subido.emit();
        } catch (fallo) {
          const { mensaje, reintentable } = describirFalloSubida(fallo);
          this.cambiar(item.id, { estado: 'rechazado', mensaje, reintentable });
        }
      }
    } finally {
      this.procesando = false;
    }
  }

  /** Empties the list (the parent calls it when the dialog is opened again). */
  vaciar(): void {
    if (!this.subiendo()) this.items.set([]);
  }
}
