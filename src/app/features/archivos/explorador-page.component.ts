import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, tap } from 'rxjs';
import { ApiErrorService } from '../../core/api/api-error';
import type { Page } from '../../core/api/page.models';
import { HasRoleDirective } from '../../core/auth/has-role.directive';
import { DataTableCellDirective } from '../../shared/ui/data-table/data-table-cell.directive';
import type { DataTableColumn } from '../../shared/ui/data-table/data-table.models';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { FiltrosPlegablesComponent } from '../../shared/ui/filtros-plegables/filtros-plegables.component';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';
import { ServerDataTableComponent } from '../../shared/ui/server-data-table/server-data-table.component';
import { StatusChipComponent } from '../../shared/ui/status-chip/status-chip.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { formatoCop, formatoFecha } from '../../shared/utils/formato-co';
import { crearListado } from '../../shared/utils/listado';
import { textoConEspera } from '../../shared/utils/texto-debounce';
import { FiltroFechasComponent } from '../auditoria/filtro-fechas.component';
import { NOMBRES_ARBOL, etiquetaTipoArchivo, formatoTamano, insigniasDe, rutaDeQuery, rutaMasProfunda, tituloArchivo } from './archivos.logica';
import { arbolDeUrl } from './archivos.rutas-ui';
import { ARCHIVOS_REPOSITORY } from './data/archivos.provider';
import { DescargaDialogComponent } from './descarga-dialog.component';
import { DetalleArchivoDialogComponent } from './detalle-archivo-dialog.component';
import type { Archivo, EntradaExplorador, EstadoDrive, Explorador, OrigenArchivo, TipoEntidadArchivo, VersionArchivo } from './models/archivos.models';
import { NuevaCarpetaDialogComponent } from './nueva-carpeta-dialog.component';
import { SubirArchivosDialogComponent } from './subir-archivos-dialog.component';
import { VisorArchivosService } from './visor-archivos.service';

const ICONO_ARBOL: Record<string, IconName> = { TIPO: 'lucideTags', CLIENTE: 'lucideUsers', PROVEEDOR: 'lucideTruck', MANUAL: 'lucideFolderOpen' };

/**
 * The explorer: the four trees at the root and, inside a folder, its subfolders and a paged table of files. The PATH lives in the URL
 * (`/archivos/TIPO?ruta=VENTA&ruta=2026`) so Back, reload and sharing the link work. The search bar (and filters) swaps the folders
 * for a flat list of results. A PDF can be in several folders (by type, by client…): it is the same file.
 */
