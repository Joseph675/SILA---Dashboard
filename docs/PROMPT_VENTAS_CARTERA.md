# Tarea: Punto de venta, Historial de ventas, Precios por cliente, Cartera y Parámetros

Trabajas en `~/Documentos/dashboard/dashboard-app` (Angular 22, standalone, signals, Tailwind 4, Vitest). SILA es el sistema de Llanolat, una empresa de lácteos en Colombia. Toda la interfaz va en **español de Colombia**.

**Alcance de la verificación:** construye, comprueba **una vez** que compila, que tus pruebas pasan y que las pantallas funcionan contra el backend real, y entrega. No hace falta repetir revisiones ni agotar casos límite: el dueño revisará después y, si quiere algo a fondo, lo pedirá.

## Contexto de negocio

Esto cierra el ciclo del dinero de SILA: **vender** (descuenta stock), **cobrar lo que se vendió a crédito** (cartera) y **ajustar las reglas del sistema** (parámetros). Cinco pantallas:

1. **Punto de venta** — registrar una venta (la pantalla más importante y más compleja).
2. **Historial de ventas** — consultar ventas, ver su detalle y, solo ADMIN, anularlas.
3. **Precios por cliente** (solo ADMIN) — acuerdos de precio con un cliente.
4. **Cartera** — qué deben los clientes, registrar abonos y, solo ADMIN, castigar cartera.
5. **Parámetros del sistema** (solo ADMIN) — plazo de crédito, umbrales de calidad, etc.

Dos reglas del negocio dominan el diseño del punto de venta:
- **Pago mixto:** una venta de contado puede pagarse con **varios medios** (efectivo + transferencia + tarjeta…).
- **Precio pactado:** hay un precio de lista, pero a algunos clientes se les vende a otro precio (un acuerdo, por ejemplo «+1.000 pesos»). El servidor aplica el precio pactado solo; el dashboard **lo muestra**, no lo calcula ni lo envía.

## Lee primero

1. `docs/CONTRATO_BACKEND.md`: secciones **«Ventas»** (con «Precios pactados por cliente»), **«Cartera»**, **«Parámetros del sistema»**, **«Idempotency-Key»**, **«Convenciones»** y la tabla de **errores**. Es la única fuente de verdad; el backend ya está implementado y probado. **No lo modifiques**; si el contrato y la realidad no coinciden, detente y repórtalo.
2. Las pantallas ya construidas como plantilla: `features/periodos/*`, `features/usuarios/*`, `features/auditoria/*`, y las de Acopio/Producción/Inventario si ya existen (`features/acopio`, `features/produccion`, `features/inventario`): repositorio abstracto + token + HTTP, `crearListado`, `app-server-data-table`, diálogos, toasts, chips, helpers `hoyColombia()`, `nuevaClaveIdempotencia()`, `formatoCop`, `formatoFechaHora`.
3. `docs/SUPUESTOS.md` (formato; comentarios `// SUPUESTO:`).

## Reglas que ya rigen (no las rompas)

- Datos por **repositorio** (clase abstracta + `InjectionToken` + implementación HTTP) registrado en `core/data/data-providers.ts`. Componentes `standalone`, `OnPush`, signals, control flow, `inject()`. Reutiliza `shared/ui/*`; sin librerías nuevas.
- **`Idempotency-Key` obligatoria** en: registrar venta, anular venta, registrar abono y registrar castigo (sin ella el servidor responde `400`). **Una clave nueva por cada acción del usuario**; se reutiliza solo para reintentar esa misma acción (fallo de red o doble clic). En el punto de venta, la clave se crea **al pulsar «Cobrar» con la venta armada** y se conserva hasta que la venta se confirme o se cambie su contenido. `422`/`20017` → clave nueva y aviso; `409`/`20016` → «hay otra solicitud igual en proceso, espera un momento».
- **El servidor es la autoridad de los números.** Para mostrar totales mientras se arma la venta, calcula en el cliente con la misma regla (por línea: `subtotal = round(cantidad × precio, 2)`, `IVA = round(subtotal × tarifa / 100, 2)`; total = suma), pero **al confirmar muestra lo que devuelve el servidor**. Nunca envíes precios, IVA ni totales: solo `id_producto` y `cantidad`, y los pagos.
- **Fechas:** «hoy» es el día en Colombia (`hoyColombia()`); `fecha_venta` ya viene en hora de Colombia; `fecha_registro` y similares, en UTC sin zona (`formatoFechaHora`). Dinero con `formatoCop` (hay valores con decimales, p. ej. `23,80`); cantidades con `formatoNumero`.
- **Roles:** todos los usuarios autenticados venden, ven historial y cartera y registran abonos. **Solo ADMIN**: anular ventas, castigar cartera, fijar/desactivar precios por cliente y cambiar parámetros (ocúltalo con `appHasRole`/`hasRole` y protege las rutas con `roleGuard('ADMIN')`, pero **el servidor decide**: muestra el `403`/`20008` si ocurre). `GET` de precios pactados y de parámetros es para todos.
- Textos es-CO; accesibilidad (labels, foco, estados con ícono + texto, nunca solo color); no registres datos en consola ni en almacenamiento persistente (ni el carrito: se pierde al recargar, y está bien).
- Cada decisión tuya que no esté aquí ni en el contrato: `// SUPUESTO: …` y una fila en una nueva sección **«Ventas y cartera»** de `docs/SUPUESTOS.md` (ids `VC-01`, `VC-02`…).
- No modifiques el backend ni Catálogos, salvo lo descrito en la parte 6.

