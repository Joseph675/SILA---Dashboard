import type { Observable } from 'rxjs';
import type { Page } from '../../../core/api/page.models';
import type {
  Cliente,
  ClienteGuardar,
  ClientesQuery,
  Producto,
  ProductoActualizar,
  ProductoCambiarPrecio,
  ProductoCrear,
  LineaRecetaGuardar,
  Receta,
  ProductosQuery,
  Proveedor,
  ProveedorGuardar,
  ProveedoresQuery,
} from '../models/catalogos.models';

/**
 * Data contract of the Catálogos screen. Components depend only on this
 * class (through CATALOGOS_REPOSITORY); today the only implementation is
 * HttpCatalogosRepository.
 *
 * Errors arrive as `ApiError`: 20001 invalid data, 20006 duplicate
 * document/SKU, 20008 insufficient role.
 */
export abstract class CatalogosRepository {
  abstract listarClientes(query: ClientesQuery): Observable<Page<Cliente>>;
  abstract crearCliente(datos: ClienteGuardar): Observable<Cliente>;
  abstract actualizarCliente(id: number, datos: ClienteGuardar): Observable<Cliente>;
  /** [ADMIN] */
  abstract cambiarEstadoCliente(id: number, activo: boolean): Observable<Cliente>;

  abstract listarProveedores(query: ProveedoresQuery): Observable<Page<Proveedor>>;
  abstract crearProveedor(datos: ProveedorGuardar): Observable<Proveedor>;
  abstract actualizarProveedor(id: number, datos: ProveedorGuardar): Observable<Proveedor>;
  /** [ADMIN] */
  abstract cambiarEstadoProveedor(id: number, activo: boolean): Observable<Proveedor>;

  abstract listarProductos(query: ProductosQuery): Observable<Page<Producto>>;
  /** The supplies one unit of the product uses (empty `lineas` when it has no recipe). */
  abstract obtenerReceta(idProducto: number): Observable<Receta>;
  /** [ADMIN] Replaces the WHOLE recipe; `[]` empties it. Duplicates → 400, unknown insumo → 404. */
  abstract guardarReceta(idProducto: number, lineas: LineaRecetaGuardar[]): Observable<Receta>;
  /** [ADMIN] */
  abstract crearProducto(datos: ProductoCrear): Observable<Producto>;
  abstract actualizarProducto(id: number, datos: ProductoActualizar): Observable<Producto>;
  /** [ADMIN] */
  abstract cambiarPrecioProducto(id: number, datos: ProductoCambiarPrecio): Observable<Producto>;
  /** [ADMIN] */
  abstract cambiarEstadoProducto(id: number, activo: boolean): Observable<Producto>;
}
