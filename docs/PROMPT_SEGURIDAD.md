# Tarea: seguridad avanzada del dashboard de SILA (códigos de respaldo, sesiones, auditoría, inactividad)

Trabajas en `~/Documentos/dashboard/dashboard-app` (Angular 22, standalone, signals, Tailwind 4, Vitest). SILA es el sistema de Llanolat, una empresa de lácteos en Colombia. Toda la interfaz va en **español de Colombia**.

**Esta tarea continúa a `docs/PROMPT_LOGIN.md`.** Se asume que ya existen y funcionan: la pantalla de login por pasos, `AuthService` (token de acceso en memoria, renovación con cookie, single-flight), los interceptores, los guards, «Mi cuenta» y la pantalla de Usuarios. Si algo de eso falta, **detente y repórtalo** antes de seguir. Las reglas de seguridad de ese prompt siguen vigentes: token de acceso solo en memoria, nada sensible en `localStorage`/`sessionStorage`/URL/logs, ocultar un botón no es seguridad.

## Lee primero

1. `docs/CONTRATO_BACKEND.md`: secciones **«Autenticación»** (incluye «Códigos de respaldo» y «Sesiones»), **«Usuarios»** y **«Auditoría y accesos»**, más la tabla de errores. Es la única fuente de verdad; el backend ya está implementado y probado con 99 comprobaciones contra Oracle. **No lo modifiques**; si el contrato y la realidad no coinciden, detente y repórtalo.
2. El código del login ya construido (`features/auth/*`, `core/services/auth.service.ts`, `features/usuarios/*`) y la plantilla de listados: `features/catalogos/clientes/clientes-tab.component.*` (`crearListado`, `app-server-data-table`, diálogos, toasts, `appHasRole`).
3. `docs/SUPUESTOS.md` (formato de los supuestos).

## Parte 1 · Códigos de respaldo del segundo factor

**Idea:** al activar el segundo factor, el servidor entrega **10 códigos de un solo uso** para entrar si se pierde el teléfono. Se ven **una sola vez**.

1. **Pantalla «Guarda tus códigos de respaldo»** — aparece justo después de activar el segundo factor, en dos lugares: (a) en el paso `mfa-enrolar` del login (la respuesta de `/auth/mfa/activar` trae `access_token` **y** `codigos_respaldo`: no entres a la app hasta que la persona confirme), y (b) en «Mi cuenta» al activarlo con sesión abierta (`estado: MFA_ACTIVADO`). Muestra los 10 códigos (fuente monoespaciada, en dos columnas), con botones **Copiar**, **Descargar (.txt)** e **Imprimir**, un texto claro («Cada código sirve una sola vez. Guárdalos en un lugar seguro, fuera de este computador. No se volverán a mostrar.») y una casilla **«Ya los guardé»** que habilita el botón «Continuar». No permitas cerrar con Esc ni clic afuera. El archivo descargado lleva el nombre del usuario y la fecha, y un encabezado «SILA · Llanolat — códigos de respaldo» (sin la clave ni nada más). Los códigos **solo viven en memoria del componente**: nunca en almacenamiento, URL ni logs; descártalos al continuar.
2. **Login, paso `mfa-codigo`:** debajo del campo del código agrega el enlace **«No tengo mi teléfono — usar un código de respaldo»**. Cambia a un campo de texto (`autocomplete="off"`, mayúsculas automáticas, acepta con o sin guion y espacios) que llama a `POST /auth/mfa/respaldo`. Al entrar con uno, la respuesta trae `codigos_restantes`: si es **2 o menos**, muestra tras el login un aviso destacado («Te quedan N códigos de respaldo. Genera nuevos.») con enlace a «Mi cuenta». Si es 0, aviso crítico. Errores como en el resto del login (mensaje del servidor; 423 = bloqueo).
3. **«Mi cuenta» → «Códigos de respaldo»:** muestra `GET /auth/mfa/respaldo` («Te quedan N de 10 códigos»), y un botón **Generar códigos nuevos** que pide la **clave actual** (diálogo con campo de clave; `POST /auth/mfa/respaldo/regenerar`), avisa que **los anteriores dejan de servir**, y muestra los nuevos en la misma pantalla de la regla 1. Solo visible si la persona tiene el segundo factor activo.

