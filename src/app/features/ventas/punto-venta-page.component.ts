import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiErrorService, causaDe, isApiError } from '../../core/api/api-error';
import { ClaveIdempotente } from '../../core/api/idempotencia';
import { ClienteSelectorComponent } from '../../shared/ui/cliente-selector/cliente-selector.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { mensajeDeFallo } from '../../shared/utils/errores-api';
import { formatoCop, formatoNumero } from '../../shared/utils/formato-co';
import { imprimirTicket } from '../../shared/utils/imprimir';
import { textoConEspera } from '../../shared/utils/texto-debounce';
import { CATALOGOS_REPOSITORY } from '../catalogos/data/catalogos.provider';
import type { Cliente } from '../catalogos/models/catalogos.models';
import { PARAMETROS_REPOSITORY } from '../parametros/data/parametros.provider';
import { VENTAS_REPOSITORY } from './data/ventas.provider';
import type { MetodoPago, PrecioAplicable, TipoVenta, VentaDetalle } from './models/ventas.models';
import { LineaTicket, PagoFila, armarVenta, aNumero, cambioDe, cantidadValida, efectivoAplicado, faltante, montoDePago, totalPagado, totalesTicket } from './ticket.calculos';
import { VentaResumenComponent } from './venta-resumen.component';
import { METODOS_PAGO } from './ventas.format';

const DOCUMENTO_CONSUMIDOR_FINAL = '222222222222';
const MAX_PAGOS = 6;
/** SUPUESTO: VC-03. The product grid shows the first 30 matches; the search narrows it (a barcode reader types the whole SKU). */
const TAMANO_GRILLA = 30;

let siguientePago = 1;
const pagoNuevo = (metodo: MetodoPago = 'EFECTIVO', montoTexto = ''): PagoFila => ({ uid: siguientePago++, metodo, montoTexto, referencia: '' });

@Component({
  selector: 'app-punto-venta-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClienteSelectorComponent, IconComponent, PageHeaderComponent, RouterLink, VentaResumenComponent],
  templateUrl: './punto-venta-page.component.html',
})
export class PuntoVentaPageComponent {
  private readonly repo = inject(VENTAS_REPOSITORY);
  private readonly catalogos = inject(CATALOGOS_REPOSITORY);
  private readonly parametros = inject(PARAMETROS_REPOSITORY);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');

  protected readonly cop = formatoCop;
  protected readonly numero = formatoNumero;
  protected readonly metodos = METODOS_PAGO;
  protected readonly maxPagos = MAX_PAGOS;

  // ---------- Client ----------
  protected readonly consumidorFinal = signal<Cliente | null>(null);
  protected readonly cliente = signal<Cliente | null>(null);
  protected readonly esConsumidorFinal = computed(() => this.cliente()?.numero_documento === DOCUMENTO_CONSUMIDOR_FINAL);
  protected readonly cupoDisponible = computed(() => {
    const c = this.cliente();
    return c ? c.limite_credito - c.saldo_deudor : 0;
  });
  /** Why credit is not available, or `null` when it is. */
  protected readonly motivoSinCredito = computed(() => {
    const c = this.cliente();
    if (!c) return 'Elige un cliente.';
    if (this.esConsumidorFinal()) return 'El consumidor final solo compra de contado.';
    if (c.limite_credito <= 0) return 'Este cliente no tiene cupo de crédito.';
    return null;
  });

  protected readonly tipo = signal<TipoVenta>('CONTADO');

  // ---------- Parameters ----------
  private readonly parametrosRecurso = rxResource({ stream: () => this.parametros.listar() });
  protected readonly plazoCredito = computed(() => (this.parametrosRecurso.hasValue() ? (this.parametrosRecurso.value().find((p) => p.clave === 'PLAZO_CREDITO_DIAS')?.valor ?? null) : null));

  // ---------- Products ----------
  protected readonly texto = textoConEspera();
  protected readonly soloConStock = signal(false);
  protected readonly productos = rxResource({
    params: () => {
      const c = this.cliente();
      return c ? { id_cliente: c.id_cliente, texto: this.texto.valor() || undefined, solo_con_stock: this.soloConStock() || undefined } : undefined;
    },
    stream: ({ params }) => this.repo.precios({ ...params, page: 0, size: TAMANO_GRILLA, sort: 'producto,asc' }),
  });
  protected readonly items = computed(() => (this.productos.hasValue() ? this.productos.value().items : []));
  protected readonly totalCoincidencias = computed(() => (this.productos.hasValue() ? this.productos.value().total : 0));

  // ---------- Ticket ----------
  protected readonly lineas = signal<LineaTicket[]>([]);
  protected readonly totales = computed(() => totalesTicket(this.lineas()));
  protected readonly avisoPrecios = signal<string | null>(null);

