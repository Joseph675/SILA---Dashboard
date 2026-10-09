# Tarea: pantallas de Recepción de leche, Producción e Inventario

Trabajas en `~/Documentos/dashboard/dashboard-app` (Angular 22, standalone, signals, Tailwind 4, Vitest). SILA es el sistema de Llanolat, una empresa de lácteos en Colombia. Toda la interfaz va en **español de Colombia**.

**Alcance de la verificación:** construye, comprueba **una vez** que compila, que tus pruebas pasan y que las pantallas funcionan contra el backend real, y entrega. No hace falta repetir revisiones ni agotar casos límite: el dueño revisará después y, si quiere algo a fondo, lo pedirá.

## Contexto de negocio (cadena de SILA)

La leche llega de proveedores lecheros (**acopio**, con control de calidad) → se transforma en productos (**producción**, por lotes) → eso genera **stock** (**inventario**, que luego descontará Ventas). Tres pantallas:

1. **Recepción de leche** (`/acopio`) — registrar entregas y consultar calidad y pago a lecheros.
2. **Producción** (`/produccion`) — registrar lotes y ajustes de inventario.
3. **Inventario** (`/inventario`) — ver stock, valor y alertas de caducidad.

## Lee primero

1. `docs/CONTRATO_BACKEND.md`: secciones **«Acopio de leche»**, **«Producción e inventario»**, **«Idempotency-Key»**, **«Convenciones»** y la tabla de **errores**. Es la única fuente de verdad; el backend ya está implementado y probado. **No lo modifiques**; si el contrato y la realidad no coinciden, detente y repórtalo.
2. Las pantallas ya construidas como plantilla: `features/periodos/*` (repositorio abstracto + token + HTTP, listado paginado, diálogos), `features/usuarios/*` (formularios en diálogo, acciones por fila, toasts), `features/auditoria/*` (pestañas con filtros y fechas), y `core/api/idempotencia.ts` + `ApiService` (`post(path, body, { idempotencyKey })`).
3. `docs/SUPUESTOS.md` (formato; comentarios `// SUPUESTO:`).

## Reglas que ya rigen (no las rompas)

- Datos por **repositorio** (clase abstracta + `InjectionToken` + implementación HTTP), registrados en `core/data/data-providers.ts`. Componentes `standalone`, `OnPush`, signals, control flow, `inject()`. Reutiliza `shared/ui/*`, `crearListado`, `app-server-data-table`, `app-status-chip`, `app-confirm-dialog`, `app-dialog`, `ToastService`, `ApiErrorService`, `formatoCop`, `formatoNumero`, `formatoFecha`, `formatoFechaHora`. Sin librerías nuevas.
- **Idempotency-Key obligatoria** en TODA escritura de estas pantallas (recepciones, lotes, ajustes): sin ella el servidor responde `400`. **Una clave nueva por cada acción del usuario** (`nuevaClaveIdempotencia()`); se reutiliza solo para reintentar esa misma acción (fallo de red). Si el servidor responde `422`/`20017` (misma clave con otros datos), genera una nueva y avisa. Un `4xx` de validación no consume la clave.
- **Fechas:** el «hoy» de SILA es **el día en Colombia** (`America/Bogota`), no el del navegador ni el UTC. Agrega un helper `hoyColombia()` (p. ej. con `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })`) y úsalo como valor inicial y como `max` de los campos de fecha. Las fechas que llegan son `AAAA-MM-DD` (se muestran con `formatoFecha`); las marcas de tiempo (`fecha_registro`) llegan en **UTC sin zona**: muéstralas con `formatoFechaHora`.
- **Roles:** todos los usuarios autenticados ven las tres pantallas y registran recepciones, lotes y los ajustes de resta. Los ajustes `INGRESO_INICIAL`, `CORRECCION_MAS` y `CORRECCION_MENOS` son **solo ADMIN**: ofrece al OPERATIVO únicamente los 4 tipos permitidos (con `appHasRole`/`AuthService.hasRole`), pero **el servidor decide** (muestra el `403`/`20008` si ocurre).
- Ocultar un botón no es seguridad; no registres datos en consola; textos es-CO; accesibilidad (labels, foco, estados con ícono + texto, nunca solo color).
- Cada decisión tuya que no esté aquí ni en el contrato: `// SUPUESTO: …` y una fila en una nueva sección **«Acopio y producción»** de `docs/SUPUESTOS.md` (ids `AP-01`, `AP-02`…).
- No modifiques el backend ni las pantallas existentes (salvo lo necesario para registrar rutas, menú y providers).