## Parte 2 · Sesiones

El servidor ahora trata cada inicio de sesión como una **sesión** con IP, navegador y fechas. Cerrarla corta también su token de acceso en segundos.

1. **«Mi cuenta» → «Mis sesiones»** (`GET /auth/sesiones`): tabla o tarjetas con **dispositivo** (interpreta `user_agent` de forma sencilla: navegador + sistema, p. ej. «Chrome en Windows»; si no se reconoce, «Dispositivo desconocido»; muestra el texto completo en un `title`), **IP**, **iniciada** y **última actividad** (UTC → hora de Colombia con el `formatoFechaHora()` que ya existe), y una etiqueta **«Esta sesión»** en la que tiene `actual: true`. Acciones: **Cerrar** (por fila; `DELETE /auth/sesiones/{familia}`), **Cerrar las demás** (`POST /auth/sesiones/cerrar-otras`; con confirmación) y **Cerrar todas** (`cerrar-todas`; confirmación fuerte, y después limpia la sesión local y manda a `/login`). Si cierras la fila «Esta sesión», trátalo como cerrar sesión (limpia y va a `/login`).
2. **Pantalla de Usuarios (ADMIN):** por fila, nuevas acciones **«Ver sesiones»** (diálogo con `GET /usuarios/{id}/sesiones`, mismos campos que arriba, sin «actual») y **«Cerrar sus sesiones»** (`POST /usuarios/{id}/cerrar-sesiones`, con confirmación y toast). Útil si se pierde un equipo o se sospecha de una cuenta.
3. **Manejo de «sesión cerrada desde otro lugar»:** cuando una llamada con token de acceso da `401`/`20013` y la renovación también falla, además de ir a `/login` muestra el aviso **«Tu sesión se cerró (en otro dispositivo, por inactividad o por un administrador). Inicia sesión de nuevo.»** una sola vez, sin bucles de reintento.

## Parte 3 · Pantalla «Auditoría y accesos» (solo ADMIN)

Ruta `/auditoria` con `roleGuard('ADMIN')`, título `Auditoría y accesos · SILA`, y activa el ítem **«Auditoría y errores»** del grupo «Administración» en `sidebar-nav.data.ts` (renómbralo «Auditoría y accesos» si lo ves más claro). Tres pestañas, cada una con `crearListado` + `app-server-data-table`, orden inicial `fecha,desc`, paginación en servidor:

1. **Accesos** (`GET /auditoria/accesos`): columnas fecha (hora de Colombia), usuario, evento (chip), IP, dispositivo (resumido, como en Mis sesiones), detalle. Filtros: usuario (búsqueda con antirrebote), **evento** (lista desplegable con los eventos del contrato), IP, desde y hasta (selectores de fecha; son días en UTC: explica con un texto de ayuda breve). Atajos rápidos: **«Fallos de las últimas 24 h»** (eventos `LOGIN_FALLIDO`/`MFA_FALLIDO` de hoy) y **«Bloqueos»**. **Resalta los eventos de riesgo** con tono de alerta/peligro (icono + texto, nunca solo color): `CUENTA_BLOQUEADA`, `USUARIO_DESCONOCIDO`, `REFRESH_REUSO`, `LIMITE_FRECUENCIA`, y `LOGIN_FALLIDO`/`MFA_FALLIDO`; los eventos normales en neutro. `REFRESH_REUSO` lleva un `title` que explique «un token de renovación se usó dos veces: posible robo de sesión; la sesión fue cerrada».
2. **Cambios** (`GET /auditoria/cambios`): fecha, usuario, tabla, registro, columna, valor anterior → valor nuevo. Filtros: usuario, tabla (texto), columna, desde, hasta. Muestra los valores tal cual (pueden ser largos: trunca con `title`).
3. **Errores** (`GET /auditoria/errores`): fecha, usuario, unidad, código, mensaje. Filtros: usuario, unidad, código, desde, hasta. Un campo «**Buscar referencia de soporte**» que filtre por `id_log` NO existe en el API: no lo inventes; si quieres ayudar, enséñale a la persona que el `support_ref` que ve el usuario es la columna «#» (id_log) de esta tabla.

