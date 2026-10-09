# Tarea: login, sesión y administración de usuarios en el dashboard de SILA

Trabajas en `~/Documentos/dashboard/dashboard-app` (Angular 22, standalone, signals, Tailwind 4, Vitest). SILA es el sistema de Llanolat, una empresa de lácteos en Colombia. Toda la interfaz va en **español de Colombia**.

Hasta hoy el dashboard no tiene login: se identifica con cabeceras `X-Usuario` / `X-Rol` tomadas de un selector «Dev» (modo mock). **Eso desaparece.** El backend ya tiene autenticación real (usuarios en Oracle, JWT, segundo factor TOTP, renovación de sesión con cookie). Tu trabajo es la parte del dashboard.

## Lee primero (en este orden)

1. `docs/CONTRATO_BACKEND.md`, secciones **«Autenticación»**, **«Usuarios»**, **«Convenciones»** y la tabla de **errores** (códigos 20013, 20014, 20015). Es la única fuente de verdad. El backend ya está implementado y probado (56 comprobaciones contra Oracle); **no lo modifiques**. Si el contrato y la realidad no coinciden, detente y repórtalo.
2. `docs/SUPUESTOS.md` (formato; comentarios `// SUPUESTO:` en el código).
3. Código existente que vas a tocar o reutilizar:
   - `core/services/auth.service.ts` (hoy guarda una sesión mock en memoria), `core/interceptors/auth.interceptor.ts`, `core/interceptors/error.interceptor.ts`, `core/guards/auth.guard.ts` (listo pero sin usar), `core/auth/role.guard.ts`, `core/auth/has-role.directive.ts`, `core/auth/identidad-dev.token.ts`.
   - `core/api/api.service.ts`, `core/api/api-error.ts`, `app.config.ts`, `app.routes.ts`, `environments/*`.
   - `core/data/data-providers.ts` y `data-providers.development.ts`, `core/mock/mock-tools.token.ts`, `layout/mock-session/mock-session-switcher.component.ts`.
   - `layout/header/*`, `layout/sidebar/*`, `layout/shell/*`.
   - La plantilla de pantallas: `features/catalogos/clientes/clientes-tab.component.*` y `features/periodos/*` (si ya existe): listado en servidor con `crearListado`, `app-server-data-table`, diálogos, toasts, `appHasRole`.

## Modelo de seguridad que debes respetar

- El **token de acceso** (JWT de 15 min) vive **solo en memoria** (un signal). **Nunca** en `localStorage`, `sessionStorage`, cookies propias, la URL ni logs.
- El **token de renovación** lo maneja el navegador como cookie `HttpOnly` (`sila_refresh`): el código del dashboard **no puede ni debe leerlo**. Solo se manda con `withCredentials: true` a `/auth/*`.
- Los **tokens temporales** (`token_temporal`, 5 min) del flujo de login se guardan únicamente en el estado del componente/servicio de login, jamás en almacenamiento persistente, y se descartan al terminar o cancelar.
- Ocultar un botón **no es seguridad**: el backend responde 403/20008. Muestra ese error si ocurre.
- No loguees ni muestres claves, tokens, secretos MFA ni la clave temporal fuera de donde se pida.

## Parte 1 · Login y sesión

### 1.1 Entorno y conexión con el backend

- El backend ya corre en **modo `jwt`** (es su modo por defecto, también en desarrollo). Para que la cookie `SameSite=Strict` funcione sin complicaciones y se parezca a producción, usa un **proxy de desarrollo**: crea `proxy.conf.json` que reenvíe `/api` a `http://localhost:8080`, regístralo en `angular.json` (`serve` → `proxyConfig`), y deja `environment.development.ts` con `apiBaseUrl: ''` (igual que producción). Con eso todo es mismo origen; no hace falta CORS ni `withCredentials` especial, aunque déjalo puesto en las llamadas `/auth/*` por claridad.
- Elimina el modo mock: `mockAuth` en los dos `environment*.ts`, el selector `MockSessionSwitcherComponent`, `MOCK_TOOLS`, `IDENTIDAD_DEV` y la inyección de cabeceras `X-Usuario` / `X-Rol` en `data-providers.development.ts`. Los dos archivos de `data-providers*` deben quedar equivalentes o fusionarse (si ya no hay diferencia, simplifica y ajusta los `fileReplacements` de `angular.json` en consecuencia, sin romper `ng build`).

### 1.2 `AuthService` (reescribir `core/services/auth.service.ts`)

