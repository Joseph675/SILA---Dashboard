import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { Pestana, PestanasComponent } from '../../shared/ui/pestanas/pestanas.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

/** The tabs of the file manager. Each is a ROUTE (`/archivos`, `/archivos/ver-documento`, `/archivos/drive`, `/archivos/accesos`). */
const PESTANAS_TODOS: readonly Pestana[] = [
  { id: 'explorar', etiqueta: 'Archivos', icono: 'lucideFolderOpen' },
  { id: 'ver-documento', etiqueta: 'Ver documento', icono: 'lucideFileSearch' },
];
const PESTANAS_ADMIN: readonly Pestana[] = [
  { id: 'drive', etiqueta: 'Drive', icono: 'lucideCloudUpload' },
  { id: 'accesos', etiqueta: 'Accesos', icono: 'lucideHistory' },
];

/**
 * «Archivos»: explorer, «Ver documento» (open a `.sila` from Drive), and, for the ADMIN only, the Drive panel and the access log.
 * It also takes the `?drive=ok|error` that Google's return leaves in the URL: a notice, then the parameter is removed.
 */
@Component({
  selector: 'app-archivos-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, PestanasComponent, RouterOutlet],
  template: `
    <app-page-header title="Archivos" description="Los PDF de los comprobantes y los archivos de la empresa, para ver y descargar con clave. Son documentos internos, no facturas electrónicas." />
    <app-pestanas [pestanas]="pestanas()" [activa]="activa()" etiqueta="Archivos" (seleccionada)="ir($event)" />
    <section role="tabpanel" [id]="'panel-' + activa()" [attr.aria-labelledby]="'tab-' + activa()">
      <router-outlet />
    </section>
  `,
})
export class ArchivosLayoutComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly pestanas = computed(() => (this.auth.rol() === 'ADMIN' ? [...PESTANAS_TODOS, ...PESTANAS_ADMIN] : [...PESTANAS_TODOS]));
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly activa = computed(() => {
    const segmento = this.url().split('?')[0].split('/')[2] ?? '';
    return ['ver-documento', 'drive', 'accesos'].includes(segmento) ? segmento : 'explorar';
  });

  constructor() {
    const retorno = this.route.snapshot.queryParamMap.get('drive');
    if (retorno === 'ok') this.toast.exito('Google Drive quedó conectado.');
    if (retorno === 'error') this.toast.error('No se pudo conectar con Google Drive. Intenta de nuevo.');
    if (retorno) void this.router.navigate([], { relativeTo: this.route, queryParams: { drive: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected ir(id: string): void {
    void this.router.navigate(id === 'explorar' ? ['/archivos'] : ['/archivos', id]);
  }
}