Nunca muestres ni registres tokens, claves ni secretos aquí (el API ya no los devuelve; no lo cambies).

## Parte 4 · Cierre por inactividad y varias pestañas

1. **Inactividad:** si no hay actividad del usuario (movimiento del ratón, teclado, toque, scroll) durante **30 minutos**, cerrar la sesión (`AuthService.cerrarSesion()` y a `/login` con el aviso «Tu sesión se cerró por inactividad»). **2 minutos antes**, abre un diálogo con cuenta regresiva («Tu sesión se cerrará en 1:59») con **«Seguir conectado»** (cuenta como actividad) y «Cerrar sesión». Constante configurable en un solo sitio (`INACTIVIDAD_MS`, `AVISO_MS`). El temporizador no debe depender de que la pestaña esté en primer plano (usa marcas de tiempo, no solo `setTimeout`, para sobrevivir a que el navegador la duerma) y debe pausarse/limpiarse al cerrar sesión. Regístralo como servicio raíz iniciado con la sesión.
2. **Varias pestañas:** (a) cerrar sesión en una pestaña cierra las demás (`BroadcastChannel('sila-sesion')` con un mensaje `logout`; sin datos sensibles en el mensaje); (b) la **renovación** (`/auth/refresh`) debe serializarse entre pestañas con la API **Web Locks** (`navigator.locks.request('sila-refresh', …)`), porque el servidor rota el token en cada uso y dos pestañas renovando a la vez provocarían que se revoque la sesión; dentro del candado, vuelve a comprobar si otra pestaña ya renovó (p. ej. con un mensaje por el canal) antes de llamar. Si `navigator.locks` no existe, cae al comportamiento actual. (c) La actividad en una pestaña cuenta para la inactividad de todas (comparte la última actividad por el canal, **sin** almacenamiento persistente).

## Parte 5 · Utilidades de seguridad para los módulos que vienen

1. **`Idempotency-Key`:** el servidor la **exige** en ventas, cartera y facturación (los módulos que mueven dinero o stock) y la acepta en cualquier escritura. Agrega a `ApiService` soporte para enviarla: p. ej. `post(path, body, { idempotencyKey })` y un helper `nuevaClaveIdempotencia()` (`crypto.randomUUID()`), documentado con la regla del contrato: **una clave nueva por cada acción del usuario; se reutiliza solo para reintentar esa misma acción**. Mapea en `api-error.ts` los códigos **20016** («Hay otra solicitud igual en proceso, espera un momento») y **20017** («Esa operación ya se envió con datos distintos; vuelve a empezar»). No hace falta usarla todavía en Catálogos.
2. **Mensajes:** revisa `api-error.ts` para que los códigos 20013/20014/20015 (login) y los nuevos 20016/20017 tengan su texto o muestren el del servidor, como indica el contrato.

## Parte 6 · Higiene del proyecto

1. **`npm audit`:** ya está resuelto (Angular se actualizó de 22.1 a 22.2.2 en bloque, incluidos `@angular/cdk`, `@angular/build` y `@angular/cli`; `npm audit` da 0 vulnerabilidades, `ng build` y `ng test` pasan). **No lo repitas ni cambies esas versiones.** Solo confirma al final que `npm audit` sigue en 0 y no agregues dependencias con avisos.
2. **CSP (política de contenido):** prepara `docs/CSP.md` con la política recomendada para producción (la aplicará el proxy inverso en el servidor) y **pruébala**: sirve `dist/` con un servidor estático que agregue la cabecera (un script Node de unas líneas en `scripts/servir-con-csp.mjs`, no una dependencia nueva) y recorre la app con el login real (proxy a `:8080`) buscando violaciones en la consola. Punto de partida: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. Si algo exige `unsafe-inline` en scripts o un origen externo (fuentes, íconos), repórtalo y propón la alternativa; **no** debilites `script-src`. Documenta qué se tuvo que permitir y por qué.

## Reglas generales

