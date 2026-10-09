import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CATALOGOS_REPOSITORY } from '../../../features/catalogos/data/catalogos.provider';
import type { Cliente } from '../../../features/catalogos/models/catalogos.models';
import { textoConEspera } from '../../utils/texto-debounce';
import { OpcionSelector, SelectorBuscableComponent } from '../selector-buscable/selector-buscable.component';

/**
 * Searches clients on the server as the person types (name or document, active only) and reports the chosen
 * `Cliente`. `valor` is the `id_cliente`. SUPUESTO: VC-02. Only the first 20 matches are listed: type more to narrow.
 */
@Component({
  selector: 'app-cliente-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SelectorBuscableComponent],
  template: `
    <app-selector-buscable
      [idCampo]="idCampo()"
      [opciones]="opciones()"
      [valor]="valor()"
      (valorChange)="elegir($event)"
      [etiquetaVacia]="etiquetaVacia()"
      [filtrarLocal]="false"
      placeholder="Buscar por nombre o documento…"
      (buscar)="texto.crudo.set($event)"
    />
  `,
})
export class ClienteSelectorComponent {
  private readonly repo = inject(CATALOGOS_REPOSITORY);

  readonly idCampo = input.required<string>();
  readonly valor = model<number | null>(null);
  /** `null` hides the "nothing chosen" row (the field is required). */
  readonly etiquetaVacia = input<string | null>('Todos los clientes');
  /** A client chosen from outside (e.g. the default CONSUMIDOR FINAL). It is shown and selected. */
  readonly preseleccionado = input<Cliente | null>(null);
  readonly clienteElegido = output<Cliente | null>();

  protected readonly texto = textoConEspera();
  private readonly conocidos = signal<ReadonlyMap<number, Cliente>>(new Map());

  private readonly busqueda = rxResource({
    params: () => ({ texto: this.texto.valor() }),
    stream: ({ params }) => this.repo.listarClientes({ texto: params.texto || undefined, activo: true, page: 0, size: 20, sort: 'nombre,asc' }),
  });

  protected readonly opciones = computed<OpcionSelector[]>(() => {
    const encontrados = this.busqueda.hasValue() ? this.busqueda.value().items : [];
    const extra = this.preseleccionado();
    const lista = extra && !encontrados.some((c) => c.id_cliente === extra.id_cliente) ? [extra, ...encontrados] : encontrados;
    return lista.map((c) => ({ valor: c.id_cliente, etiqueta: `${c.nombre} · ${c.numero_documento}` }));
  });

  constructor() {
    effect(() => {
      const encontrados = this.busqueda.hasValue() ? this.busqueda.value().items : [];
      this.conocidos.update((m) => new Map([...m, ...encontrados.map((c) => [c.id_cliente, c] as const)]));
    });
    effect(() => {
      const c = this.preseleccionado();
      if (c) {
        this.conocidos.update((m) => new Map(m).set(c.id_cliente, c));
        this.valor.set(c.id_cliente);
      }
    });
  }

  protected elegir(id: number | null): void {
    this.valor.set(id);
    this.clienteElegido.emit(id === null ? null : (this.conocidos().get(id) ?? null));
  }
}
