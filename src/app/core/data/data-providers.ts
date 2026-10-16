import { Provider } from '@angular/core';
import { ACOPIO_REPOSITORY } from '../../features/acopio/data/acopio.provider';
import { HttpAcopioRepository } from '../../features/acopio/data/http-acopio.repository';
import { CARTERA_REPOSITORY } from '../../features/cartera/data/cartera.provider';
import { HttpCarteraRepository } from '../../features/cartera/data/http-cartera.repository';
import { HttpParametrosRepository } from '../../features/parametros/data/http-parametros.repository';
import { PARAMETROS_REPOSITORY } from '../../features/parametros/data/parametros.provider';
import { HttpPreciosClienteRepository } from '../../features/precios-cliente/data/http-precios-cliente.repository';
import { PRECIOS_CLIENTE_REPOSITORY } from '../../features/precios-cliente/data/precios-cliente.provider';
import { HttpVentasRepository } from '../../features/ventas/data/http-ventas.repository';
import { VENTAS_REPOSITORY } from '../../features/ventas/data/ventas.provider';
import { HttpInsumosRepository } from '../../features/insumos/data/http-insumos.repository';
import { INSUMOS_REPOSITORY } from '../../features/insumos/data/insumos.provider';
import { DOCUMENTOS_REPOSITORY } from '../../features/documentos/data/documentos.provider';
import { HttpDocumentosRepository } from '../../features/documentos/data/http-documentos.repository';
import { COMPROBANTES_REPOSITORY } from '../../features/comprobantes/data/comprobantes.provider';
import { HttpComprobantesRepository } from '../../features/comprobantes/data/http-comprobantes.repository';
import { HttpTableroRepository } from '../../features/tablero/data/http-tablero.repository';
import { TABLERO_REPOSITORY } from '../../features/tablero/data/tablero.provider';
import { ARCHIVOS_REPOSITORY } from '../../features/archivos/data/archivos.provider';
import { HttpArchivosRepository } from '../../features/archivos/data/http-archivos.repository';
import { GASTOS_REPOSITORY } from '../../features/gastos/data/gastos.provider';
import { HttpGastosRepository } from '../../features/gastos/data/http-gastos.repository';
import { HttpNotificacionesRepository } from '../../features/notificaciones/data/http-notificaciones.repository';
import { NOTIFICACIONES_REPOSITORY } from '../../features/notificaciones/data/notificaciones.provider';
import { AUDITORIA_REPOSITORY } from '../../features/auditoria/data/auditoria.provider';
import { HttpAuditoriaRepository } from '../../features/auditoria/data/http-auditoria.repository';
import { CATALOGOS_REPOSITORY } from '../../features/catalogos/data/catalogos.provider';
import { HttpCatalogosRepository } from '../../features/catalogos/data/http-catalogos.repository';
import { HttpInventarioRepository } from '../../features/inventario/data/http-inventario.repository';
import { INVENTARIO_REPOSITORY } from '../../features/inventario/data/inventario.provider';
import { HttpPeriodosRepository } from '../../features/periodos/data/http-periodos.repository';
import { PERIODOS_REPOSITORY } from '../../features/periodos/data/periodos.provider';
import { HttpProduccionRepository } from '../../features/produccion/data/http-produccion.repository';
import { PRODUCCION_REPOSITORY } from '../../features/produccion/data/produccion.provider';
import { HttpUsuariosRepository } from '../../features/usuarios/data/http-usuarios.repository';
import { USUARIOS_REPOSITORY } from '../../features/usuarios/data/usuarios.provider';

/** Binds every repository token to its HTTP implementation. Development and production use the same one. */
export function provideDataLayer(): Provider[] {
  return [
    { provide: CATALOGOS_REPOSITORY, useExisting: HttpCatalogosRepository },
    { provide: PERIODOS_REPOSITORY, useExisting: HttpPeriodosRepository },
    { provide: USUARIOS_REPOSITORY, useExisting: HttpUsuariosRepository },
    { provide: AUDITORIA_REPOSITORY, useExisting: HttpAuditoriaRepository },
    { provide: ACOPIO_REPOSITORY, useExisting: HttpAcopioRepository },
    { provide: PRODUCCION_REPOSITORY, useExisting: HttpProduccionRepository },
    { provide: INVENTARIO_REPOSITORY, useExisting: HttpInventarioRepository },
    { provide: INSUMOS_REPOSITORY, useExisting: HttpInsumosRepository },
    { provide: GASTOS_REPOSITORY, useExisting: HttpGastosRepository },
    { provide: ARCHIVOS_REPOSITORY, useExisting: HttpArchivosRepository },
    { provide: TABLERO_REPOSITORY, useExisting: HttpTableroRepository },
    { provide: COMPROBANTES_REPOSITORY, useExisting: HttpComprobantesRepository },
    { provide: DOCUMENTOS_REPOSITORY, useExisting: HttpDocumentosRepository },
    { provide: NOTIFICACIONES_REPOSITORY, useExisting: HttpNotificacionesRepository },
    { provide: VENTAS_REPOSITORY, useExisting: HttpVentasRepository },
    { provide: PRECIOS_CLIENTE_REPOSITORY, useExisting: HttpPreciosClienteRepository },
    { provide: CARTERA_REPOSITORY, useExisting: HttpCarteraRepository },
    { provide: PARAMETROS_REPOSITORY, useExisting: HttpParametrosRepository },
  ];
}
