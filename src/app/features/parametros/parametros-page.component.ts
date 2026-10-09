import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiErrorService } from '../../core/api/api-error';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { formatoNumero } from '../../shared/utils/formato-co';
import { PARAMETROS_REPOSITORY } from './data/parametros.provider';
import type { Parametro } from './models/parametros.models';
import { GrupoParametro, ORDEN_GRUPOS, PARAMETROS_CONOCIDOS } from './parametros.nombres';

interface Fila {
  parametro: Parametro;
  nombre: string;
  texto: string;
  /** null = valid and ready to save. */
  error: string | null;
  cambio: boolean;
  errorServidor: string | null;
}

/** Hasta 2 decimales, as the API accepts. */
const NUMERO = /^-?\d+([.,]\d{1,2})?$/;

@Component({
  selector: 'app-parametros-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, IconComponent, PageHeaderComponent],
  template: `
    <app-page-header title="Parámetros del sistema" description="Valores de negocio que se ajustan sin tocar el código. Cada cambio queda en la auditoría." />

    <p class="mb-6 flex items-start gap-2 rounded-md bg-muted px-4 py-3 text-sm">
      <app-icon name="lucideInfo" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      Un cambio rige desde la siguiente operación y no altera lo ya registrado.
    </p>

    @if (parametros.error()) {
      <div role="alert" class="sila-card p-6 text-center">
        <p class="mb-3 font-medium">No se pudieron cargar los parámetros.</p>
        <button type="button" class="sila-btn sila-btn-outline" (click)="parametros.reload()">Reintentar</button>
      </div>
    } @else if (parametros.isLoading() && !parametros.hasValue()) {
      <div class="sila-card p-6 text-sm text-muted-foreground" aria-busy="true">Cargando parámetros…</div>
    } @else {
      @for (grupo of grupos(); track grupo.titulo) {
        <section class="mb-8" [attr.aria-labelledby]="'grupo-' + $index">
          <h2 [id]="'grupo-' + $index" class="mb-3 text-base font-semibold">{{ grupo.titulo }}</h2>
          @if (grupo.titulo === 'Seguridad de acceso') {
            <p class="mb-3 flex items-start gap-2 rounded-md border border-warning/50 bg-warning/15 px-4 py-3 text-sm" data-testid="aviso-seguridad">
              <app-icon name="lucideTriangleAlert" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span><strong>Afectan a todos los usuarios.</strong> Un valor demasiado bajo puede bloquear cuentas con frecuencia; uno muy alto debilita la seguridad.</span>
            </p>
          }
          <ul class="sila-card divide-y divide-border">
            @for (fila of grupo.filas; track fila.parametro.clave) {
              <li class="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-start">
                <div>
                  <label [for]="'p-' + fila.parametro.clave" class="text-sm font-medium">{{ fila.nombre }}</label>
                  <p class="text-xs text-muted-foreground">{{ fila.parametro.descripcion }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">
                    Rango permitido: {{ numero(fila.parametro.minimo) }} a {{ numero(fila.parametro.maximo) }} · Valor actual: <strong>{{ numero(fila.parametro.valor) }}</strong>
                  </p>
                </div>
                <div class="flex flex-wrap items-start gap-2">
                  <div>
                    <input
                      [id]="'p-' + fila.parametro.clave"
                      type="number"
                      inputmode="decimal"
                      class="sila-input w-32"
                      step="0.01"
                      [min]="fila.parametro.minimo"
                      [max]="fila.parametro.maximo"
                      [value]="fila.texto"
                      [attr.aria-invalid]="fila.error || fila.errorServidor ? 'true' : null"
                      [attr.aria-describedby]="'p-' + fila.parametro.clave + '-error'"
                      (input)="escribir(fila.parametro.clave, $any($event.target).value)"
                    />
                    <p [id]="'p-' + fila.parametro.clave + '-error'" class="mt-1 max-w-56 text-xs font-medium text-destructive" aria-live="polite">{{ fila.errorServidor ?? (fila.cambio ? fila.error : null) }}</p>
                  </div>
                  <button type="button" class="sila-btn sila-btn-primary" [disabled]="!fila.cambio || !!fila.error || guardando()" (click)="pedirConfirmacion(fila)">Guardar</button>
                </div>
              </li>
            }
          </ul>
        </section>
      }
    }

    <app-confirm-dialog
      [open]="pendiente() !== null"
      titulo="Cambiar parámetro"
      [mensaje]="mensajeConfirmacion()"
      textoConfirmar="Cambiar valor"
      [ocupado]="guardando()"
      (confirmar)="guardar()"
      (cancelar)="pendiente.set(null)"
    />
  `,
})
export class ParametrosPageComponent {
  private readonly repo = inject(PARAMETROS_REPOSITORY);
  private readonly toast = inject(ToastService);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly parametros = rxResource({ stream: () => this.repo.listar() });
  protected readonly numero = formatoNumero;