Mantén lo que otras partes ya usan: `Rol`, `sesion`, `isAuthenticated`, `rol`, `hasRole(rol)` (ADMIN incluye OPERATIVO), `HasRoleDirective` y `roleGuard` deben seguir funcionando sin cambios en sus usuarios. Agrega:

- `Sesion`: `{ id_usuario, usuario, nombre, email, rol, mfa_activo }` (los datos de `UsuarioSesion` del contrato).
- `iniciarSesion(usuario, clave)`, `cambiarClave(...)`, `configurarMfa()`, `activarMfa(codigo)`, `verificarMfa(codigo)`: cada uno llama a su ruta `/auth/*` y devuelve el `AuthResponse`; cuando llega `estado: 'OK'` guardan `access_token` en memoria y la `Sesion`.
- `renovar()`: `POST /auth/refresh` con credenciales. **Una sola renovación a la vez** (single-flight: si ya hay una en curso, todos los llamadores esperan la misma, p. ej. con `shareReplay`). Necesario porque el backend rota el token en cada uso y un doble refresh simultáneo revoca la sesión.
- `cerrarSesion()`: `POST /auth/logout`, y siempre limpia el token y la sesión en memoria aunque la llamada falle.
- `restaurarSesion()`: al arrancar la app (`provideAppInitializer` o equivalente), intenta `renovar()`; si falla en silencio, queda sin sesión (la pantalla de login se mostrará por el guard). Así un F5 no obliga a escribir la clave si la cookie sigue vigente.

### 1.3 Interceptores

- `authInterceptor`: agrega `Authorization: Bearer <token>` a las llamadas al API (nunca a `/auth/login`, `/auth/refresh`, `/auth/logout`). Para `/auth/*` pon `withCredentials: true`.
- `errorInterceptor`: ante `401` con `code 20013` en una llamada **que no sea de `/auth/*`**: llama una vez a `AuthService.renovar()`; si funciona, **reintenta la petición original una sola vez** con el token nuevo; si no, limpia la sesión y manda a `/login` conservando la URL de retorno. Nunca reintentes más de una vez ni entres en bucle. Los errores de `/auth/*` se muestran tal cual (mensaje del servidor), sin intentar renovar. El `401` ya no debe limpiar la sesión sin más (como hace hoy).
- Mapea los nuevos códigos en `core/api/api-error.ts`: **20013** (no autenticado), **20014** (cuenta bloqueada: muestra el mensaje del servidor, trae los minutos) y **20015** (demasiados intentos). Para 20013/20014/20015 el mensaje del servidor es el que se muestra.

### 1.4 Rutas y guards

- Ruta pública `/login` (componente cargado en diferido). Sin el shell (pantalla limpia).
- `authGuard` (ya existe) en la ruta del shell: sin sesión → `/login?return=<ruta>`. Un `guestGuard` en `/login`: con sesión → a la página de inicio.
- **Validación de la URL de retorno** (evita redirección abierta): solo se acepta si empieza por `/` y no por `//` ni contiene `:`; si no, ir al inicio.
- `roleGuard('ADMIN')` en las rutas de administración (la de Usuarios, y la de Períodos si ya existe).

### 1.5 Pantalla de login (`features/auth/login-page.component.*`)

Un solo componente con **pasos** (un signal `paso`), tarjeta centrada, logo/nombre «SILA · Llanolat», responsive, accesible (labels reales, foco al primer campo de cada paso, mensajes de error con `role="alert"`, botones que se deshabilitan y muestran «Procesando…» mientras esperan; Enter envía):

1. **credenciales**: usuario y clave (`autocomplete="username"` / `current-password`, botón mostrar/ocultar clave). Usuario sin espacios y en minúscula (normaliza al enviar).
2. **cambiar-clave** (`estado: CAMBIAR_CLAVE`): explica «Es tu primer ingreso o un administrador restableció tu clave». Campos: clave actual (la temporal), clave nueva y confirmación (`autocomplete="new-password"`). Requisitos visibles: **mínimo 12 caracteres**, distinta de la actual, sin tu usuario ni palabras obvias; valida en el cliente lo que se pueda (largo, coincidencia) y muestra el mensaje del servidor (400/20001) para el resto.
3. **mfa-enrolar** (`estado: MFA_ENROLAR`): llama a `configurarMfa()` al entrar al paso; muestra el **código QR** de `otpauth_uri` y, debajo, el `secreto` en texto con botón copiar («si no puedes escanear»). Instrucciones cortas (Google Authenticator, Microsoft Authenticator o Authy) y campo para el código de 6 dígitos → `activarMfa`. Para el QR puedes agregar la librería `qrcode` (fija versión exacta, revisa `npm audit`) y renderizarla como imagen/SVG **sin `innerHTML` inseguro**.
4. **mfa-codigo** (`estado: MFA_REQUERIDO`): campo de 6 dígitos (`inputmode="numeric"`, `autocomplete="one-time-code"`), se envía solo al completar 6 dígitos o con el botón → `verificarMfa`.

