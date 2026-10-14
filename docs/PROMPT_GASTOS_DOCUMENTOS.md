# Prompt para el agente del dashboard — Gastos y documentos

Lee primero `docs/CONTRATO_BACKEND.md`, sección **«Gastos operativos y documentos»**. El backend ya está hecho; no lo cambies.
Sigue el patrón de `features/catalogos` (repositorio con swap mock/HTTP, `Page<T>`, kit de UI) y `docs/PROMPT_RESPONSIVE_MOVIL.md`.

## 1. Pantalla «Gastos» (bajo Finanzas)
- Tabla paginada: fecha, categoría, concepto, monto, quincena, registró. Filtros: quincena (por defecto la actual), categoría, texto, rango de fechas.
- Tarjeta superior con `GET /finanzas/gastos/resumen` usando **los mismos filtros** (total y cantidad).
- «Registrar gasto» (cualquier rol): categoría (solo activas, de `/finanzas/categorias?soloActivas=true`), concepto, monto, fecha (opcional, no futura).
  Envía `Idempotency-Key` (mismo mecanismo que Ventas). Maneja 409/20010 («la quincena está cerrada») y 409/20006 (categoría inactiva) con su mensaje.
- No hay editar ni borrar. **Anular** (solo ADMIN, `POST /finanzas/gastos/{id}/anular`, motivo de 10+ caracteres, con `Idempotency-Key`): botón en la fila con diálogo de motivo.
  Los anulados se ven tachados con un badge «Anulado» y el motivo/usuario/fecha en el detalle; filtro `estado` (por defecto muestra todos). Manejar 409/20004 (quincena cerrada) y 409/20010 (ya anulado).
- Vista «Por categoría» con `GET /finanzas/gastos/por-categoria` (ruta nueva: antes era `/finanzas/gastos`; actualiza el repositorio existente).

## 2. Documentos
- Pestaña/listado «Documentos» con filtros tipo de entidad, estado; badge por estado (PENDIENTE / SUBIDO / ERROR), intentos y `ultimo_error`; enlace a `drive_url` si existe.
- En el detalle de una recepción de leche (y de facturas cuando existan) muestra sus documentos con `?tipo_entidad=&id_entidad=` y un botón «Registrar documento»
  (`POST /documentos`). La subida real a Drive no existe aún: deja el hook preparado y NO simules el estado SUBIDO.
- Las tres escrituras exigen `Idempotency-Key`.

## Pruebas
- Un test por método nuevo del repositorio HTTP y de los mocks (con latencia, como los demás).