## 1 · Punto de venta (`/ventas/nueva`)

Ítem **«Punto de venta»** del grupo «Ventas y cobros» (`route: '/ventas/nueva'`), título `Punto de venta · SILA`. Diseño en dos zonas (en móvil, una bajo la otra):

**Zona izquierda — productos.** Buscador con antirrebote (nombre o SKU) sobre `GET /ventas/precios?id_cliente=<cliente elegido>&texto=…&size=…` y casilla «Solo con stock». Cada producto muestra nombre, SKU, **stock con unidad**, **precio aplicable** y, si hay acuerdo (`precio_pactado` no nulo), una etiqueta **«Precio pactado»** con la diferencia frente al de lista (`+ $2.000 sobre el de lista`; negativa = descuento). Productos sin stock: visibles pero deshabilitados con el texto «Sin stock». Clic o `Enter` agrega 1 al ticket (si ya está, suma 1). Si la búsqueda coincide **exactamente** con un SKU y se pulsa `Enter`, lo agrega directo (para lector de código de barras).

**Zona derecha — ticket.**
1. **Cliente.** Selector con búsqueda (`GET /catalogos/clientes?texto=…&activo=true`). **Por defecto «CONSUMIDOR FINAL»** (documento `222222222222`; búscalo al abrir la pantalla). Al cambiar de cliente, **vuelve a consultar los precios** de las líneas del ticket (el precio puede cambiar) y avisa si alguno cambió. Muestra del cliente elegido su **cupo disponible y su deuda** (`limite_credito`, `saldo_deudor` del catálogo).
2. **Tipo de venta:** `CONTADO` / `CRÉDITO`. **Crédito se deshabilita** si el cliente es CONSUMIDOR FINAL o no tiene cupo (`limite_credito` = 0), explicando por qué. En crédito, muestra el aviso «Quedará como deuda del cliente. Vence en N días» (N = parámetro `PLAZO_CREDITO_DIAS` de `GET /parametros`) y, si el total supera el cupo disponible, un aviso de alerta (no bloqueante: el servidor decide).
3. **Líneas:** nombre, cantidad (editable, hasta 2 decimales, > 0; aviso si supera el stock), precio unitario (con la etiqueta «pactado» si aplica), subtotal, IVA de la línea y botón quitar. Debajo: **subtotal, IVA y TOTAL** en grande.
4. **Pagos (solo CONTADO)** — el corazón del pago mixto:
   - Filas de pago: **medio** (Efectivo, Transferencia, Tarjeta, Cheque, Otro), **monto** y **referencia** (opcional; se pide visible para transferencia, tarjeta y cheque). Botón **«Agregar otro medio»** (máximo 6 filas) y quitar fila.
   - Indicador permanente: **«Pagado X de Y — Falta Z»** (o «Completo»). Atajo **«Completar con este medio»** que pone en la fila el monto que falta. Atajo **«Todo en efectivo»**.
   - **Calculadora de cambio** (opcional): campo «Recibido en efectivo»; muestra **«Cambio: $…»** cuando el efectivo recibido supera el monto en efectivo de la venta. **El cambio nunca se envía ni se guarda**: en `pagos` va solo el monto aplicado.
   - Validación local: la suma de los pagos debe ser **exactamente** el total; si no, «Cobrar» queda deshabilitado con el motivo. Si el total cambia (se edita una línea), los montos de pago se conservan y el indicador «Falta/Sobra» se actualiza.
5. **Botón «Cobrar»** (contado) / **«Registrar crédito»**. Mientras envía: deshabilitado y «Procesando…» (evita doble clic). **Éxito `201`:** panel de confirmación con el número de venta, fecha, cliente, líneas, **total que devolvió el servidor**, pagos, y (crédito) vencimiento y saldo; botones **«Nueva venta»** (limpia todo y deja el foco en el buscador), **«Imprimir ticket»** (usa `window.print()` con una hoja de estilo `@media print` que muestre solo el ticket, patrón ya usado para los códigos de respaldo) y «Ver en el historial».
6. **Errores del servidor** (muestra su mensaje y NO borres el ticket): `409`/`20002` stock insuficiente (recarga los productos para actualizar el stock), `409`/`20003` cupo de crédito, `409`/`20004` quincena cerrada, `409`/`20006` cliente o producto inactivo, `400`/`20001` con `fields` (p. ej. `pagos`), `404` producto inexistente.