  protected readonly pagos = signal<PagoFila[]>([pagoNuevo()]);
  protected readonly recibido = signal('');
  protected readonly pagado = computed(() => totalPagado(this.pagos()));
  protected readonly falta = computed(() => faltante(this.totales().total, this.pagos()));
  protected readonly cambio = computed(() => cambioDe(this.recibido(), this.pagos()));
  protected readonly efectivo = computed(() => efectivoAplicado(this.pagos()));

  protected readonly superaCupo = computed(() => this.tipo() === 'CREDITO' && this.totales().total > this.cupoDisponible());

  /** Why «Cobrar» is disabled, or `null` when the sale is ready. */
  protected readonly bloqueo = computed<string | null>(() => {
    const lineas = this.lineas();
    if (!this.cliente()) return 'Elige un cliente.';
    if (lineas.length === 0) return 'Agrega al menos un producto.';
    if (lineas.some((l) => cantidadValida(l.cantidadTexto) === null)) return 'Revisa las cantidades: mayores que 0 y con máximo 2 decimales.';
    if (this.totales().total <= 0) return 'El total debe ser mayor que cero.';
    if (this.tipo() === 'CREDITO') return this.motivoSinCredito();
    if (this.pagos().length === 0 || this.pagos().some((p) => montoDePago(p) === null)) return 'Escribe un monto válido en cada medio de pago.';
    const falta = this.falta();
    if (falta > 0) return `Faltan ${formatoCop(falta)} para completar el pago.`;
    if (falta < 0) return `Los pagos superan el total por ${formatoCop(-falta)}.`;
    return null;
  });

  // ---------- Sending ----------
  protected readonly enviando = signal(false);
  protected readonly errorVenta = signal<string | null>(null);
  protected readonly confirmada = signal<VentaDetalle | null>(null);
  private readonly clave = new ClaveIdempotente();
  private cambioDeCliente = 0;

