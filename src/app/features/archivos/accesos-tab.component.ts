import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { FiltrosPlegablesComponent } from '../../shared/ui/filtros-plegables/filtros-plegables.component';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { formatoFechaHora } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { textoConEspera } from '../../shared/utils/texto-debounce';
import { ETIQUETA_MODO } from './archivos.logica';
import { ARCHIVOS_REPOSITORY } from './data/archivos.provider';
import type { AccesoArchivo, AccionAcceso, ModoClave } from './models/archivos.models';

const ACCIONES: readonly { valor: AccionAcceso; etiqueta: string; icono: IconName }[] = [
  { valor: 'VER', etiqueta: 'Ver', icono: 'lucideEye' },
  { valor: 'DESCARGAR', etiqueta: 'Descargar', icono: 'lucideDownload' },
  { valor: 'DESCIFRAR', etiqueta: 'Abrir desde Drive', icono: 'lucideFileKey' },
  { valor: 'SUBIR', etiqueta: 'Subir', icono: 'lucideUpload' },
  { valor: 'ARCHIVAR', etiqueta: 'Archivar', icono: 'lucideArchive' },
  { valor: 'CARPETA_CREAR', etiqueta: 'Crear carpeta', icono: 'lucideFolderPlus' },
  { valor: 'CARPETA_ARCHIVAR', etiqueta: 'Archivar carpeta', icono: 'lucideFolderX' },
  { valor: 'SUBIDA_RECHAZADA', etiqueta: 'Subida rechazada', icono: 'lucideShieldAlert' },
];

/** The access log of the files (ADMIN). The password is NEVER here: only the TYPE of password used. */
@Component({
  selector: 'app-accesos-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableCellDirective, FiltrosPlegablesComponent, IconComponent, RouterLink, ServerDataTableComponent],
  template: `
    <app-filtros-plegables clases="mb-4 flex flex-wrap items-end gap-3">
      <div class="w-full sm:w-52">
        <label for="acc-usuario" class="mb-1 block text-xs font-medium text-muted-foreground">Usuario</label>
        <input id="acc-usuario" type="search" class="sila-input" maxlength="100" [value]="usuario.crudo()" (input)="usuario.crudo.set($any($event.target).value)" />
      </div>
      <div>
        <label for="acc-accion" class="mb-1 block text-xs font-medium text-muted-foreground">Acción</label>
        <select id="acc-accion" class="sila-select w-48" (change)="accion.set($any($event.target).value)">
          <option value="" [selected]="accion() === ''">Todas</option>
          @for (a of acciones; track a.valor) {
            <option [value]="a.valor" [selected]="accion() === a.valor">{{ a.etiqueta }}</option>
          }
        </select>
      </div>
      <div>
        <label for="acc-doc" class="mb-1 block text-xs font-medium text-muted-foreground">N.º de archivo</label>
        <input id="acc-doc" type="text" inputmode="numeric" class="sila-input w-32" maxlength="12" [value]="idDocumento()" (input)="cambiarDocumento($any($event.target).value)" data-testid="filtro-documento" />
      </div>
    </app-filtros-plegables>

    <app-server-data-table
      titulo="Accesos a archivos"
      [columns]="columnas"
      [page]="listado.datos()"
      [rowId]="accesoId"
      [cargando]="listado.cargando()"
      [error]="listado.error()"
      [sort]="null"
      vacioTitulo="No hay accesos que coincidan"
      (pageChange)="listado.irAPagina($event)"
      (sizeChange)="listado.cambiarTamano($event)"
      (reintentar)="listado.recargar()"
    >
      <ng-template appDataTableCell="fecha" [cellRows]="listado.datos()?.items" let-a><span class="whitespace-nowrap">{{ fechaHora(a.fecha) }}</span></ng-template>
      <ng-template appDataTableCell="accion" [cellRows]="listado.datos()?.items" let-a>
        <span class="inline-flex items-center gap-1.5" [class.font-semibold]="a.accion === 'SUBIDA_RECHAZADA'" [class.text-destructive]="a.accion === 'SUBIDA_RECHAZADA'" [attr.data-accion]="a.accion">
          <app-icon [name]="icono(a.accion)" class="size-4" aria-hidden="true" />{{ etiquetaAccion(a.accion) }}
        </span>
      </ng-template>
      <ng-template appDataTableCell="archivo" [cellRows]="listado.datos()?.items" let-a>
        @if (a.id_documento !== null) {
          <a class="inline-flex min-h-8 items-center break-all underline-offset-2 hover:underline max-lg:min-h-11" routerLink="/archivos" [queryParams]="{ documento: a.id_documento }" data-testid="enlace-archivo">{{ a.nombre_archivo || 'Archivo ' + a.id_documento }}</a>
        } @else {
          <span class="text-muted-foreground">—</span>
        }
      </ng-template>
      <ng-template appDataTableCell="modo_clave" [cellRows]="listado.datos()?.items" let-a>{{ a.modo_clave ? modo(a.modo_clave) : '—' }}</ng-template>
      <ng-template appDataTableCell="ip" [cellRows]="listado.datos()?.items" let-a><span class="font-mono text-xs">{{ a.ip || '—' }}</span></ng-template>
      <ng-template appDataTableCell="detalle" [cellRows]="listado.datos()?.items" let-a>
        <span class="block max-w-80 break-words text-xs" [class.text-destructive]="a.accion === 'SUBIDA_RECHAZADA'" [class.font-medium]="a.accion === 'SUBIDA_RECHAZADA'">{{ a.detalle || '—' }}</span>
      </ng-template>
    </app-server-data-table>
  `,
})
export class AccesosTabComponent {
  private readonly repo = inject(ARCHIVOS_REPOSITORY);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly acciones = ACCIONES;
  protected readonly fechaHora = formatoFechaHora;
  protected readonly modo = (m: ModoClave) => ETIQUETA_MODO[m];