## 1 · Recepción de leche (`/acopio`)

Ruta lazy `features/acopio/acopio.routes.ts`, título `Recepción de leche · SILA`. Ítem **«Recepción de leche»** del grupo «Producción y acopio» en `sidebar-nav.data.ts` (`route: '/acopio'`). Tres pestañas:

**a) Recepciones** (por defecto) — `GET /acopio/recepciones`: tabla con fecha, proveedor, litros (`formatoNumero`), temperatura (°C), acidez (°Dornic), **estado de calidad** (`app-status-chip`: APROBADO → éxito, RECHAZADO → peligro; con ícono + texto) y motivo de rechazo (visible en la fila o en un `title`). Filtros: proveedor (selector con búsqueda), estado de calidad (Todos/Aprobado/Rechazado), desde y hasta. Orden en servidor.
 Botón **«Nueva recepción»** → diálogo con: proveedor (carga `GET /catalogos/proveedores?tipo_proveedor=LECHERO&activo=true&size=100&sort=nombre,asc` mediante el repositorio de Catálogos ya existente o una lectura equivalente; **no** modifiques Catálogos), litros, temperatura, acidez y fecha (por defecto hoy en Colombia, `max` = hoy).
 - Muestra los **umbrales vigentes** (`GET /acopio/umbrales`): «Máximo 10 °C y 18 °Dornic» y, **mientras se escribe**, un aviso no bloqueante en tono de alerta si temperatura o acidez los superan («Esta entrega será RECHAZADA y no se pagará»). El servidor es quien decide.
 - Validación de forma: litros > 0 (hasta 2 decimales), temperatura de −5 a 60, acidez de 0 a 40; muestra `fields` del servidor junto a cada campo.
 - **Resultado:** la respuesta es `201` también cuando la leche se rechaza. Si `APROBADO`: toast de éxito. Si `RECHAZADO`: **no** un toast verde; muestra un aviso destacado (diálogo o toast de alerta) con el motivo y «La entrega quedó registrada como rechazada». En ambos casos recarga la lista.
 - Errores: `409`/`20004` (quincena cerrada → «La quincena de esa fecha está cerrada») y `409`/`20006` (proveedor inactivo o no lechero) con el mensaje del servidor.

**b) Calidad por proveedor** — `GET /acopio/calidad`: tabla con proveedor, entregas, temperatura y acidez promedio, rechazadas y **% de rechazo** (resalta con chip de alerta/peligro cuando supera, por ejemplo, 20 %; documenta el umbral como supuesto). Orden por defecto del servidor.

**c) Pago a lecheros** — `GET /acopio/pago-lecheros`: filtro por **quincena** (selector alimentado por `GET /periodos?size=50&sort=fecha_inicio,desc`, mostrando «Octubre · 1.ª quincena», con la actual preseleccionada vía `GET /periodos/actual`) y/o proveedor. Columnas: proveedor, litros a pagar, litros rechazados (con la nota «lo rechazado no se paga»). Una fila de **totales** de la página, calculada en el cliente, rotulada como tal.

## 2 · Producción (`/produccion`)

Ruta lazy `features/produccion/produccion.routes.ts`, título `Producción · SILA`, ítem «Producción» del mismo grupo. Dos pestañas:

**a) Lotes** — `GET /produccion/lotes`: tabla con código de lote, producto, fecha de producción, litros usados, cantidad obtenida (con la unidad), **rendimiento %**, costo total (`formatoCop`), costo unitario, vencimiento y **días restantes** con chip (`nivel_alerta`: VENCIDO → peligro, CRITICO → peligro, PROXIMO → alerta; `null` → sin chip). Filtros: texto (código o producto, con antirrebote), producto, desde y hasta. Orden en servidor.
 **«Nuevo lote»** → diálogo: producto (activos, de `GET /catalogos/productos?activo=true&size=100`), litros de leche usados, cantidad obtenida (muestra la unidad del producto elegido), **costo por litro** (COP), fecha de producción (hoy por defecto, `max` hoy) y fecha de vencimiento **opcional** (ayuda: «Si la dejas vacía: 21 días después de la producción»). Muestra en vivo, solo informativo: **costo total** = litros × costo por litro y **rendimiento** = cantidad ÷ litros. Respuesta `201` → toast con el **código del lote generado**. `400` con `fields.fecha_vencimiento` si es anterior a la producción.