Reglas de UX: «Volver» regresa al paso 1 y **descarta** el token temporal; si el token temporal vence (401 en un paso) vuelve al paso 1 con un aviso. Errores: muestra el `message` del servidor (los de 20013 son genéricos a propósito: «Usuario o clave incorrectos.»); `423/20014` muestra el aviso de bloqueo sin dar más pistas; `429/20015` pide esperar. No distingas nunca entre «usuario inexistente» y «clave mala». Al terminar (`OK`): redirige a la URL de retorno validada o al inicio.

### 1.6 Barra superior y menú

- Reemplaza el selector Dev por un **menú de usuario** (componente propio en `layout/header/`): nombre, rol (chip), «Mi cuenta», «Cerrar sesión». No toques el resto del header (esa limpieza es otra tarea).
- **Mi cuenta** (`/cuenta`, cualquier usuario autenticado): datos de la sesión (usuario, nombre, correo, rol, si tiene segundo factor), formulario **cambiar mi clave** (reutiliza el formulario del paso 2, con token de acceso; al terminar el backend cierra todas las sesiones → muestra un aviso y manda a `/login`) y, si no tiene MFA, un bloque opcional «Activar segundo factor» (misma interfaz de QR que el login, con token de acceso).
- Cerrar sesión: confirmación no requerida; limpia y va a `/login`.

## Parte 2 · Pantalla «Usuarios» (solo ADMIN)

Ruta `/usuarios` con `roleGuard('ADMIN')`, título `Usuarios · SILA`, e ítem «Usuarios» en el grupo «Administración» del menú (`sidebar-nav.data.ts`, `rol: 'ADMIN'`).

- **Listado** con `crearListado` + `app-server-data-table` (`GET /usuarios`), búsqueda con antirrebote por usuario/nombre/correo, filtros de rol y estado (Todos / Activos / Inactivos), orden en servidor. Columnas: usuario, nombre, correo, rol (chip), estado (chip activo/inactivo; y chip «Bloqueado (N min)» si `bloqueado`), segundo factor (sí/no), «Debe cambiar clave», último acceso. **Las marcas de tiempo llegan en UTC sin zona**: agrega a `shared/utils/formato-co.ts` un `formatoFechaHora()` que las trate como UTC y las muestre en `America/Bogota`, formato `dd/MM/yyyy HH:mm`.
- **Nuevo usuario** (diálogo): `usuario` (3–100, minúscula, `a-z 0-9 _ . @ -`), nombre, correo, rol. Al crear, el backend devuelve `clave_temporal` **una sola vez**: muéstrala en un diálogo propio con botón **copiar**, advertencia clara («Anótala o cópiala ahora: no se podrá ver de nuevo») y que **no se cierre sin confirmar** («Ya la copié»). No la guardes en ningún lado ni la registres.
- **Acciones por fila** (con `app-confirm-dialog` donde aplique y toast al terminar; errores con `ApiErrorService`): Editar (nombre, correo, rol), Activar/Desactivar, Desbloquear (solo si `bloqueado`), Restablecer clave (muestra la nueva `clave_temporal` en el mismo diálogo de arriba), Restablecer segundo factor (confirmación fuerte: «la persona tendrá que configurarlo de nuevo al entrar»).
- **Reglas del servidor que debes anticipar sin duplicar**: nadie puede desactivarse, cambiarse el rol, restablecerse clave/MFA a sí mismo y debe quedar un ADMIN activo (el servidor responde 409/20006; muestra su mensaje). En la fila del usuario actual deshabilita esas acciones con un `title` que explique por qué, pero **no confíes en eso**: el servidor decide.
- Mismo patrón de repositorio que Catálogos: `features/usuarios/{models,data}` con clase abstracta, token e implementación HTTP.

## Reglas generales

