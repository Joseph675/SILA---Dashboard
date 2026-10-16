import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { VisorArchivosService } from './visor-archivos.service';

/**
 * The two viewers of `VisorArchivosService`, once for the whole app (it lives in the shell):
 * the image dialog (an `<img>` with a `blob:` URL: the only use of such a URL) and the «Abrir» fallback for a PDF whose tab was blocked.
 */
@Component({
  selector: 'app-visor-archivos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, IconComponent],
  template: `
    <app-dialog [open]="visor.imagen() !== null" [title]="visor.imagen()?.nombre ?? 'Imagen'" [wide]="true" (closed)="visor.cerrar()">
      @if (visor.imagen(); as v) {
        <img [src]="v.url" [alt]="'Vista de ' + v.nombre" class="mx-auto max-h-[70dvh] w-auto max-w-full rounded-md object-contain" data-testid="visor-imagen" />
      }
      <div dialogFooter class="flex flex-wrap gap-2">
        <button type="button" class="sila-btn sila-btn-outline" (click)="visor.descargarImagen()">
          <app-icon name="lucideDownload" class="size-4" aria-hidden="true" />
          Descargar el original
        </button>
        <button type="button" class="sila-btn sila-btn-primary" (click)="visor.cerrar()">Cerrar</button>
      </div>
    </app-dialog>

    <app-dialog [open]="visor.bloqueado() !== null" title="Abrir el PDF" description="El navegador no dejó abrir la pestaña por sí solo." (closed)="visor.cerrar()">
      @if (visor.bloqueado(); as v) {
        <p class="mb-3 text-sm">Pulsa «Abrir» para verlo en una pestaña nueva.</p>
        <a class="sila-btn sila-btn-primary" [href]="v.url" target="_blank" rel="noopener" data-testid="abrir-pdf" (click)="visor.abrioBloqueado()">
          <app-icon name="lucideExternalLink" class="size-4" aria-hidden="true" />
          Abrir {{ v.nombre }}
        </a>
      }
      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" (click)="visor.cerrar()">Cerrar</button>
      </div>
    </app-dialog>
  `,
})
export class VisorArchivosComponent {
  protected readonly visor = inject(VisorArchivosService);
}