**b) Ajustes de inventario** — `GET /produccion/ajustes`: tabla con fecha (UTC → Colombia), producto, tipo (chip: los que restan en alerta, los que suman en éxito), **cantidad con signo** (`cantidad_delta`: «−5» / «+2» con la unidad), observación y usuario. Filtros: producto, tipo, desde y hasta.
 **«Nuevo ajuste»** → diálogo: producto, **tipo** (agrupa y rotula: «Restan stock: Merma, Daño, Vencimiento, Muestra» y, solo para ADMIN, «Suman o corrigen: Ingreso inicial, Corrección (+), Corrección (−)»), **cantidad** (siempre positiva; explica «El tipo decide si suma o resta») y **observación** obligatoria (5 a 255 caracteres, con contador). Muestra el stock actual del producto elegido si ya lo tienes en memoria. Errores: `403`/`20008` (sin permiso para ese tipo) y `409`/`20002` («dejaría el stock negativo») con el mensaje del servidor.

## 3 · Inventario (`/inventario`)

Ruta lazy `features/inventario/inventario.routes.ts`, título `Inventario · SILA`, ítem «Inventario» del mismo grupo.

- **Tarjetas** (`GET /inventario/resumen`): total de productos, productos sin stock, **valor total del inventario** (`formatoCop`; rotúlalo «valor a precio de venta»).
- **Tabla de stock** (`GET /inventario`): SKU, producto, stock (con unidad), precio base, valor. Filtros: texto (nombre o SKU) y casilla «Solo con stock». Orden en servidor. Acción por fila **«Registrar ajuste»** que abre el mismo diálogo de ajuste de Producción con el producto ya elegido (reutiliza el componente; no lo dupliques).
- **Panel «Alertas de caducidad»** (`GET /inventario/alertas-caducidad`): lotes que vencen pronto o vencieron hace poco, con selector de ventana (próximos **7 / 15 / 30 días** → `dias_maximos`), chip de nivel y días restantes (negativos = «venció hace N días»). Nota visible: «El inventario es por producto, no por lote: la cantidad es lo producido en ese lote, no lo que queda sin vender.»

## Pruebas (Vitest) — pocas y útiles

Una por repositorio HTTP (`HttpTestingController`): método, URL, parámetros y cuerpo correctos, y que las escrituras llevan `Idempotency-Key`. Más, en componentes: (1) el selector de tipo de ajuste ofrece **4 tipos al OPERATIVO y 7 al ADMIN**; (2) una recepción `RECHAZADO` muestra el aviso de rechazo y **no** el de éxito; (3) el aviso de umbral aparece al superar temperatura/acidez; (4) el helper `hoyColombia()` devuelve la fecha de Bogotá (p. ej. a las 23:30 hora de Colombia, que ya es el día siguiente en UTC, sigue siendo el día de Colombia).

## Verificación (una sola vez)

1. `npx ng build` y `npx ng test` sin errores; `npm audit` en 0 (no agregues dependencias).
2. Prueba manual **una pasada** contra el backend real (modo jwt; suele estar corriendo en `:8080`, si no: `cd ~/sila-backend && ./arrancar.sh`; dashboard con `npm start`). Usuarios de prueba: `python3 ~/sila-backend/pruebas/crear_usuario_prueba.py ADMIN` y `OPERATIVO` (imprimen usuario y clave temporal; el ADMIN además configura el segundo factor: calcula los códigos con el comando de `docs/PROMPT_SEGURIDAD.md`). **No uses `kevin.mijares` ni las cuentas `prueba.*`**, y si tu navegador comparte cookies con una sesión abierta del dueño, usa un perfil o ventana aparte para no sacarlo de su sesión. Al terminar: `python3 ~/sila-backend/pruebas/crear_usuario_prueba.py --limpiar`.
3. **Los datos que registres no se pueden borrar** (recepciones, lotes y ajustes son de solo inserción) y alimentan reportes reales. Por eso: crea desde Catálogos **un proveedor lechero y un producto desechables** (nombre «PRUEBA …»), registra con ellos **una recepción aprobada, una rechazada, un lote con costo por litro 0 y un ajuste de merma**, comprueba que las tres pantallas reflejan el cambio (stock, resumen, alertas con ventana de 30 días) y **desactiva el proveedor y el producto** al terminar. No registres más de lo necesario.
4. Si algo del contrato no se comporta como dice, **detente y repórtalo**.

## Entrega

Resume brevemente: archivos creados y modificados, supuestos nuevos, resultado de `ng build` / `ng test` / `npm audit`, y qué comprobaste a mano y qué no.