## 2 · Historial de ventas (`/ventas`)

Ítem «Historial de ventas», título `Historial de ventas · SILA`. `GET /ventas`: tabla con N.º, fecha, cliente, tipo, total, saldo pendiente y **estado** (`app-status-chip`: PAGADA → éxito, PENDIENTE → alerta, ANULADA → peligro, CASTIGADA → castigado). Filtros: texto (cliente o documento), estado, tipo (contado/crédito), desde y hasta. Orden y paginación en servidor.
**Detalle** (clic en una fila → diálogo o panel lateral, `GET /ventas/{id}`): cabecera, **líneas** (con marca «Precio pactado» y, al pasar el cursor o en una segunda línea, «Lista: $…»), **pagos** (uno por medio, con referencia) y, si está anulada, el motivo. Botón **«Anular venta»** (solo ADMIN, solo si el estado es PAGADA o PENDIENTE): diálogo de confirmación con **motivo obligatorio de 10 a 255 caracteres** (`app-confirm-dialog` con `motivo`), `Idempotency-Key`, y al terminar toast + recarga. Si el servidor responde que no se puede (tiene abonos o una factura enviada a la DIAN), muestra su mensaje tal cual.

## 3 · Precios por cliente (`/precios-cliente`, solo ADMIN)

Ítem «Precios por cliente» (grupo «Ventas y cobros», `rol: 'ADMIN'`), título `Precios por cliente · SILA`. Selector de cliente con búsqueda; al elegirlo, `GET /precios-cliente?id_cliente=…` (por defecto solo activos; casilla «Ver también los desactivados»): producto, **precio de lista**, **precio pactado**, **diferencia** (con signo y tono: sube/baja) y estado. **«Nuevo acuerdo»** → producto (activos) + precio; muestra al lado el precio de lista y la diferencia que resulta, y un atajo «Lista + $… » para calcularlo. Editar el precio (mismo `PUT`) y **desactivar** (confirmación; `PATCH …/estado` con `activo: false`). Texto de ayuda: «Si el precio de lista cambia después, este precio no se mueve hasta que lo renegocies.» Cada cambio queda en la auditoría (no hace falta mostrarlo aquí).

## 4 · Cartera (`/cartera`)

Ítem «Cartera», título `Cartera · SILA`. Dos pestañas.

**a) Clientes con deuda** — tarjetas de `GET /cartera/resumen` (total por cobrar, clientes con deuda, clientes en mora, **cartera vencida**) y la tabla de `GET /cartera/clientes` (por defecto `solo_con_deuda=true`): cliente, teléfono, límite, deuda, cupo disponible, **días de mora** y **estado de crédito** (chip: AL_DIA → éxito, VIGENTE → info, EN_MORA → peligro, EXCEDIDO → peligro). Filtros: texto, estado, mora mínima y «Solo con deuda». Acciones por fila:
- **«Registrar abono»** → diálogo: muestra la **deuda total** y la lista de **ventas pendientes** (`GET /cartera/clientes/{id}/ventas-pendientes`, de la más antigua a la más nueva) con la nota «El pago se aplica primero a la venta más antigua». Campos: monto (máximo = deuda), medio, referencia. **Vista previa del reparto** calculada en el cliente (cuánto cubre de cada venta) y, al confirmar, **el recibo que devuelve el servidor** (número de recibo, cómo se repartió, **saldo restante**), con «Imprimir recibo». **Pago mixto:** permite agregar varias filas (medio + monto); como cada abono admite un solo medio, se envía **una solicitud por fila, en secuencia, cada una con su propia `Idempotency-Key`**, y se muestran los recibos resultantes; si una falla, detén las siguientes y muestra claramente **qué se alcanzó a registrar y qué no**. El total de las filas no puede exceder la deuda (el servidor responde `400`/`20005`).
- **«Ver ventas»** (las pendientes) y **«Historial de abonos»** del cliente (salta a la pestaña b con el filtro puesto).
- **«Castigar cartera»** (solo ADMIN): acción **irreversible** que da de baja toda la deuda del cliente como incobrable. Confirmación fuerte: muestra la **deuda que se castigará**, pide un **motivo (10 a 255 caracteres)** y exige escribir el nombre del cliente o marcar una casilla de confirmación; `Idempotency-Key`; al terminar muestra el `monto_castigado`.