- Componentes `standalone`, `OnPush`, signals, control flow (`@if`/`@for`), `inject()`. Reutiliza `shared/ui/*`.
- Todos los textos en es-CO. Accesibilidad: labels, foco, estados nunca solo por color, diálogos con foco atrapado (ya lo hace `app-dialog`).
- Sin `any` salvo el patrón `$any($event.target)` ya usado.
- Cada decisión tuya que no esté en este prompt ni en el contrato: `// SUPUESTO: …` en el código y una fila en una nueva sección **«Autenticación»** de `docs/SUPUESTOS.md` (ids `A-01`, `A-02`…).
- No modifiques el backend ni Catálogos (se renombra en otra tarea). Si ya existe la pantalla de Períodos, solo agrégale `roleGuard('ADMIN')` si le falta.

## Pruebas (Vitest, `ng test`)

Mínimo:

1. `auth.service.spec.ts` (con `HttpTestingController`): cada paso del flujo de login produce el estado esperado; en `OK` el token queda en memoria y **no** se escribe nada en `localStorage`/`sessionStorage`; `renovar()` es single-flight (dos llamadas simultáneas → una sola petición HTTP); `cerrarSesion()` limpia aunque falle la llamada.
2. `error.interceptor.spec.ts`: ante 401/20013 en una llamada normal → renueva **una** vez y reintenta **una** vez; si renovar falla → limpia la sesión y navega a `/login`; un 401 en `/auth/login` **no** dispara renovación.
3. `auth.guard.spec.ts` y validación de la URL de retorno (rechaza `//evil.com`, `https://x`, `javascript:`).
4. `login-page.component.spec.ts` con un `AuthService` falso: recorre credenciales → cambiar clave → MFA enrolar → OK; muestra el mensaje del servidor en 401 y 423; «Volver» descarta el token temporal.
5. `usuarios-page.component.spec.ts`: solo ADMIN ve las acciones; la clave temporal se muestra tras crear y el diálogo no se cierra sin confirmar; acciones deshabilitadas para el usuario actual.

## Verificación antes de entregar

1. `npx ng build` y `npx ng test` sin errores ni advertencias nuevas.
2. Prueba manual contra el backend real (modo jwt, el de siempre):
   ```bash
   # terminal 1 — el backend suele estar ya corriendo en :8080 (comprueba con curl localhost:8080/actuator/health);
   # si no, o si lo reinicias:
   cd ~/sila-backend && ./arrancar.sh
   # terminal 2
   cd ~/Documentos/dashboard/dashboard-app && npm start      # http://localhost:4200
   ```
   `arrancar.sh` ya carga las claves de `~/sila_llanolat/credenciales.txt`.
3. **Cuentas para probar** (las claves temporales están en `~/sila_llanolat/credenciales.txt`, líneas `SILA_PRUEBA_ADMIN_TEMP` y `SILA_PRUEBA_OPER_TEMP`; léelas con `awk` sin imprimirlas en tus resúmenes):
   - `prueba.admin` (ADMIN): pedirá cambiar clave y configurar el segundo factor. Cuando muestres el secreto de MFA, calcula los códigos con: `python3 -c "import hmac,hashlib,struct,time,base64,sys; s=sys.argv[1]; k=base64.b32decode(s+'='*(-len(s)%8)); h=hmac.new(k,struct.pack('>Q',int(time.time())//30),hashlib.sha1).digest(); o=h[-1]&15; print('%06d'%((struct.unpack('>I',h[o:o+4])[0]&0x7fffffff)%10**6))" SECRETO`
   - `prueba.operativo` (OPERATIVO): pedirá cambiar clave y entra sin MFA.
   - **No uses `kevin.mijares`** (es la cuenta real del dueño; hará su primer ingreso él mismo) y **no cambies su clave ni su MFA**.
   - Anota las claves nuevas que definas para las cuentas de prueba solo en el informe final **si es imprescindible**; mejor deja que el dueño las restablezca desde la pantalla de Usuarios.
4. Comprueba: login completo de ADMIN (clave temporal → nueva → QR → código → entra), F5 mantiene la sesión (cookie), cerrar sesión, expiración del acceso (puedes simularla borrando el token en memoria o esperando 15 min) con renovación transparente, acceso a `/usuarios` como OPERATIVO (debe bloquearse), crear un usuario y ver su clave temporal una sola vez, bloqueo tras 5 intentos fallidos, y que **en `localStorage`/`sessionStorage`/cookies visibles por JS no hay ningún token**.
5. Si algo del contrato no se comporta como dice, **detente y repórtalo**.

## Entrega

Resume: archivos creados, modificados y eliminados (incluido el modo mock), librería agregada (si la hubo), supuestos nuevos, resultado de `ng build` / `ng test`, y qué comprobaste a mano y qué no.