  /** What the person typed, by key; absent = untouched. */
  private readonly ediciones = signal<Record<string, string>>({});
  private readonly erroresServidor = signal<Record<string, string>>({});
  protected readonly pendiente = signal<{ clave: string; nombre: string; antes: number; despues: number } | null>(null);
  protected readonly guardando = signal(false);

  protected readonly grupos = computed(() => {
    const lista = this.parametros.hasValue() ? this.parametros.value() : [];
    const ed = this.ediciones();
    const porGrupo = new Map<GrupoParametro, Fila[]>();
    for (const parametro of lista) {
      const conocido = PARAMETROS_CONOCIDOS[parametro.clave];
      const texto = ed[parametro.clave] ?? String(parametro.valor);
      const numeroEscrito = NUMERO.test(texto.trim()) ? Number(texto.trim().replace(',', '.')) : NaN;
      let error: string | null = null;
      if (texto.trim() === '' || Number.isNaN(numeroEscrito)) error = 'Escribe un número (hasta 2 decimales).';
      else if (numeroEscrito < parametro.minimo || numeroEscrito > parametro.maximo) error = `Debe estar entre ${formatoNumero(parametro.minimo)} y ${formatoNumero(parametro.maximo)}.`;
      const fila: Fila = {
        parametro,
        nombre: conocido?.nombre ?? parametro.descripcion,
        texto,
        error,
        cambio: parametro.clave in ed && numeroEscrito !== parametro.valor,
        errorServidor: this.erroresServidor()[parametro.clave] ?? null,
      };
      const grupo = conocido?.grupo ?? 'Otros';
      porGrupo.set(grupo, [...(porGrupo.get(grupo) ?? []), fila]);
    }
    return ORDEN_GRUPOS.filter((g) => porGrupo.has(g)).map((titulo) => ({ titulo, filas: porGrupo.get(titulo)! }));
  });

  protected readonly mensajeConfirmacion = computed(() => {
    const p = this.pendiente();
    return p ? `«${p.nombre}» pasará de ${formatoNumero(p.antes)} a ${formatoNumero(p.despues)}. Rige desde la siguiente operación, sin alterar lo ya registrado.` : '';
  });

  protected escribir(clave: string, texto: string): void {
    this.ediciones.update((e) => ({ ...e, [clave]: texto }));
    this.erroresServidor.update(({ [clave]: _quitado, ...resto }) => resto);
  }

  protected pedirConfirmacion(fila: Fila): void {
    this.pendiente.set({ clave: fila.parametro.clave, nombre: fila.nombre, antes: fila.parametro.valor, despues: Number(fila.texto.trim().replace(',', '.')) });
  }

  protected guardar(): void {
    const p = this.pendiente();
    if (!p || this.guardando()) return;
    this.guardando.set(true);
    this.repo
      .actualizar(p.clave, p.despues)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.pendiente.set(null);
          this.ediciones.update(({ [p.clave]: _quitado, ...resto }) => resto);
          this.parametros.reload();
          this.toast.exito(`«${p.nombre}» ahora vale ${formatoNumero(p.despues)}.`);
        },
        error: (fallo: unknown) => {
          this.guardando.set(false);
          this.pendiente.set(null);
          // 20001: the server's message carries the allowed range.
          this.erroresServidor.update((e) => ({ ...e, [p.clave]: mensajeDeFallo(this.errores, fallo, [20001]) }));
        },
      });
  }
}