**b) Abonos** — `GET /cartera/abonos`: recibo, fecha, cliente, venta, monto, medio, referencia, usuario. Filtros: cliente, medio, recibo, desde, hasta. Una fila por abono aplicado (un pago puede repartirse en varias ventas y compartir recibo: agrupa visualmente o resalta el recibo).

## 5 · Parámetros del sistema (`/parametros`, solo ADMIN)

Ítem «Parámetros» del grupo «Administración» (`rol: 'ADMIN'`), título `Parámetros · SILA`. `GET /parametros`: tabla con **nombre legible** (traduce las claves del contrato: p. ej. `PLAZO_CREDITO_DIAS` → «Plazo de crédito (días)»; si llega una clave desconocida, muestra la `descripcion` del servidor), **valor actual**, **rango permitido**, y la descripción. Cada fila se edita en línea (campo numérico con `min`/`max` del servidor) con **Guardar** por fila (`PUT /parametros/{clave}`, sin `Idempotency-Key`): confirma con un diálogo que diga el valor anterior y el nuevo, y que **rige desde la siguiente operación, sin alterar lo ya registrado**. Valida el rango en el cliente y muestra el mensaje del servidor (`400`) si lo rechaza. Agrupa visualmente por tema (Crédito y ventas · Calidad de la leche · Producción · Seguridad de acceso). Aviso destacado sobre los de seguridad (`LOGIN_MAX_INTENTOS`, `LOGIN_BLOQUEO_MINUTOS`, `SESION_MAX_HORAS`): «Afectan a todos los usuarios».

## 6 · Detalle menor en Catálogos (permitido)

En el formulario de **producto nuevo**, el IVA inicial debe ser el parámetro `IVA_DEFECTO_PORCENTAJE` (`GET /parametros`; si falla, 19). Es solo el valor propuesto: se puede cambiar. Cambia únicamente eso en Catálogos.

## Pruebas (Vitest) — pocas y útiles

Una por repositorio HTTP (método, URL, parámetros y cuerpo; que las escrituras lleven `Idempotency-Key` y que **el cuerpo de una venta no incluya precios ni totales**). Más, en componentes: (1) el ticket calcula subtotal, IVA y total con el redondeo por línea (p. ej. 2 × 10 con IVA 19 % = 23,80) y «Cobrar» solo se habilita cuando los pagos suman exactamente el total; (2) el pago mixto: «Falta/Sobra» se actualiza, y el cambio de efectivo **no** entra en el cuerpo enviado; (3) crédito deshabilitado para CONSUMIDOR FINAL; (4) «Anular» y «Castigar» solo aparecen a ADMIN; (5) el abono mixto envía una solicitud por fila con claves distintas y se detiene ante el primer error.

## Verificación (una sola vez)

1. `npx ng build` y `npx ng test` sin errores; `npm audit` en 0 (no agregues dependencias).
2. Prueba manual **una pasada** contra el backend real (modo jwt; suele estar en `:8080`, si no: `cd ~/sila-backend && ./arrancar.sh`; dashboard con `npm start`). Usuarios de prueba: `python3 ~/sila-backend/pruebas/crear_usuario_prueba.py ADMIN` y `OPERATIVO` (el ADMIN configura además el segundo factor; calcula los códigos con el comando de `docs/PROMPT_SEGURIDAD.md`). **No uses `kevin.mijares` ni las cuentas `prueba.*`**; si tu navegador comparte cookies con una sesión abierta del dueño, usa un perfil o ventana aparte. Al terminar: `… crear_usuario_prueba.py --limpiar`.
3. **Las ventas y los abonos NO se pueden borrar y alimentan los reportes reales** (ingresos de la quincena). Por eso: desde Catálogos crea **un cliente y un producto desechables** (nombre «PRUEBA …», producto con precio de pocos pesos; dale stock con un ajuste `INGRESO_INICIAL` de ADMIN en Producción y un cupo de crédito de 1.000 al cliente como ADMIN), y haz **solo**: una venta de contado a CONSUMIDOR FINAL con **dos medios de pago** (y luego **anúlala**), un precio pactado para el cliente desechable, una venta a crédito a ese cliente con el precio pactado y un **abono** que la salde. Cambia un parámetro (p. ej. el plazo de crédito) y **déjalo como estaba**. **No ejecutes un castigo real**: verifica el diálogo y cancela. Al terminar, desactiva el cliente, el producto y el precio de prueba.
4. Si algo del contrato no se comporta como dice, **detente y repórtalo**.

## Entrega

Resume brevemente: archivos creados y modificados, supuestos nuevos, resultado de `ng build` / `ng test` / `npm audit`, y qué comprobaste a mano y qué no.
