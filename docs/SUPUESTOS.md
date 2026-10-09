# Supuestos

Decisiones tomadas donde `prompt.md` no fija la regla. En el código cada una lleva un comentario `// SUPUESTO:`.

## Generales

| # | Supuesto | Dónde |
|---|---|---|
| G-01 | Se conserva el kit de UI propio (Tailwind + `shared/ui`) en lugar de agregar Angular Material: el proyecto ya tiene una librería de UI coherente. | Todo el proyecto |
| G-02 | `Page<T>.page` empieza en 0 (convención de Spring Data). `sort` va como `campo,asc` o `campo,desc` con el nombre de la columna. | `core/api/page.models.ts` |
| G-03 | Desarrollo y producción usan la misma capa de datos (`core/data/data-providers.ts`, todo HTTP): ya no hay selector de rol ni cabeceras `X-Usuario` / `X-Rol`. `ng serve` envía `/api` al backend con `proxy.conf.json`, igual que lo hará el servidor web en producción. | `angular.json`, `proxy.conf.json`, `core/data/` |
| G-04 | Los códigos 20006 y 20010 significan cosas distintas según el procedimiento, así que para ellos se muestra el mensaje del servidor y no un texto fijo. | `core/api/api-error.ts` |

## Catálogos

| # | Supuesto | Dónde |
|---|---|---|
| C-01 | Las claves se llaman `id_cliente`, `id_proveedor` e `id_producto`, y el estado es un booleano `activo`. El documento no las nombra. | `catalogos.models.ts` |
| C-02 | Cliente: teléfono y dirección son opcionales; dirección máx. 200. Correo obligatorio (hace falta para la factura electrónica). | `cliente-form-dialog.component.ts` |
| C-03 | Formato de teléfono: 7 a 20 caracteres entre dígitos, espacios, `+`, guion y paréntesis. | `sila-validators.ts` |
| C-04 | Cliente nuevo creado por OPERATIVO: el límite de crédito no se envía y el servidor lo deja en 0. | `cliente-form-dialog.component.ts` |
| C-05 | Proveedor: nombre máx. 120 (igual que cliente) y teléfono opcional. | `proveedor-form-dialog.component.ts` |
| C-06 | Activar/desactivar proveedores es solo ADMIN, igual que en clientes. | `proveedores-tab.component.html` |
| C-07 | Producto: OPERATIVO puede editar nombre y unidad de medida. `precio_base` y `tarifa_iva` cambian juntos en la acción "Cambiar precio" [ADMIN]. | `catalogos.models.ts`, `producto-form-dialog.component.ts` |
| C-09 | Al editar un cliente o proveedor, el documento (y el tipo de proveedor) quedan bloqueados: el backend los ignora porque son la identidad del registro. | formularios de edición |
| C-10 | El documento y el correo de clientes y proveedores se muestran completos en la tabla, por decisión del dueño del sistema (el prompt pedía enmascararlos parcialmente por la Ley 1581). | `clientes-tab`, `proveedores-tab` |
| C-11 | La tabla de clientes muestra también `direccion` (sin orden: el backend no la acepta como campo de orden) y `saldo_deudor`, que llegan de `vw_clientes`. | `clientes-tab` |

## Períodos

