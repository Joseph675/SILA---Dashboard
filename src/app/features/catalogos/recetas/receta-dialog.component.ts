import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiErrorService } from '../../../core/api/api-error';
import { HasRoleDirective } from '../../../core/auth/has-role.directive';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { mensajeDeFallo } from '../../../shared/utils/errores-api';
import { formatoCop, formatoNumero } from '../../../shared/utils/formato-co';
import { CATALOGOS_REPOSITORY } from '../data/catalogos.provider';
import type { Receta } from '../models/catalogos.models';
import { LineaEdicion, RecetaEditorComponent, lineaVacia, validarReceta } from './receta-editor.component';

/**
 * The recipe of a product: the supplies ONE unit uses, their cost and how many units the stock can make.
 * An ADMIN can edit it (the whole list is replaced; an empty one is valid).
 */
@Component({
  selector: 'app-receta-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, HasRoleDirective, RecetaEditorComponent],
  template: `
    <app-dialog [open]="idProducto() !== null" [title]="'Receta' + (receta.hasValue() ? ' · ' + receta.value().producto : '')" [description]="receta.hasValue() ? receta.value().codigo_sku : ''" [wide]="true" [cerrable]="!guardando()" (closed)="cerrar.emit()">
      @if (receta.error()) {
        <div role="alert" class="py-6 text-center">
          <p class="mb-3 font-medium">No se pudo cargar la receta.</p>
          <button type="button" class="sila-btn sila-btn-outline" (click)="receta.reload()">Reintentar</button>
        </div>
      } @else if (receta.hasValue()) {
        @let r = receta.value();
        @if (editando()) {
          <div class="space-y-4">
            @if (errorGuardar(); as mensaje) {
              <p role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" data-testid="error-guardar-receta">{{ mensaje }}</p>
            }
            <app-receta-editor [(lineas)]="filas" [error]="errorFilas()" />
          </div>
        } @else {
          @if (r.lineas.length === 0) {
            <p class="rounded-md bg-muted px-4 py-3 text-sm" data-testid="sin-receta">Este producto no tiene receta: al producirlo no se descuenta ningún insumo.</p>
          } @else {
            <ul class="divide-y divide-border" aria-label="Insumos de la receta" data-testid="lineas-receta">
              @for (l of r.lineas; track l.id_insumo) {
                <li class="min-w-0 space-y-0.5 py-2.5 text-sm">
                  <p class="flex flex-wrap items-center justify-between gap-2">
                    <span class="font-medium">{{ l.insumo }} <span class="font-mono text-xs text-muted-foreground">{{ l.codigo_insumo }}</span>
                      @if (!l.insumo_activo) { <span class="ms-1 rounded bg-muted px-1.5 py-0.5 text-xs">inactivo</span> }
                    </span>
                    <span class="tabular-nums">{{ numero(l.cantidad_por_unidad) }} {{ l.unidad_insumo }} por unidad</span>
                  </p>
                  <p class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Costo: {{ cop(l.costo_unitario_insumo) }} / {{ l.unidad_insumo }} · Stock: {{ numero(l.stock_insumo) }} {{ l.unidad_insumo }}</span>
                    <span class="tabular-nums">Vale {{ cop(l.valor_por_unidad) }} por unidad</span>
                  </p>
                </li>
              }
            </ul>
          }
          <dl class="mt-4 grid gap-2 rounded-md bg-muted px-4 py-3 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-xs text-muted-foreground">Costo de los insumos por unidad</dt>
              <dd class="font-semibold tabular-nums" data-testid="costo-insumos-unitario">{{ cop(r.costo_insumos_unitario) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">Unidades que alcanza a producir el stock</dt>
              <dd class="font-semibold tabular-nums" data-testid="unidades-posibles">{{ r.unidades_posibles === null ? '—' : numero(r.unidades_posibles) }}</dd>
            </div>
          </dl>
        }
      } @else {
        <p class="py-6 text-center text-sm text-muted-foreground" aria-busy="true">Cargando…</p>
      }

      <div dialogFooter class="flex flex-wrap gap-2">
        @if (editando()) {
          <button type="button" class="sila-btn sila-btn-outline" [disabled]="guardando()" (click)="editando.set(false)">Cancelar</button>
          <button type="button" class="sila-btn sila-btn-primary" [disabled]="guardando()" [attr.aria-busy]="guardando()" (click)="guardar()">{{ guardando() ? 'Guardando…' : 'Guardar receta' }}</button>
        } @else {
          @if (receta.hasValue()) {
            <button *hasRole="'ADMIN'" type="button" class="sila-btn sila-btn-outline" (click)="empezarEdicion()">Editar receta</button>
          }
          <button type="button" class="sila-btn sila-btn-primary" (click)="cerrar.emit()">Cerrar</button>
        }
      </div>
    </app-dialog>
  `,
})
export class RecetaDialogComponent {
  private readonly repo = inject(CATALOGOS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  /** The product whose recipe is shown; `null` = closed. */
  readonly idProducto = input<number | null>(null);
  /** Open straight in edit mode (after a product was created but its recipe failed). */
  readonly editarAlAbrir = input(false);

  readonly guardada = output<Receta>();
  readonly cerrar = output<void>();

  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;

  protected readonly receta = rxResource({ params: () => this.idProducto() ?? undefined, stream: ({ params }) => this.repo.obtenerReceta(params) });
  protected readonly editando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly filas = signal<LineaEdicion[]>([]);
  protected readonly errorFilas = signal<string | null>(null);
  protected readonly errorGuardar = signal<string | null>(null);

  constructor() {
    // Each opening starts in view mode (or in edit mode when asked) with the saved recipe.
    effect(() => {
      const id = this.idProducto();
      const editar = this.editarAlAbrir();
      untracked(() => {
        this.guardando.set(false);
        this.errorFilas.set(null);
        this.errorGuardar.set(null);
        this.editando.set(id !== null && editar);
        if (id !== null && editar) this.filas.set([]);
      });
    });
    // Once the recipe arrives while editing, the rows start from it.
    effect(() => {
      if (this.receta.hasValue() && untracked(() => this.editando() && this.filas().length === 0)) {
        this.filas.set(this.receta.value().lineas.map((l) => lineaVacia(l.id_insumo, String(l.cantidad_por_unidad))));
      }
    });
  }

  protected empezarEdicion(): void {
    if (!this.receta.hasValue()) return;
    this.filas.set(this.receta.value().lineas.map((l) => lineaVacia(l.id_insumo, String(l.cantidad_por_unidad))));
    this.errorFilas.set(null);
    this.errorGuardar.set(null);
    this.editando.set(true);
  }

  protected guardar(): void {
    const id = this.idProducto();
    if (id === null || this.guardando()) return;
    const { lineas, error } = validarReceta(this.filas());
    this.errorFilas.set(error);
    if (error) return;
    this.guardando.set(true);
    this.errorGuardar.set(null);
    this.repo
      .guardarReceta(id, lineas)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (guardada) => {
          this.guardando.set(false);
          this.editando.set(false);
          this.receta.reload();
          this.guardada.emit(guardada);
        },
        error: (fallo: unknown) => {
          this.guardando.set(false);
          // 400 duplicates, 404 unknown insumo: the server says which.
          this.errorGuardar.set(mensajeDeFallo(this.errores, fallo, [20001, 20006, 20007]));
        },
      });
  }
}