  private readonly consulta = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  /** `?id_documento=` (from «Ver quién lo abrió»): only digits count. */
  protected readonly idDocumento = computed(() => {
    const v = this.consulta().get('id_documento') ?? '';
    return /^\d+$/.test(v) ? v : '';
  });
  protected readonly usuario = textoConEspera();
  protected readonly accion = signal<'' | AccionAcceso>('');

  protected readonly listado = crearListado({
    filtros: () => ({
      id_documento: this.idDocumento() ? Number(this.idDocumento()) : undefined,
      usuario: this.usuario.valor() || undefined,
      accion: this.accion() || undefined,
    }),
    cargar: (q) => this.repo.accesos(q),
    sort: '',
  });

  protected readonly columnas: DataTableColumn<AccesoArchivo>[] = [
    { key: 'fecha', label: 'Fecha', sortable: false, value: (a) => a.fecha },
    { key: 'usuario', label: 'Usuario', sortable: false, value: (a) => a.usuario },
    { key: 'accion', label: 'Acción', sortable: false, rol: 'titulo', value: (a) => a.accion },
    { key: 'archivo', label: 'Archivo', sortable: false, value: (a) => a.nombre_archivo ?? '' },
    { key: 'modo_clave', label: 'Tipo de clave', sortable: false, ocultarEnMovil: true, value: (a) => a.modo_clave ?? '' },
    { key: 'ip', label: 'IP', sortable: false, ocultarEnMovil: true, value: (a) => a.ip ?? '' },
    { key: 'detalle', label: 'Detalle', sortable: false, value: (a) => a.detalle ?? '' },
  ];
  protected readonly accesoId = (a: AccesoArchivo) => a.id_acceso;

  protected icono(accion: string): IconName {
    return ACCIONES.find((a) => a.valor === accion)?.icono ?? 'lucideActivity';
  }

  protected etiquetaAccion(accion: string): string {
    return ACCIONES.find((a) => a.valor === accion)?.etiqueta ?? accion;
  }

  protected cambiarDocumento(valor: string): void {
    const limpio = valor.replace(/\D/g, '');
    void this.router.navigate([], { relativeTo: this.route, queryParams: { id_documento: limpio || null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
