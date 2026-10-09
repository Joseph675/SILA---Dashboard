import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiErrorService } from '../../core/api/api-error';
import { ClaveIdempotente } from '../../core/api/idempotencia';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { formatoCop } from '../../shared/utils/formato-co';
import { CARTERA_REPOSITORY } from './data/cartera.provider';
import type { CastigoResultado, ClienteCartera } from './models/cartera.models';

const MOTIVO = { min: 10, max: 255 };

/** Writing off a client's whole debt as uncollectable. IRREVERSIBLE: reason + typing the client's name. ADMIN only (the server decides). */
@Component({
  selector: 'app-castigo-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, IconComponent],
  template: `
    <app-dialog [open]="cliente() !== null" title="Castigar cartera" [cerrable]="!enviando()" (closed)="cerrado.emit()">
      @if (cliente(); as c) {
        <div class="space-y-4 text-sm">
          <p class="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-3" role="alert">
            <app-icon name="lucideTriangleAlert" class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            <span>
              Se dará de baja como <strong>incobrable</strong> toda la deuda de <strong>{{ c.cliente }}</strong>: <strong data-testid="deuda-castigo">{{ cop(c.saldo_deudor) }}</strong>.
              <strong>Esta acción no se puede deshacer.</strong>
            </span>
          </p>
          @if (error(); as mensaje) {
            <p role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">{{ mensaje }}</p>
          }
          <div class="space-y-1.5">
            <label for="castigo-motivo" class="font-medium">Motivo (obligatorio)</label>
            <textarea id="castigo-motivo" class="sila-textarea" [attr.maxlength]="max" [value]="motivo()" (input)="motivo.set($any($event.target).value)"></textarea>
            <p class="text-xs text-muted-foreground">Entre {{ min }} y {{ max }} caracteres. Llevas {{ largo() }}.</p>
          </div>
          <div class="space-y-1.5">
            <label for="castigo-nombre" class="font-medium">Para confirmar, escribe el nombre del cliente: <span class="font-mono">{{ c.cliente }}</span></label>
            <input id="castigo-nombre" type="text" class="sila-input" autocomplete="off" [value]="nombre()" (input)="nombre.set($any($event.target).value)" />
          </div>
        </div>
      }
      <div dialogFooter class="flex gap-2">
        <button type="button" class="sila-btn sila-btn-outline" [disabled]="enviando()" (click)="cerrado.emit()">Cancelar</button>
        <button type="button" class="sila-btn bg-destructive text-white" [disabled]="!puedeConfirmar() || enviando()" [attr.aria-busy]="enviando()" (click)="castigar()">
          {{ enviando() ? 'Procesando…' : 'Castigar cartera' }}
        </button>
      </div>
    </app-dialog>
  `,
})
export class CastigoDialogComponent {
  private readonly repo = inject(CARTERA_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  readonly cliente = input<ClienteCartera | null>(null);
  readonly castigado = output<CastigoResultado>();
  readonly cerrado = output<void>();

  protected readonly cop = formatoCop;
  protected readonly min = MOTIVO.min;
  protected readonly max = MOTIVO.max;
  protected readonly motivo = signal('');
  protected readonly nombre = signal('');
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly clave = new ClaveIdempotente();

  protected readonly largo = computed(() => this.motivo().trim().length);
  protected readonly puedeConfirmar = computed(() => {
    const c = this.cliente();
    return !!c && this.largo() >= MOTIVO.min && this.largo() <= MOTIVO.max && this.nombre().trim().toLowerCase() === c.cliente.trim().toLowerCase();
  });

  constructor() {
    effect(() => {
      if (this.cliente()) {
        untracked(() => {
          this.motivo.set('');
          this.nombre.set('');
          this.error.set(null);
          this.enviando.set(false);
          this.clave.descartar();
        });
      }
    });
  }

  protected castigar(): void {
    const c = this.cliente();
    if (!c || !this.puedeConfirmar() || this.enviando()) return;
    const cuerpo = { id_cliente: c.id_cliente, motivo: this.motivo().trim() };
    this.enviando.set(true);
    this.error.set(null);
    this.repo
      .castigar(cuerpo, this.clave.para(cuerpo))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.enviando.set(false);
          this.clave.exito();
          this.castigado.emit(resultado);
        },
        error: (fallo: unknown) => {
          this.enviando.set(false);
          this.clave.fallo(fallo);
          this.error.set(mensajeDeFallo(this.errores, fallo, [20001, 20006]));
        },
      });
  }
}