@Component({
  selector: 'app-explorador-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    DataTableCellDirective,
    DescargaDialogComponent,
    DetalleArchivoDialogComponent,
    FiltroFechasComponent,
    FiltrosPlegablesComponent,
    HasRoleDirective,
    IconComponent,
    NuevaCarpetaDialogComponent,
    RouterLink,
    ServerDataTableComponent,
    StatusChipComponent,
    SubirArchivosDialogComponent,
  ],
  template: `
    <!-- Search and filters -->
    <app-filtros-plegables clases="mb-4 flex flex-wrap items-end gap-3">
      <div class="w-full sm:w-72">
        <label for="arch-texto" class="mb-1 block text-xs font-medium text-muted-foreground">Buscar en todos los archivos</label>
        <input id="arch-texto" type="search" class="sila-input" placeholder="Nombre, número o cliente…" maxlength="100" [value]="texto.crudo()" (input)="texto.crudo.set($any($event.target).value)" data-testid="buscar" />
      </div>
      <div>
        <label for="arch-origen" class="mb-1 block text-xs font-medium text-muted-foreground">Origen</label>
        <select id="arch-origen" class="sila-select w-40" (change)="origen.set($any($event.target).value)">
          <option value="">Todos</option>
          <option value="COMPROBANTE">Comprobantes</option>
          <option value="ADMIN">Subidos</option>
        </select>
      </div>
      <div>
        <label for="arch-tipo" class="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
        <select id="arch-tipo" class="sila-select w-44" (change)="tipo.set($any($event.target).value)">
          <option value="">Todos</option>
          @for (t of tipos; track t.valor) {
            <option [value]="t.valor">{{ t.etiqueta }}</option>
          }
        </select>
      </div>
      <div>
        <label for="arch-version" class="mb-1 block text-xs font-medium text-muted-foreground">Versión</label>
        <select id="arch-version" class="sila-select w-36" (change)="version.set($any($event.target).value)">
          <option value="">Todas</option>
          <option value="ORIGINAL">Original</option>
          <option value="ANULADO">Anulado</option>
        </select>
      </div>
      <div>
        <label for="arch-drive" class="mb-1 block text-xs font-medium text-muted-foreground">Copia en Drive</label>
        <select id="arch-drive" class="sila-select w-40" (change)="estadoDrive.set($any($event.target).value)">
          <option value="">Todas</option>
          <option value="SUBIDO">Respaldada</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="ERROR">Con error</option>
        </select>
      </div>
      <app-filtro-fechas idBase="arch" [desde]="desde()" [hasta]="hasta()" (desdeChange)="desde.set($event)" (hastaChange)="hasta.set($event)" />
      <label *hasRole="'ADMIN'" class="flex min-h-9 items-center gap-2 text-sm">
        <input type="checkbox" [checked]="incluirArchivados()" (change)="incluirArchivados.set($any($event.target).checked)" data-testid="incluir-archivados" />
        Incluir archivados
      </label>
    </app-filtros-plegables>

    @if (buscando()) {
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-muted-foreground" data-testid="modo-busqueda">Resultados de la búsqueda en todos los archivos.</p>
        <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" data-testid="volver-carpetas" (click)="limpiarBusqueda()">
          <app-icon name="lucideArrowLeft" class="size-4" aria-hidden="true" />Volver a carpetas
        </button>
      </div>
    } @else {
      <!-- Breadcrumbs -->
      <nav aria-label="Ubicación" class="mb-4 flex flex-wrap items-center gap-1 text-sm" data-testid="migas">
        @if (arbol()) {
          <a routerLink="/archivos" class="inline-flex min-h-8 items-center hover:underline max-lg:min-h-11">Archivos</a>
          <app-icon name="lucideChevronRight" class="size-3.5 text-muted-foreground" aria-hidden="true" />
          @if (meta()?.ruta?.length) {
            <a [routerLink]="['/archivos', arbol()]" class="inline-flex min-h-8 items-center hover:underline max-lg:min-h-11">{{ nombreArbol() }}</a>
            @for (e of meta()!.ruta; track e.clave; let i = $index; let ultimo = $last) {
              <app-icon name="lucideChevronRight" class="size-3.5 text-muted-foreground" aria-hidden="true" />
              @if (ultimo) {
                <span class="inline-flex min-h-8 items-center font-medium max-lg:min-h-11" aria-current="page">{{ e.nombre }}</span>
              } @else {
                <a [routerLink]="['/archivos', arbol()]" [queryParams]="{ ruta: clavesHasta(i) }" class="inline-flex min-h-8 items-center hover:underline max-lg:min-h-11">{{ e.nombre }}</a>
              }
            }
          } @else {
            <span class="inline-flex min-h-8 items-center font-medium max-lg:min-h-11" aria-current="page">{{ nombreArbol() }}</span>
          }
        } @else {
          <span class="inline-flex min-h-8 items-center font-medium max-lg:min-h-11" aria-current="page">Archivos</span>
        }
      </nav>
    }

    @if (!buscando() && explorador.error() && !meta()) {
      <div role="alert" class="sila-card p-6 text-center" data-testid="error-explorador">
        <p class="mb-1 font-medium">No se pudo abrir la carpeta.</p>
        <p class="mb-3 text-sm text-muted-foreground">{{ explorador.error() }}</p>
        <button type="button" class="sila-btn sila-btn-outline" (click)="explorador.recargar()">Reintentar</button>
      </div>
    }

    @if (!buscando() && meta(); as m) {
      <!-- Root: the four trees -->
      @if (!arbol()) {
        <ul class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Formas de ver los archivos" data-testid="raiz">
          @for (c of m.carpetas; track c.clave) {
            <li>
              <a [routerLink]="['/archivos', c.clave]" class="sila-card flex h-full flex-col gap-2 p-5 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring" data-testid="tarjeta-arbol">
                <app-icon [name]="icono(c.clave)" class="size-8 text-primary" aria-hidden="true" />
                <span class="text-base font-semibold">{{ c.nombre }}</span>
                <span class="text-sm text-muted-foreground">{{ c.cantidad }} {{ c.cantidad === 1 ? 'archivo' : 'archivos' }}</span>
              </a>
            </li>
          }
        </ul>
      } @else {
        <!-- Inside a folder -->
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-base font-semibold">{{ tituloCarpeta() }}</h2>
          @if (m.puede_subir) {
            <div class="flex flex-wrap gap-2">
              <button type="button" class="sila-btn sila-btn-primary" data-testid="subir" (click)="subiendo.set(true)">
                <app-icon name="lucideUpload" class="size-4" aria-hidden="true" />Subir archivo
              </button>
              <button type="button" class="sila-btn sila-btn-outline" data-testid="nueva-carpeta" (click)="nuevaCarpeta.set(true)">
                <app-icon name="lucideFolderPlus" class="size-4" aria-hidden="true" />Nueva carpeta
              </button>
            </div>
          }
        </div>

        @if (m.carpetas.length > 0) {
          <ul class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Carpetas" data-testid="subcarpetas">
            @for (c of m.carpetas; track c.clave) {
              <li class="sila-card flex items-center gap-1 p-1">
                <a [routerLink]="['/archivos', arbol()]" [queryParams]="{ ruta: rutaHacia(c.clave) }" class="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring" data-testid="subcarpeta">
                  <app-icon name="lucideFolder" class="size-6 shrink-0 text-primary" aria-hidden="true" />
                  <span class="min-w-0">
                    <span class="block break-words text-sm font-medium">{{ c.nombre }}</span>
                    <span class="block text-xs text-muted-foreground">{{ c.cantidad }} {{ c.cantidad === 1 ? 'archivo' : 'archivos' }}</span>
                  </span>
                </a>
                @if (arbol() === 'MANUAL') {
                  <button *hasRole="'ADMIN'" type="button" class="sila-btn sila-btn-ghost sila-btn-sm shrink-0" data-testid="archivar-carpeta" (click)="archivandoCarpeta.set(c)">
                    Archivar<span class="sr-only"> la carpeta {{ c.nombre }}</span>
                  </button>
                }
              </li>
            }
          </ul>
        }

        @if (m.carpetas.length === 0 && m.archivos.total === 0) {
          <p class="sila-card p-8 text-center text-sm text-muted-foreground" data-testid="carpeta-vacia">Esta carpeta está vacía.</p>
        }
      }
    }

    @if (mostrarTabla()) {
      @let l = activo();
      <app-server-data-table
        [titulo]="buscando() ? 'Resultados' : 'Archivos'"
        [columns]="columnas"
        [page]="l.datos()"
        [rowId]="archivoId"
        [cargando]="l.cargando()"
        [error]="l.error()"
        [sort]="l.sort()"
        [vacioTitulo]="buscando() ? 'Ningún archivo coincide' : 'No hay archivos aquí'"
        [vacioAyuda]="buscando() ? 'Cambia la búsqueda o los filtros.' : ''"
        (pageChange)="l.irAPagina($event)"
        (sizeChange)="l.cambiarTamano($event)"
        (sortChange)="l.sort.set($event)"
        (reintentar)="l.recargar()"
      >
        <ng-template appDataTableCell="nombre" [cellRows]="l.datos()?.items" let-a>
          <button type="button" class="text-start font-medium underline-offset-2 hover:underline" data-testid="abrir-archivo" [class.line-through]="a.version === 'ANULADO'" (click)="ver(a)">
            {{ titulo(a) }}<span class="sr-only"> (ver el archivo)</span>
          </button>
          @if (a.origen === 'ADMIN') {
            <span class="block break-all text-xs text-muted-foreground">{{ a.carpeta }}</span>
          }
        </ng-template>
        <ng-template appDataTableCell="tipo_entidad" [cellRows]="l.datos()?.items" let-a>{{ tipoDe(a.tipo_entidad) }}</ng-template>
        <ng-template appDataTableCell="fecha" [cellRows]="l.datos()?.items" let-a><span class="whitespace-nowrap">{{ fecha(a.fecha) }}</span></ng-template>
        <ng-template appDataTableCell="tercero" [cellRows]="l.datos()?.items" let-a>{{ a.tercero || '—' }}</ng-template>
        <ng-template appDataTableCell="monto" [cellRows]="l.datos()?.items" let-a><span class="tabular-nums">{{ a.monto === null ? '—' : cop(a.monto) }}</span></ng-template>
        <ng-template appDataTableCell="tamano" [cellRows]="l.datos()?.items" let-a><span class="whitespace-nowrap tabular-nums">{{ tamano(a.tamano_bytes) }}</span></ng-template>
        <ng-template appDataTableCell="estado" [cellRows]="l.datos()?.items" let-a>
          <span class="flex flex-wrap gap-1" data-testid="insignias-fila">
            @for (i of insignias(a); track i.texto) {
              <app-status-chip [texto]="i.texto" [tono]="i.tono" />
            }
          </span>
        </ng-template>
        <ng-template appDataTableCell="acciones" [cellRows]="l.datos()?.items" let-a>
          <span class="flex flex-wrap gap-1">
            <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" data-testid="accion-ver" (click)="ver(a)">Ver<span class="sr-only"> {{ titulo(a) }}</span></button>
            <button type="button" class="sila-btn sila-btn-outline sila-btn-sm" data-testid="accion-descargar" (click)="descargando.set(a)">Descargar con clave<span class="sr-only"> {{ titulo(a) }}</span></button>
            <button type="button" class="sila-btn sila-btn-ghost sila-btn-sm" data-testid="accion-detalle" (click)="detalle.set(a)">Detalle<span class="sr-only"> de {{ titulo(a) }}</span></button>
            @if (a.origen === 'ADMIN' && !a.archivado) {
              <button *hasRole="'ADMIN'" type="button" class="sila-btn sila-btn-ghost sila-btn-sm text-destructive" data-testid="accion-archivar" (click)="archivando.set(a)">Archivar<span class="sr-only"> {{ titulo(a) }}</span></button>
            }
          </span>
        </ng-template>
      </app-server-data-table>
    }

    <!-- Dialogs -->
    <app-descarga-dialog [archivo]="descargando()" (cerrar)="descargando.set(null)" />
    <app-detalle-archivo-dialog [archivo]="detalle()" (cerrar)="detalle.set(null)" (irA)="detalle.set($event)" />
    <app-subir-archivos-dialog [abierto]="subiendo()" [idCarpeta]="idCarpetaActual()" [nombreCarpeta]="tituloCarpeta()" (subido)="alSubir()" (cerrar)="subiendo.set(false)" />
    <app-nueva-carpeta-dialog [abierto]="nuevaCarpeta()" [idPadre]="idCarpetaActual()" (creada)="alCrearCarpeta()" (cerrar)="nuevaCarpeta.set(false)" />

    <app-confirm-dialog
      [open]="archivando() !== null"
      titulo="Archivar archivo"
      [mensaje]="'«' + (archivando()?.nombre_archivo ?? '') + '» dejará de verse en las carpetas. Nada se borra: sigue pudiendo verse y descargarse buscándolo con «Incluir archivados». No se puede deshacer.'"
      textoConfirmar="Archivar"
      [peligro]="true"
      [motivo]="reglaMotivo"
      [ocupado]="procesando()"
      (confirmar)="archivar($event)"
      (cancelar)="archivando.set(null)"
    />
    <app-confirm-dialog
      [open]="archivandoCarpeta() !== null"
      titulo="Archivar carpeta"
      [mensaje]="'La carpeta «' + (archivandoCarpeta()?.nombre ?? '') + '» dejará de verse. Solo se puede si está vacía; no se puede deshacer.'"
      textoConfirmar="Archivar carpeta"
      [peligro]="true"
      [motivo]="reglaMotivo"
      [ocupado]="procesando()"
      (confirmar)="archivarCarpeta($event)"
      (cancelar)="archivandoCarpeta.set(null)"
    />
  `,
})
export class ExploradorPageComponent {
  private readonly repo = inject(ARCHIVOS_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly errores = inject(ApiErrorService);
  private readonly visor = inject(VisorArchivosService);

  protected readonly cop = formatoCop;
  protected readonly fecha = formatoFecha;
  protected readonly tamano = formatoTamano;
  protected readonly titulo = tituloArchivo;
  protected readonly tipoDe = etiquetaTipoArchivo;
  protected readonly insignias = insigniasDe;
  protected readonly reglaMotivo = { min: 5, max: 255 };
  protected readonly tipos: readonly { valor: TipoEntidadArchivo; etiqueta: string }[] = [
    { valor: 'VENTA', etiqueta: 'Venta' },
    { valor: 'ABONO', etiqueta: 'Abono' },
    { valor: 'PAGO_LECHERO', etiqueta: 'Pago a lecheros' },
    { valor: 'COMPRA_INSUMO', etiqueta: 'Compra de insumos' },
    { valor: 'GASTO', etiqueta: 'Gasto' },
    { valor: 'ARCHIVO', etiqueta: 'Archivo subido' },
  ];

  // ---------- Where we are (URL) ----------
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly consulta = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly arbol = computed(() => arbolDeUrl(this.params().get('arbol')));
  protected readonly ruta = computed(() => rutaDeQuery(this.consulta().getAll('ruta')));
  protected readonly nombreArbol = computed(() => (this.arbol() ? NOMBRES_ARBOL[this.arbol()!] : ''));

  // ---------- Search and filters ----------
  protected readonly texto = textoConEspera();
  protected readonly origen = signal<'' | OrigenArchivo>('');
  protected readonly tipo = signal<'' | TipoEntidadArchivo>('');
  protected readonly version = signal<'' | VersionArchivo>('');
  protected readonly estadoDrive = signal<'' | EstadoDrive>('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly incluirArchivados = signal(false);
  protected readonly buscando = computed(() => this.texto.valor() !== '' || this.origen() !== '' || this.tipo() !== '' || this.version() !== '' || this.estadoDrive() !== '' || this.desde() !== '' || this.hasta() !== '');

  // ---------- Data ----------
  /** The last answer of the explorer (folders, breadcrumb, `puede_subir`). Forgotten when the folder changes. */
  protected readonly meta = linkedSignal<{ arbol: unknown; ruta: unknown }, Explorador | null>({ source: () => ({ arbol: this.arbol(), ruta: this.ruta() }), computation: () => null });

  protected readonly explorador = crearListado({
    filtros: () => ({ arbol: this.arbol() ?? undefined, ruta: this.ruta(), incluir_archivados: this.incluirArchivados() || undefined }),
    cargar: (q) =>
      this.repo.explorador(q).pipe(
        tap((e) => this.meta.set(e)),
        map((e) => e.archivos as Page<Archivo>),
      ),
    sort: 'fecha,desc',
    habilitado: () => !this.buscando(),
  });

  protected readonly busqueda = crearListado({
    filtros: () => ({
      texto: this.texto.valor() || undefined,
      origen: this.origen() || undefined,
      tipo: this.tipo() || undefined,
      version: this.version() || undefined,
      estado_drive: this.estadoDrive() || undefined,
      desde: this.desde() || undefined,
      hasta: this.hasta() || undefined,
      archivado: this.incluirArchivados() ? undefined : false,
    }),
    cargar: (q) => this.repo.listar(q),
    sort: 'fecha,desc',
    habilitado: () => this.buscando(),
  });

  protected readonly activo = computed(() => (this.buscando() ? this.busqueda : this.explorador));
  /** The table shows up in search mode, or inside a folder that holds files (the root has none). */
  protected readonly mostrarTabla = computed(() => this.buscando() || (this.arbol() !== null && (this.meta()?.archivos.total ?? 0) > 0));

  protected readonly columnas: DataTableColumn<Archivo>[] = [
    { key: 'nombre', label: 'Archivo', rol: 'titulo', value: (a) => tituloArchivo(a) },
    { key: 'tipo_entidad', label: 'Tipo', sortable: false, value: (a) => etiquetaTipoArchivo(a.tipo_entidad) },
    { key: 'fecha', label: 'Fecha', value: (a) => a.fecha },
    { key: 'tercero', label: 'Tercero', ocultarEnMovil: true, value: (a) => a.tercero ?? '' },
    { key: 'monto', label: 'Monto', align: 'end', value: (a) => a.monto ?? 0 },
    { key: 'tamano', label: 'Tamaño', ocultarEnMovil: true, value: (a) => a.tamano_bytes },
    { key: 'estado', label: 'Estado', sortable: false, value: (a) => a.version },
    { key: 'acciones', label: 'Acciones', sortable: false, rol: 'acciones', value: () => '' },
  ];
  protected readonly archivoId = (a: Archivo) => a.id_documento;

  // ---------- What the person is doing ----------
  protected readonly descargando = signal<Archivo | null>(null);
  protected readonly detalle = signal<Archivo | null>(null);
  protected readonly archivando = signal<Archivo | null>(null);
  protected readonly archivandoCarpeta = signal<EntradaExplorador | null>(null);
  protected readonly subiendo = signal(false);
  protected readonly nuevaCarpeta = signal(false);
  protected readonly procesando = signal(false);

  /** The folder id of «Mis carpetas» we are in (the last key of the path), or `null` at its root. */
  protected readonly idCarpetaActual = computed(() => {
    if (this.arbol() !== 'MANUAL') return null;
    const ultima = this.ruta().at(-1);
    return ultima !== undefined && /^\d+$/.test(ultima) ? Number(ultima) : null;
  });
  protected readonly tituloCarpeta = computed(() => {
    const ruta = this.meta()?.ruta;
    return ruta && ruta.length > 0 ? ruta[ruta.length - 1].nombre : this.nombreArbol() || 'Archivos';
  });

  constructor() {
    // `?documento=<id>` (from «Ver documento» or the access log) opens the detail of that file, then leaves the URL clean.
    effect(() => {
      const valor = this.consulta().get('documento');
      if (valor === null) return;
      void this.router.navigate([], { relativeTo: this.route, queryParams: { documento: null }, queryParamsHandling: 'merge', replaceUrl: true });
      if (!/^\d+$/.test(valor)) return;
      this.repo.obtener(Number(valor)).subscribe({
        next: (a) => this.detalle.set(a),
        error: (fallo: unknown) => {
          const { mensaje, supportRef } = this.errores.describe(fallo);
          this.toast.error(mensaje, supportRef);
        },
      });
    });
  }

  protected icono(clave: string): IconName {
    return ICONO_ARBOL[clave] ?? 'lucideFolder';
  }

  /** The keys of the path up to the breadcrumb `i` (inclusive). */
  protected clavesHasta(i: number): string[] {
    return (this.meta()?.ruta ?? []).slice(0, i + 1).map((e) => e.clave);
  }

  /** The path of the subfolder `clave`: this one's keys plus its own. */
  protected rutaHacia(clave: string): string[] {
    return rutaMasProfunda(this.meta()?.ruta ?? [], clave);
  }

  protected limpiarBusqueda(): void {
    this.texto.crudo.set('');
    this.origen.set('');
    this.tipo.set('');
    this.version.set('');
    this.estadoDrive.set('');
    this.desde.set('');
    this.hasta.set('');
  }

  protected ver(a: Archivo): void {
    void this.visor.ver(a.id_documento, a.nombre_archivo);
  }

  protected alSubir(): void {
    this.activo().recargar();
  }

  protected alCrearCarpeta(): void {
    this.nuevaCarpeta.set(false);
    this.toast.exito('Carpeta creada.');
    this.activo().recargar();
  }

  protected archivar(motivo: string): void {
    const a = this.archivando();
    if (!a || this.procesando()) return;
    this.procesando.set(true);
    this.repo.archivar(a.id_documento, motivo).subscribe({
      next: () => {
        this.procesando.set(false);
        this.archivando.set(null);
        this.toast.exito('Archivo archivado.');
        this.activo().recargar();
      },
      error: (fallo: unknown) => {
        this.procesando.set(false);
        this.archivando.set(null);
        const { mensaje, supportRef } = this.errores.describe(fallo);
        this.toast.error(mensaje, supportRef);
      },
    });
  }

  protected archivarCarpeta(motivo: string): void {
    const c = this.archivandoCarpeta();
    if (!c || this.procesando()) return;
    this.procesando.set(true);
    this.repo.archivarCarpeta(Number(c.clave), motivo).subscribe({
      next: () => {
        this.procesando.set(false);
        this.archivandoCarpeta.set(null);
        this.toast.exito('Carpeta archivada.');
        this.activo().recargar();
      },
      error: (fallo: unknown) => {
        this.procesando.set(false);
        this.archivandoCarpeta.set(null);
        // A folder with something inside answers 409 («…archívelos primero»): the server's text, plus what to do if it did not say.
        const { mensaje, supportRef } = this.errores.describe(fallo);
        this.toast.error(/primero/i.test(mensaje) || !/archiv|activas|contiene/i.test(mensaje) ? mensaje : `${mensaje} Archive primero lo que contiene.`, supportRef);
      },
    });
  }
}
