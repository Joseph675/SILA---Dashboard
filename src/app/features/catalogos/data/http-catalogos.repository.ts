import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
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
import { CatalogosRepository } from './catalogos.repository';

const BASE = 'catalogos';

/**
 * HTTP implementation: `{apiBaseUrl}/api/v1/catalogos/...`, same routes as
 * `CatalogoController` in the backend. JSON is snake_case on both sides, so
 * rows and bodies pass through without mapping. Failures arrive as `ApiError`
 * (see error.interceptor.ts).
 */
@Injectable({ providedIn: 'root' })
export class HttpCatalogosRepository extends CatalogosRepository {
  private readonly api = inject(ApiService);

  // ---------- Clientes ----------

  listarClientes(query: ClientesQuery): Observable<Page<Cliente>> {
    return this.api.get<Page<Cliente>>(`${BASE}/clientes`, { ...query });
  }
  crearCliente(datos: ClienteGuardar): Observable<Cliente> {
    return this.api.post<Cliente>(`${BASE}/clientes`, datos);
  }
  actualizarCliente(id: number, datos: ClienteGuardar): Observable<Cliente> {
    return this.api.put<Cliente>(`${BASE}/clientes/${id}`, datos);
  }
  cambiarEstadoCliente(id: number, activo: boolean): Observable<Cliente> {
    return this.api.patch<Cliente>(`${BASE}/clientes/${id}/estado`, { activo });
  }

  // ---------- Proveedores ----------

  listarProveedores(query: ProveedoresQuery): Observable<Page<Proveedor>> {
    return this.api.get<Page<Proveedor>>(`${BASE}/proveedores`, { ...query });
  }
  crearProveedor(datos: ProveedorGuardar): Observable<Proveedor> {
    return this.api.post<Proveedor>(`${BASE}/proveedores`, datos);
  }
  actualizarProveedor(id: number, datos: ProveedorGuardar): Observable<Proveedor> {
    return this.api.put<Proveedor>(`${BASE}/proveedores/${id}`, datos);
  }
  cambiarEstadoProveedor(id: number, activo: boolean): Observable<Proveedor> {
    return this.api.patch<Proveedor>(`${BASE}/proveedores/${id}/estado`, { activo });
  }

  // ---------- Productos ----------

  listarProductos(query: ProductosQuery): Observable<Page<Producto>> {
    return this.api.get<Page<Producto>>(`${BASE}/productos`, { ...query });
  }
  obtenerReceta(idProducto: number): Observable<Receta> {
    return this.api.get<Receta>(`${BASE}/productos/${idProducto}/receta`);
  }
  guardarReceta(idProducto: number, lineas: LineaRecetaGuardar[]): Observable<Receta> {
    return this.api.put<Receta>(`${BASE}/productos/${idProducto}/receta`, { lineas });
  }
  crearProducto(datos: ProductoCrear): Observable<Producto> {
    return this.api.post<Producto>(`${BASE}/productos`, datos);
  }
  actualizarProducto(id: number, datos: ProductoActualizar): Observable<Producto> {
    return this.api.put<Producto>(`${BASE}/productos/${id}`, datos);
  }
  cambiarStockMinimoProducto(id: number, stockMinimo: number): Observable<Producto> {
    return this.api.patch<Producto>(`${BASE}/productos/${id}/stock-minimo`, { stock_minimo: stockMinimo });
  }
  cambiarPrecioProducto(id: number, datos: ProductoCambiarPrecio): Observable<Producto> {
    return this.api.patch<Producto>(`${BASE}/productos/${id}/precio`, datos);
  }
  cambiarEstadoProducto(id: number, activo: boolean): Observable<Producto> {
    return this.api.patch<Producto>(`${BASE}/productos/${id}/estado`, { activo });
  }
}