| # | Supuesto | Dónde |
|---|---|---|
| P-01 | Año inicial de la lista: el de la quincena actual si existe; si no, el último año con quincenas. Sin años, no hay selector. | `periodos-page.component.ts` |
| P-02 | Año sugerido al crear: el último año existente + 1 (sin pasar de 2100), o el año actual si no hay ninguno. | `periodos-page.component.ts` |
| P-03 | El aviso «ya existían» usa el toast de éxito: no existe un toast informativo. Con `creados = 0` no se cambia el año seleccionado; con `creados > 0` sí. | `periodos-page.component.ts` |
| P-04 | `roleGuard` redirige a la raíz (`/` → Catálogos) cuando falta el rol, en vez de bloquear sin más y dejar la pantalla en blanco. No existe aún una página «sin permiso» (20008). | `core/auth/role.guard.ts` |
| P-05 | Chip de la barra superior: sin quincena para hoy (20007), solo un ADMIN ve «Sin quincena» (con enlace a `/periodos`); un OPERATIVO no ve nada. Cualquier otro fallo del API tampoco muestra nada. | `layout/header/quincena-chip.component.ts` |
| P-06 | El chip consulta la quincena actual una sola vez al cargar la barra; no se actualiza si se cierra o reabre la quincena en la pantalla de Períodos hasta recargar la página. | `quincena-chip.component.ts` |
| P-07 | La tabla pide `size=50` para que un año (24 filas) quepa en una página; el selector de filas conserva 10 / 20 / 50. `crearListado` ganó `tamanoInicial` y `habilitado` (retrocompatibles). | `shared/utils/listado.ts` |
| P-08 | «Cerrar» usa el diálogo de confirmación con el botón en tono de peligro y sin motivo; «Reabrir» lo usa con motivo de 10 a 200 caracteres. | `periodos-page.component.html` |
| P-09 | La columna «Quincena» ordena por `fecha_inicio` (orden cronológico); «Fechas» no es ordenable. Ingresos, costo, gastos y cartera tampoco, porque el API solo ordena por `resultado_estimado`. | `periodos-page.component.ts` |
| P-10 | El prompt de Períodos nombra la directiva `appHasRole`; la que existe en el proyecto es `*hasRole`, y es la que se usa. | `periodos-page.component.html` |
| P-11 | `body { overflow-x: clip }` global: el panel del personalizador de tema (fuera de pantalla) ensanchaba toda la aplicación y la página se desplazaba de lado en móvil y tablet. Las tablas siguen desplazándose dentro de su contenedor. | `src/styles.css` |

## Autenticación y usuarios