  constructor() {
    // CONSUMIDOR FINAL is the default client of every sale.
    this.catalogos
      .listarClientes({ texto: DOCUMENTO_CONSUMIDOR_FINAL, activo: true, page: 0, size: 5 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pagina) => {
          const c = pagina.items.find((x) => x.numero_documento === DOCUMENTO_CONSUMIDOR_FINAL) ?? null;
          this.consumidorFinal.set(c);
          if (this.cliente() === null) this.cliente.set(c);
        },
        error: () => undefined,
      });
    // Credit that stops being possible (another client) goes back to cash.
    effect(() => {
      if (this.tipo() === 'CREDITO' && this.motivoSinCredito() !== null) this.tipo.set('CONTADO');
    });
  }

  // ---------- Client change ----------
  protected cambiarCliente(nuevo: Cliente | null): void {
    if (!nuevo) return;
    this.cliente.set(nuevo);
    this.errorVenta.set(null);
    this.avisoPrecios.set(null);
    const lineas = this.lineas();
    if (lineas.length === 0) return;
    // The price may change with the client: ask again for the prices of the lines.
    const turno = ++this.cambioDeCliente;
    this.repo
      .precios({ id_cliente: nuevo.id_cliente, page: 0, size: 100, sort: 'producto,asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pagina) => {
          if (turno !== this.cambioDeCliente) return;
          const porId = new Map(pagina.items.map((p) => [p.id_producto, p]));
          const cambiados: string[] = [];
          this.lineas.update((ls) =>
            ls.map((l) => {
              const p = porId.get(l.id_producto);
              if (!p) return l;
              if (p.precio_aplicable !== l.precio_unitario) cambiados.push(l.producto);
              return { ...l, precio_unitario: p.precio_aplicable, precio_base: p.precio_base, pactado: p.precio_pactado !== null, stock: p.stock_actual };
            }),
          );
          if (cambiados.length > 0) this.avisoPrecios.set(`Cambió el precio de: ${cambiados.join(', ')}.`);
        },
        error: () => this.avisoPrecios.set('No se pudieron actualizar los precios para este cliente. Revisa el ticket antes de cobrar.'),
      });
  }

  // ---------- Products ----------
  protected agregar(item: PrecioAplicable): void {
    if (item.stock_actual <= 0) return;
    this.confirmada.set(null);
    this.errorVenta.set(null);
    this.lineas.update((ls) => {
      const existente = ls.find((l) => l.id_producto === item.id_producto);
      if (existente) {
        return ls.map((l) => (l === existente ? { ...l, cantidadTexto: String((cantidadValida(l.cantidadTexto) ?? 0) + 1) } : l));
      }
      return [
        ...ls,
        {
          id_producto: item.id_producto,
          codigo_sku: item.codigo_sku,
          producto: item.producto,
          unidad_medida: item.unidad_medida,
          cantidadTexto: '1',
          precio_unitario: item.precio_aplicable,
          precio_base: item.precio_base,
          pactado: item.precio_pactado !== null,
          tarifa_iva: item.tarifa_iva,
          stock: item.stock_actual,
        },
      ];
    });
  }

  /** Enter in the search box: an exact SKU is added directly (barcode reader). It asks the server, so a fast reader does not depend on the debounce. */
  protected async alEnter(): Promise<void> {
    const escrito = this.texto.crudo().trim();
    const c = this.cliente();
    if (!escrito || !c) return;
    try {
      const pagina = await firstValueFrom(this.repo.precios({ id_cliente: c.id_cliente, texto: escrito, page: 0, size: TAMANO_GRILLA }));
      const exacto = pagina.items.find((p) => p.codigo_sku.toLowerCase() === escrito.toLowerCase());
      if (exacto) {
        this.agregar(exacto);
        this.texto.crudo.set('');
      }
    } catch {
      // The grid shows the failure; nothing to add.
    }
  }

  protected cambiarCantidad(indice: number, texto: string): void {
    this.errorVenta.set(null);
    this.lineas.update((ls) => ls.map((l, i) => (i === indice ? { ...l, cantidadTexto: texto } : l)));
  }

  protected quitar(indice: number): void {
    this.errorVenta.set(null);
    this.lineas.update((ls) => ls.filter((_, i) => i !== indice));
  }

  protected superaStock(l: LineaTicket): boolean {
    const n = cantidadValida(l.cantidadTexto);
    return n !== null && n > l.stock;
  }

  protected cantidadInvalida(l: LineaTicket): boolean {
    return cantidadValida(l.cantidadTexto) === null;
  }

  // ---------- Payments ----------
  protected agregarPago(): void {
    this.errorVenta.set(null);
    if (this.pagos().length < MAX_PAGOS) this.pagos.update((ps) => [...ps, pagoNuevo('TRANSFERENCIA')]);
  }

  protected quitarPago(uid: number): void {
    this.errorVenta.set(null);
    this.pagos.update((ps) => (ps.length > 1 ? ps.filter((p) => p.uid !== uid) : ps));
  }

  protected cambiarPago(uid: number, cambio: Partial<PagoFila>): void {
    this.errorVenta.set(null);
    this.pagos.update((ps) => ps.map((p) => (p.uid === uid ? { ...p, ...cambio } : p)));
  }

  protected pideReferencia(metodo: MetodoPago): boolean {
    return METODOS_PAGO.find((m) => m.valor === metodo)?.pideReferencia ?? false;
  }

  /** Puts in this row what is still missing (the others stay as they are). */
  protected completarCon(uid: number): void {
    const otros = totalPagado(this.pagos().filter((p) => p.uid !== uid));
    const resto = Math.max(0, this.totales().total - otros);
    this.cambiarPago(uid, { montoTexto: resto > 0 ? String(Math.round(resto * 100) / 100) : '' });
  }

  protected todoEnEfectivo(): void {
    this.errorVenta.set(null);
    this.pagos.set([pagoNuevo('EFECTIVO', String(this.totales().total))]);
  }

  protected montoNumero(fila: PagoFila): number {
    return aNumero(fila.montoTexto);
  }

  // ---------- Charge ----------
  protected cobrar(): void {
    const c = this.cliente();
    if (!c || this.bloqueo() !== null || this.enviando()) return;
    const cuerpo = armarVenta(c.id_cliente, this.tipo(), this.lineas(), this.pagos());
    this.enviando.set(true);
    this.errorVenta.set(null);
    this.repo
      .crear(cuerpo, this.clave.para(cuerpo))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (venta) => {
          this.enviando.set(false);
          this.clave.exito();
          // What counts now is what the SERVER answered, not our preview.
          this.confirmada.set(venta);
          this.productos.reload();
        },
        error: (fallo: unknown) => {
          this.enviando.set(false);
          this.clave.fallo(fallo);
          const error = causaDe(fallo);
          if (isApiError(error) && error.code === 20017) this.clave.descartar();
          // The ticket stays as it is. Stock changed: reload it so the screen shows the real one.
          if (isApiError(error) && error.code === 20002) this.productos.reload();
          this.errorVenta.set(mensajeDeFallo(this.errores, fallo, [20001, 20002, 20003, 20006, 20007]));
        },
      });
  }

  protected nuevaVenta(): void {
    this.confirmada.set(null);
    this.lineas.set([]);
    this.pagos.set([pagoNuevo()]);
    this.recibido.set('');
    this.tipo.set('CONTADO');
    this.errorVenta.set(null);
    this.avisoPrecios.set(null);
    this.texto.crudo.set('');
    this.cliente.set(this.consumidorFinal());
    this.clave.descartar();
    setTimeout(() => this.buscador()?.nativeElement.focus());
  }

  protected imprimir(): void {
    imprimirTicket();
  }
}