- Componentes `standalone`, `OnPush`, signals, control flow, `inject()`; reutiliza `shared/ui/*`. Todos los textos en es-CO. Accesibilidad: labels, foco, estados nunca solo por color, diálogos con foco atrapado.
- Sin `any` salvo el patrón `$any($event.target)`.
- Cada decisión tuya que no esté en este prompt ni en el contrato: `// SUPUESTO: …` en el código y una fila en la sección «Autenticación» de `docs/SUPUESTOS.md` (continúa la numeración `A-xx`).
- No modifiques el backend ni Catálogos.

## Pruebas (Vitest, `ng test`)

Mínimo:
1. **Códigos de respaldo:** la pantalla no permite continuar sin marcar «Ya los guardé»; los códigos no se escriben en ningún almacenamiento; el login ofrece la alternativa de respaldo y llama a la ruta correcta; el aviso aparece con `codigos_restantes ≤ 2`.
2. **Sesiones:** «Mis sesiones» marca la actual; cerrar la actual limpia y navega a `/login`; «Cerrar las demás» pide confirmación; las acciones por usuario solo aparecen para ADMIN.
3. **Auditoría:** solo ADMIN llega a `/auditoria`; los eventos de riesgo se renderizan con chip de peligro/alerta e icono; los filtros llegan al repositorio con los nombres del contrato (`desde`, `hasta`, `evento`, `ip`…).
4. **Inactividad:** con reloj simulado (`vi.useFakeTimers` o un reloj inyectable) se abre el aviso 2 min antes y cierra la sesión a los 30; «Seguir conectado» reinicia la cuenta; el mensaje del canal `logout` cierra la sesión en otra «pestaña».
5. **Renovación entre pestañas:** con `navigator.locks` simulado, dos renovaciones simultáneas producen **una** sola llamada HTTP.
6. **`ApiService`:** `post` con `idempotencyKey` envía la cabecera `Idempotency-Key`.

## Verificación antes de entregar

1. `npx ng build` y `npx ng test` sin errores ni advertencias nuevas.
2. Prueba manual contra el backend real (modo jwt, el de siempre). El backend suele estar ya corriendo en `:8080` (`curl localhost:8080/actuator/health`); si no: `cd ~/sila-backend && ./arrancar.sh`. Dashboard: `cd ~/Documentos/dashboard/dashboard-app && npm start`.
3. **Usuarios de prueba:** crea los tuyos con `python3 ~/sila-backend/pruebas/crear_usuario_prueba.py ADMIN` (o `OPERATIVO`), que imprime usuario y clave temporal. **No uses `kevin.mijares` ni cambies su clave o su segundo factor** (es la cuenta real del dueño), ni las cuentas `prueba.*`. Para el segundo factor de pruebas calcula los códigos con: `python3 -c "import hmac,hashlib,struct,time,base64,sys; s=sys.argv[1]; k=base64.b32decode(s+'='*(-len(s)%8)); h=hmac.new(k,struct.pack('>Q',int(time.time())//30),hashlib.sha1).digest(); o=h[-1]&15; print('%06d'%((struct.unpack('>I',h[o:o+4])[0]&0x7fffffff)%10**6))" SECRETO`. Al terminar: `python3 ~/sila-backend/pruebas/crear_usuario_prueba.py --limpiar`.
4. Comprueba a mano: activar el segundo factor y ver los 10 códigos (guardarlos, y que no se puedan volver a ver), entrar con un código de respaldo (y que no sirva dos veces), regenerar, abrir dos navegadores/pestañas con la misma cuenta y cerrar una sesión desde la otra (la primera debe caer en segundos), cierre por inactividad (baja las constantes temporalmente para probarlo y **vuelve a dejar 30 min / 2 min**), las tres pestañas de auditoría con filtros, y que como OPERATIVO `/auditoria` y `/usuarios` quedan bloqueadas.
5. Si algo del contrato no se comporta como dice, **detente y repórtalo**.

## Entrega

Resume: archivos creados, modificados y eliminados, supuestos nuevos, resultado de `ng build` / `ng test` / `npm audit`, hallazgos de la prueba de CSP, y qué comprobaste a mano y qué no.