| # | Supuesto | Dónde |
|---|---|---|
| A-01 | Un token temporal vencido y un código o clave equivocados llegan igual (`401` / `20013`); solo cambia el texto. El login lo distingue por el mensaje («Sesion no valida o vencida…») y, solo entonces, vuelve al paso 1 con un aviso. Si el backend cambia ese texto, un token vencido se mostraría como un error más. | `core/api/api-error.ts` (`esSesionVencida`) |
| A-02 | La URL de retorno solo se acepta si empieza por `/` y no contiene `//` al inicio, `\`, `:` ni caracteres de control, y no es `/login`. Por eso una ruta con `:` en la consulta (`/x?a=b:c`) se descarta y se va al inicio. | `core/auth/url-retorno.ts` |
| A-03 | El login de otra pantalla puede mostrar un aviso con `?aviso=<clave>`, pero solo claves fijas (hoy `clave-cambiada`): nunca se pinta texto que venga de la URL. | `login-page.component.ts` |
| A-04 | El usuario se recorta y pasa a minúscula al enviarlo; si trae espacios dentro, se rechaza en el formulario. | `login-page.component.ts` |
| A-05 | Al cambiar la clave desde «Mi cuenta» el API cierra todas las sesiones, así que se va a `/login` con el aviso de clave cambiada (sin confirmación previa). | `cuenta-page.component.ts` |
| A-06 | El botón «Restablecer segundo factor» solo aparece si la persona tiene el segundo factor activo; no hay nada que restablecer si no. | `usuarios-page.component.html` |
| A-07 | Las acciones de cada fila de Usuarios son botones de solo ícono (con `title` y texto para lectores de pantalla): con texto, la columna no cabía. | `usuarios-page.component.html` |
| A-08 | Usuario nuevo: rol inicial OPERATIVO; nombre de 3 a 120 caracteres y correo de hasta 150 (las mismas validaciones de forma del API). Un usuario no se puede renombrar al editarlo. | `usuario-form-dialog.component.ts` |
| A-09 | El QR se dibuja en el navegador con `qrcode` 1.5.4 (cargado solo al llegar a ese paso). Si fallara, se avisa y se deja abierta la clave para escribirla a mano. | `mfa-enrolar.component.ts` |
| A-10 | El código del segundo factor se envía solo al escribir el sexto dígito; tras un error se vacía el campo y el cursor vuelve a él. | `mfa-codigo-form.component.ts` |
| A-11 | Al arrancar, la app espera una sola llamada a `/auth/refresh` antes de pintar. Sin cookie válida (o con el backend caído) sigue y el guard manda a `/login`. | `app.config.ts` |
| A-12 | Cerrar sesión no pide confirmación y siempre termina en `/login`, aunque la llamada al API falle. | `user-menu.component.ts` |
| A-13 | `AuthService.sesion` sigue siendo un signal escribible (como antes) para que las pruebas fijen una sesión; en el código de la app solo lo escribe `AuthService`. | `core/services/auth.service.ts` |
| A-14 | En «Mi cuenta», quien ya tiene segundo factor no ve cómo desactivarlo: el contrato no tiene esa operación (solo un ADMIN lo restablece). | `cuenta-page.component.ts` |
| A-15 | El diálogo de clave temporal usa la nueva opción `cerrable = false` de `app-dialog`: sin X, sin cierre por Escape ni por clic en el fondo. | `shared/ui/dialog/dialog.component.ts` |
| A-16 | Los códigos de respaldo solo viven en las entradas del componente que los muestra (memoria): no van a almacenamiento, URL ni registros, y se descartan al continuar. Mientras están a la vista, recargar o cerrar la pestaña pide confirmación (`beforeunload`), porque se perderían; si pasa, se generan nuevos en «Mi cuenta». | `codigos-respaldo.component.ts` |
| A-17 | Al activar el segundo factor en el login, el servidor ya abrió la sesión (cookie y token en memoria); el panel espera a que se confirmen los códigos y solo entonces navega. En esa pantalla no hay «Volver». | `login-page.component.ts` |
| A-18 | El archivo descargado se llama `sila-codigos-respaldo-<usuario>-<AAAA-MM-DD>.txt` (fecha de Colombia) y lleva el encabezado «SILA · Llanolat — códigos de respaldo», el usuario y la fecha; nunca la clave. El nombre del usuario se limpia a `[a-z0-9_.@-]`. | `codigos-respaldo.component.ts` |
| A-19 | Imprimir pone la clase `imprimiendo-codigos` en `<body>` y una regla `@media print` oculta todo menos el bloque de códigos; se quita con `afterprint`. | `codigos-respaldo.component.ts`, `styles.css` |
| A-20 | El aviso de pocos códigos (≤ 2; crítico en 0) solo aparece tras entrar con un código de respaldo, que es el único momento en que el API entrega `codigos_restantes`. Se puede descartar. En «Mi cuenta» el contador real se consulta siempre (`GET /auth/mfa/respaldo`). | `aviso-respaldo.component.ts` |
| A-21 | `evento` del filtro de accesos acepta **un solo valor** (probado: con coma devuelve 0 filas), así que «Fallos de las últimas 24 h» son dos atajos (clave y segundo factor), y «de hoy» es el día UTC de hoy (el filtro trabaja en días UTC), no 24 horas móviles. | `accesos-tab.component.ts` |
| A-22 | Eventos de riesgo en Accesos: `CUENTA_BLOQUEADA`, `USUARIO_DESCONOCIDO`, `REFRESH_REUSO` y `LIMITE_FRECUENCIA` en tono de peligro; `LOGIN_FALLIDO` y `MFA_FALLIDO` en alerta; el resto neutro. Un evento que el panel no conoce se muestra con su código y sin énfasis. | `models/eventos-acceso.ts` |
| A-23 | En Errores la columna «#» es `id_log` (la referencia de soporte) y se explica en pantalla; no hay buscador por referencia (el API no lo tiene). El filtro de código acepta enteros, también negativos (`-1`); lo demás se ignora. | `errores-tab.component.ts` |
| A-24 | La renovación se serializa entre pestañas con Web Locks (`sila-refresh`). **No** se comparte el token de acceso por el canal (solo viaja en la memoria de cada pestaña), así que no hay «volver a comprobar si otra pestaña ya renovó»: cada pestaña renueva con la cookie vigente cuando le toca. Con este backend dos renovaciones casi simultáneas no provocaron revocación ni con candado ni sin él, así que no se pudo demostrar la diferencia; sí se verificó que el candado serializa (la entrada de una pestaña coincide con la salida de la otra) y que sin `navigator.locks` cae al comportamiento anterior. | `auth.service.ts` |
| A-25 | Inactividad: se mide con marcas de tiempo (`Date.now()`) revisadas cada segundo y al volver a ser visible la pestaña. Cuentan `mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll` y `wheel`. Con el aviso abierto solo cuenta su botón «Seguir conectado». La actividad se comparte con las demás pestañas (un número por `BroadcastChannel`, como máximo cada 5 s). Corre mientras la zona con sesión (el shell) está abierta. | `core/session/inactividad.service.ts` |
| A-26 | El aviso «Tu sesión se cerró…» sale una sola vez: solo la primera llamada que falla con sesión abierta la limpia y navega; se pasa por `?aviso=<clave fija>` y la pantalla de login lo quita de la URL al leerlo. | `error.interceptor.ts`, `login-page.component.ts` |
| A-27 | Cerrar sesión (o «Cerrar todas», o por inactividad) avisa a las demás pestañas con un mensaje sin datos sensibles; estas solo limpian su memoria y van al login (no vuelven a llamar al API). | `canal-sesion.service.ts`, `sincronizacion-pestanas.service.ts` |
| A-28 | «Cerrar sus sesiones» (ADMIN) también se permite sobre la propia cuenta (el contrato lo permite); la confirmación avisa que cierra también la sesión actual. «Ver sesiones» es solo lectura. | `usuarios-page.component.ts` |
| A-29 | El dispositivo se describe con unos pocos patrones del `User-Agent` («Chrome en Windows»); si no se reconoce el navegador, «Dispositivo desconocido». No es un analizador completo. | `shared/utils/dispositivo.ts` |
| A-30 | CSP: se desactivó el CSS crítico en línea del build de producción (`inlineCritical: false`) para poder usar `script-src 'self'` sin concesiones; `style-src` conserva `'unsafe-inline'` por los estilos de componentes de Angular. Detalle y pruebas en `docs/CSP.md`. | `angular.json`, `docs/CSP.md` |
| A-31 | `qrcode` (CommonJS) se declara en `allowedCommonJsDependencies` y se importa aceptando sus funciones tanto por nombre como bajo `default`, porque el build de producción solo las expone bajo `default`. | `mfa-enrolar.component.ts`, `angular.json` |

## Acopio y producción

| ID | Supuesto | Dónde |
|---|---|---|
| AP-01 | «Hoy» es el día calendario de Colombia (`America/Bogota`, UTC−5, sin horario de verano), no el del navegador ni el de UTC: a las 23:30 en Colombia ya es «mañana» en UTC pero sigue siendo hoy. Es el valor inicial y el `max` de las fechas de recepción y de producción. Los filtros `desde`/`hasta` de **Ajustes** son días **UTC** (así los define el API) y la pantalla lo avisa. | `shared/utils/fecha-co.ts`, `ajustes-tab.component.ts` |
| AP-02 | Los selectores de proveedor lechero y de producto piden la primera página de 100 (el máximo del API) de activos ordenados por nombre. Si algún día hay más de 100, los sobrantes no aparecerían en el selector. | `proveedores-lecheros.ts`, `productos-activos.ts` |
| AP-03 | Idempotency-Key: una clave nueva por acción del usuario (se descarta al abrir el diálogo y al tener éxito). Se **reutiliza** solo al reintentar los **mismos datos** tras un fallo sin respuesta útil (sin conexión), un 5xx (`20999`) o un `20016`. Tras un error de validación (4xx) se genera una nueva, porque el servidor no guarda las respuestas de error y no hay nada que repetir. Ante `20017` se descarta la clave y se avisa. | `core/api/idempotencia.ts` |
| AP-04 | Una recepción **rechazada** (respuesta `201`) se comunica con un diálogo de alerta propio («La entrega quedó registrada como rechazada» + motivo), nunca con el aviso verde de éxito. El aviso en vivo del formulario es informativo (no bloquea) y se activa cuando temperatura o acidez **superan** el umbral (`>`); el servidor decide. | `recepciones-tab.component.ts`, `recepcion-dialog.component.ts` |
| AP-05 | El API entrega `porcentaje_rechazo` pero no un veredicto. El chip es: más de **20 %** → peligro, más de **10 %** → alerta, el resto → éxito. Los umbrales son nuestros y se muestran en pantalla. | `calidad-tab.component.ts` |
| AP-06 | Pago a lecheros: la quincena **actual** (`/periodos/actual`) viene preseleccionada; si hoy no tiene quincena, se muestran todas. El API no define `sort` para este listado, por eso las columnas no se ordenan. La línea de totales se **calcula en pantalla** sobre las filas de la página visible (no es un total del servidor) y lo dice. | `pago-tab.component.ts` |
| AP-07 | Días restantes de un lote: `VENCIDO`/`CRITICO` → chip de peligro, `PROXIMO` → alerta, sin nivel → solo el número. Un número negativo se escribe «Venció hace N días». | `caducidad.format.ts` |
| AP-08 | En el formulario de lote, costo total = litros × costo por litro, rendimiento = cantidad ÷ litros × 100 (como en el ejemplo del contrato: 50 L → 40 kg = 80 %) y costo unitario = costo total ÷ cantidad. Son estimaciones informativas; los valores definitivos los calcula el servidor. | `lote-dialog.component.ts` |
| AP-09 | Los tipos de ajuste que solo puede registrar un ADMIN (`INGRESO_INICIAL`, `CORRECCION_MAS`, `CORRECCION_MENOS`) se ofrecen únicamente a un ADMIN; un OPERATIVO ve los 4 que restan. Ocultarlos no es seguridad: el servidor responde `403` / `20008` igual. En la tabla, el chip es «alerta» si el ajuste resta y «éxito» si suma (según el signo de `cantidad_delta`). | `ajuste-dialog.component.ts`, `ajustes-tab.component.ts` |
| AP-10 | Solo se ofrece ordenar por los campos que el contrato lista. Donde el contrato no lista los permitidos (alertas de caducidad, pago a lecheros) se ordena por el valor por defecto o no se ordena, para no provocar un `400`. | `inventario-page.component.ts`, `calidad-tab.component.ts`, `pago-tab.component.ts` |
| AP-11 | Alertas de caducidad: el selector 7 / 15 / 30 días se envía como `dias_maximos`. `dias_vencidos` no se envía (el servidor usa 30: los vencidos hace más tiempo no aparecen). La cantidad es lo **producido** en el lote, no lo que queda sin vender, porque el stock es por producto. | `inventario-page.component.ts` |
| AP-12 | «Valor total» del inventario es **a precio de venta** (no a costo), tal como lo calcula el API; la tarjeta lo dice. El stock que muestra el diálogo de ajuste sale de la lista que ya está en memoria (catálogo o fila de inventario); se recarga tras registrar un ajuste. | `inventario-page.component.ts`, `ajuste-dialog.component.ts` |

## Ventas y cartera

| ID | Supuesto | Dónde |
|---|---|---|
| VC-01 | El ticket (líneas, pagos, cliente) vive solo en memoria: recargar la página lo pierde. No se guarda nada en almacenamiento del navegador. | `punto-venta-page.component.ts` |
| VC-02 | El selector de cliente busca en el servidor por nombre o documento, solo clientes activos, y lista las primeras 20 coincidencias: hay que escribir para afinar. | `shared/ui/cliente-selector` |
| VC-03 | La grilla del punto de venta muestra las primeras 30 coincidencias (con el total y un aviso si hay más). `Enter` con un SKU exacto consulta al servidor y agrega el producto, para que un lector de código de barras no dependa del antirrebote. | `punto-venta-page.component.ts` |
| VC-04 | Al cambiar de cliente se piden de nuevo los precios (hasta 100 productos) para las líneas del ticket y se avisa cuáles cambiaron. Si la consulta falla, se avisa que se revise el ticket antes de cobrar. El servidor es quien fija el precio al registrar. | `punto-venta-page.component.ts` |
| VC-05 | El crédito se deshabilita si el cliente es CONSUMIDOR FINAL (documento `222222222222`) o su límite es 0, y dice por qué; si la selección deja de permitirlo, la venta vuelve a contado. Que el total supere el cupo es solo un aviso: el servidor decide (`20003`). | `punto-venta-page.component.ts` |
| VC-06 | Pagos: de 1 a 6 filas; la referencia se muestra para transferencia, tarjeta y cheque (siempre opcional). Los montos aceptan coma o punto, hasta 2 decimales. «Cobrar» exige que la suma sea exactamente el total. El cambio se calcula en pantalla (efectivo recibido − efectivo aplicado) y nunca se envía. | `ticket.calculos.ts` |
| VC-07 | Cada acción usa una `Idempotency-Key` nueva; se reutiliza solo para reintentar los mismos datos tras un fallo de red, un 5xx o un `20016` (ver AP-03). En la venta, la clave se pide al pulsar «Cobrar» con el ticket armado; al cambiar el contenido del ticket la clave cambia. | `core/api/idempotencia.ts` |
| VC-08 | Para `20001`, `20002`, `20003`, `20005`, `20006` y `20007` se muestra el mensaje del servidor tal cual (trae el stock disponible, el cupo, lo que suman los pagos). El ticket no se borra ante ningún error; con `20002` se recarga la grilla para ver el stock real. | `shared/utils/errores-api.ts` |
| VC-09 | En el historial, el detalle se abre con un botón «Ver detalle» en cada fila (no con clic en toda la fila), por accesibilidad. `fecha_venta` ya es hora de Colombia y se muestra sin convertir; `fecha_registro` sí se convierte desde UTC. Solo se ofrece anular ventas PAGADA o PENDIENTE. | `ventas-page.component.ts`, `venta-resumen.component.ts` |
| VC-10 | Precios por cliente: la lista muestra solo acuerdos activos salvo que se marque «Ver también los desactivados». La diferencia positiva (el cliente paga más que la lista) va en rojo con ▲ y la negativa en verde con ▼, siempre con signo y texto. Editar usa el mismo `PUT` (que además reactiva el acuerdo). | `precios-cliente-page.component.ts` |
| VC-11 | Abono mixto: una solicitud por fila, en orden, cada una con su clave; ante el primer error se detiene. Las filas ya registradas salen de la lista y quedan como recibos; las pendientes se conservan para corregir y reintentar. La deuda que se muestra tras un abono es el `saldo_restante` del último recibo. | `abono-dialog.component.ts` |
| VC-12 | El IVA propuesto al crear un producto sale del parámetro `IVA_DEFECTO_PORCENTAJE`; si no se puede leer, 19. Solo se aplica si la persona aún no tocó el campo. | `producto-form-dialog.component.ts` |
| VC-13 | Castigar cartera exige, además del motivo de 10 a 255 caracteres, escribir el nombre del cliente tal como aparece (sin distinguir mayúsculas). Se muestra la deuda que se dará de baja. | `castigo-dialog.component.ts` |
| VC-14 | Parámetros: los nombres legibles y los cuatro temas están fijos en el cliente (`parametros.nombres.ts`); una clave desconocida va a «Otros» con la descripción del servidor como nombre. La edición permite hasta 2 decimales y valida el rango antes de enviar; el servidor decide. | `parametros.nombres.ts` |
| VC-15 | En el menú, «Historial de ventas» (`/ventas`) solo se marca activo en esa ruta exacta, para no resaltarse junto con «Punto de venta» (`/ventas/nueva`). | `sidebar-nav.data.ts` |
| VC-16 | `fecha_abono` llega del servidor como un **día** (`2026-10-09`, día de Colombia), no como marca UTC sin zona como los demás `fecha_*`; el contrato no lo precisa. Se muestra como fecha sin hora (convertirlo como UTC lo habría mostrado el día anterior a las 19:00). Si algún día llegara con hora, se convierte desde UTC. | `abonos-tab.component.ts` |

## Cuentas de proveedores y de la quincena

| ID | Supuesto | Dónde |
|---|---|---|
| CP-01 | «Cuentas de la quincena» vive en `/periodos/:id` y es solo ADMIN, igual que Períodos (muestra resultado y caja). Para un ADMIN, el chip de la quincena actual del encabezado lleva ahí; un OPERATIVO ve el chip sin enlace. | `cuentas-quincena-page.component.ts`, `quincena-chip.component.ts` |
| CP-02 | En la tabla de períodos, «Leche por pagar» y «Caja neta» son columnas opcionales (casilla), activadas por defecto; «Ver cuentas» abre la quincena. | `periodos-page.component.ts` |
| CP-03 | Las tarjetas de «Cuánto le debo» suman los saldos de todos los lecheros (se piden hasta 100, el máximo de una página), sin depender del filtro «Solo con deuda» de la tabla. | `lecheros-tab.component.ts` |
| CP-04 | La etiqueta «precio por defecto» se muestra cuando el lechero no tiene fila vigente en `/acopio/precios` (el API no trae una bandera). El valor estimado de una recepción es litros × precio vigente; con calidad por encima de los umbrales se muestra $ 0 («no se paga»). El servidor fija el precio y el valor reales. | `lecheros-tab.component.ts`, `recepcion-dialog.component.ts` |
| CP-05 | Los listados de precios, pagos y por lechero no envían `sort` (el contrato no lista los permitidos); «Cuánto le debo» solo ordena por saldo (su orden por defecto). | `precios-tab`, `pagos-tabla`, `lecheros-tab` |
| CP-06 | «Registrar pago» ofrece solo las quincenas con saldo, de la más antigua a la más nueva (por defecto la primera, o la de la que se abrió). Fijar un precio no usa `Idempotency-Key` (el contrato no la exige); los pagos y anulaciones sí. | `pago-lechero-dialog.component.ts` |
| CP-07 | Desde «Cuentas de la quincena», con la quincena CERRADA el botón «Pagar» queda deshabilitado (así lo pide la pantalla); el servidor igual decide según la quincena de la fecha del pago. | `cuentas-quincena-page.component.ts` |
