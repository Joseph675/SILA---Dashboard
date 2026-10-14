# Prompt para el agente del dashboard — Insumos y recetas

Lee primero `docs/CONTRATO_BACKEND.md`, sección **«Insumos, recetas y costo del lote»**. El backend ya está hecho y probado; no lo cambies.
Sigue el patrón de `features/catalogos` (repositorio con swap mock/HTTP, `Page<T>`, kit de UI) y las reglas de `docs/PROMPT_RESPONSIVE_MOVIL.md`.

## 1. Pantalla «Insumos» (nueva, bajo Inventario)
- Pestañas: **Insumos**, **Compras**, **Ajustes**.
- **Insumos**: tabla paginada (código, nombre, unidad, stock, mínimo, costo promedio, valor), buscador, filtro «solo bajo el mínimo» y activo/inactivo.
  Fila en alerta cuando `bajo_minimo`. Tarjetas de resumen con `/insumos/resumen`. Crear/editar/activar solo si el rol es ADMIN
  (la unidad se deshabilita si el backend responde 409/20006; muestra su mensaje).
- **Compras**: listado con filtros (insumo, proveedor INSUMOS, estado, fechas). Botón «Registrar compra» (ADMIN): insumo, proveedor opcional
  (solo proveedores `tipo = INSUMOS`), cantidad, **valor total de la factura**, referencia, fecha. Mostrar el costo unitario calculado en la fila.
  «Anular» (ADMIN) pide motivo de 10+ caracteres; si responde 409/20002 explica que ya se gastó parte de lo comprado.
- **Ajustes**: listado y formulario. OPERATIVO solo ve MERMA / DANO / VENCIMIENTO; ADMIN también las correcciones. Cantidad siempre positiva.
- Enviar `Idempotency-Key` en compras y ajustes (obligatoria) con el mismo mecanismo que Ventas/Producción.

## 2. Receta en el producto
- En el **formulario de crear producto** (ADMIN) agrega la sección «Insumos que usa»: filas `insumo + cantidad por unidad` (la unidad del insumo se muestra
  al lado; solo insumos activos). Al guardar manda `receta: [{id_insumo, cantidad}]` en `POST /catalogos/productos`.
  Si falla la receta, el backend responde con el mensaje «El producto se creó (id N) pero la receta no se guardó…»: muéstralo y lleva al usuario
  al editor de receta de ese producto en vez de dejarlo reintentar el alta (daría SKU duplicado).
- **Detalle/edición de producto**: pestaña «Receta» con `GET /catalogos/productos/{id}/receta`: tabla de líneas (insumo, cantidad, unidad,
  costo unitario, `valor_por_unidad`) y al pie `costo_insumos_unitario` y `unidades_posibles`. Editar (ADMIN) con `PUT` enviando la lista completa.
  Una receta vacía es válida.

## 3. Producción
- En el formulario de lote, al elegir producto con receta, consulta la receta y calcula en vivo `cantidad_obtenida × cantidad_por_unidad`
  por insumo contra `stock_insumo`; avisa en rojo lo que falte (el backend igual responde 409/20002 y no crea el lote).
- En el listado/detalle del lote muestra `costo_leche`, `costo_insumos` y `costo_total`; el detalle lista los consumos con `GET /insumos/consumos?id_lote=`.

## 4. Períodos
- Muestra `compras_insumos` en las cuentas de la quincena. `caja_neta` ahora la resta (actualiza el texto de ayuda de la caja).

## Pruebas y límites
- Un test por método nuevo del repositorio HTTP y de los mocks. Mock con latencia, igual que los demás.
- Rutas y botones de escritura según rol; sin trucos de cliente: la base es quien decide.
