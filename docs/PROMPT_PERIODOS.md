# Tarea: construir la pantalla «Períodos» del dashboard de SILA

Trabajas en `~/Documentos/dashboard/dashboard-app` (Angular 22, standalone, signals, Tailwind 4, Vitest). SILA es el sistema de Llanolat, una empresa de lácteos en Colombia. Toda la interfaz va en **español de Colombia**.

## Qué es un período (contexto de negocio)

Una **quincena** es el candado contable de SILA: 24 por año (quincena 1 = días 1–15, quincena 2 = día 16 a fin de mes). Mientras está `ABIERTA` se puede registrar ventas, recepciones de leche, gastos, etc. con fecha dentro de ella; una vez `CERRADA`, la base de datos rechaza esas escrituras. Solo el rol **ADMIN** crea períodos, los cierra y los reabre. Reabrir exige un motivo (queda en la auditoría). Cada quincena trae además su **resultado estimado**: `ingresos_ventas − costo_produccion − gastos_operativos − cartera_castigada` (una estimación de gestión, no un estado contable).

## Lee primero (en este orden)

1. `docs/CONTRATO_BACKEND.md`, sección **«Períodos»** y la tabla de errores. Es la única fuente de verdad del API. El backend ya está implementado y probado contra Oracle; **no lo modifiques**. Si el contrato y la realidad no coinciden, detente y repórtalo en lugar de trabajar alrededor.
2. `docs/SUPUESTOS.md` (formato de los supuestos; los comentarios `// SUPUESTO:` en el código).
3. El módulo de Catálogos como plantilla, **copia su patrón, no inventes otro**:
   - `features/catalogos/data/catalogos.repository.ts` (clase abstracta), `catalogos.provider.ts` (InjectionToken), `http-catalogos.repository.ts` (implementación HTTP).
   - `features/catalogos/clientes/clientes-tab.component.ts` y `.html` (listado paginado en servidor con `crearListado`, `app-server-data-table`, `app-confirm-dialog`, toasts, `appHasRole`).
   - `core/data/data-providers.ts` y `data-providers.development.ts` (dónde se registra cada repositorio).
   - `app.routes.ts`, `features/catalogos/catalogos.routes.ts`, `layout/sidebar/sidebar-nav.data.ts`.
   - `shared/utils/listado.ts`, `shared/utils/formato-co.ts`, `core/api/api-error.ts`, `core/auth/role.guard.ts`.

## Qué construir

### 1. Capa de datos (`src/app/features/periodos/`)

Mismo esquema que Catálogos:

- `models/periodos.models.ts`: `EstadoPeriodo = 'ABIERTA' | 'CERRADA'`; `Periodo` (los 12 campos del contrato, **en snake_case tal cual llegan**, fechas como string ISO, cifras como `number`); `PeriodosQuery` (`anio?`, `estado?`); `CrearPeriodosResultado { anio: number; creados: number }`.
- `data/periodos.repository.ts` (clase abstracta) con:
  - `listar(query: PageQuery & PeriodosQuery): Observable<Page<Periodo>>` → `GET periodos`
  - `anios(): Observable<number[]>` → `GET periodos/anios` (arreglo simple, no `Page`)
  - `actual(): Observable<Periodo>` → `GET periodos/actual` (404 / 20007 si no hay períodos para hoy)
  - `crearAnio(anio: number): Observable<CrearPeriodosResultado>` → `POST periodos/anio/{anio}` **[ADMIN]**
  - `cerrar(id: number): Observable<Periodo>` → `PATCH periodos/{id}/estado` con `{ estado: 'CERRADA' }` **[ADMIN]**
  - `reabrir(id: number, motivo: string): Observable<Periodo>` → `PATCH periodos/{id}/estado` con `{ estado: 'ABIERTA', motivo }` **[ADMIN]**
- `data/periodos.provider.ts` (`PERIODOS_REPOSITORY`) y `data/http-periodos.repository.ts` (usa `ApiService`; el JSON ya es snake_case, sin mapeos).
- Registra `{ provide: PERIODOS_REPOSITORY, useExisting: HttpPeriodosRepository }` en **los dos** archivos `core/data/data-providers*.ts`.
- No hay mock: el dashboard ya habla solo con el backend real.

### 2. La pantalla (`periodos-page.component.*`, ruta `/periodos`)

- Ruta lazy `features/periodos/periodos.routes.ts`, título `Períodos · SILA`, protegida con `roleGuard('ADMIN')`. Agrégala a `app.routes.ts` y pon `route: '/periodos'` al ítem «Períodos» de `sidebar-nav.data.ts` (conserva su `rol: 'ADMIN'`).
- Encabezado con `app-page-header`: «Períodos», con una frase corta que explique que cerrar una quincena bloquea el registro de movimientos en ella.
- **Selector de año** alimentado por `anios()`. Año inicial: el de `actual()` si existe; si no, el último de la lista; si no hay ninguno, no hay selector (ver estado vacío).
- **Botón «Crear períodos de un año»** (solo ADMIN, con `appHasRole`): abre un diálogo con un campo numérico de año (2000–2100; valor inicial = último año existente + 1, o el año actual si no hay ninguno). Al confirmar llama a `crearAnio`. Si `creados > 0`: toast «Se crearon N quincenas de AAAA» y selecciona ese año; si `creados === 0`: toast informativo «Las quincenas de AAAA ya existían». Recarga los años y la lista.
- **Tabla** con `app-server-data-table` + `crearListado`, filtrada por el año seleccionado y por un filtro opcional de estado (Todos / Abiertas / Cerradas), orden inicial `fecha_inicio,asc`. Un año tiene 24 filas y `PAGE_SIZE_OPTIONS` empieza en 10: haz que `crearListado` acepte un tamaño inicial opcional (cambio retrocompatible en `shared/utils/listado.ts`) y úsalo con 50 para que el año quepa en una sola página.
- Columnas: **Quincena** (p. ej. «Octubre · 1.ª quincena», mes con `Intl` es-CO), **Fechas** (`formatoFecha(inicio) – formatoFecha(fin)`), **Estado** (`app-status-chip`: ABIERTA → tono `exito`; CERRADA → tono `neutro`; icono + texto, nunca solo color), **Ingresos**, **Costo de producción**, **Gastos**, **Cartera castigada**, **Resultado estimado** (todas con `formatoCop`, alineadas a la derecha; el resultado negativo se distingue por el signo y por un tono de texto, no solo por color), y **Acciones**.
  - Ordenables en servidor: las columnas cuyo `key` esté en la lista de `sort` del contrato (`fecha_inicio`, `estado`, `resultado_estimado`, …). Las demás con `sortable: false`.
  - Marca la fila de la quincena actual (la de `actual()`) con un chip «Actual».
- **Acciones por fila** (solo ADMIN, con `appHasRole`):
  - Quincena `ABIERTA` → botón «Cerrar». Usa `app-confirm-dialog` (sin motivo) con un mensaje claro: «Mientras esté cerrada no se podrán registrar ventas, recepciones, gastos ni otros movimientos con fecha dentro de esta quincena. Podrás reabrirla indicando un motivo.»
  - Quincena `CERRADA` → botón «Reabrir». Usa `app-confirm-dialog` con `motivo = { min: 10, max: 200 }` y un mensaje que diga que quedará registrado quién la reabrió y por qué.
  - Tras cada acción: toast de éxito y recarga de la lista. Con error, `ApiErrorService.describe(error)` → `toast.error(mensaje, supportRef)` (igual que `clientes-tab`). El error `20010` (estado inválido, p. ej. otra persona ya la cerró) se muestra con el mensaje del servidor y además recarga la lista.
- **Estados**: cargando (skeleton), error con «Reintentar», y vacío. Si **no existe ningún año**, el estado vacío explica que hay que crear los períodos del año y ofrece el botón de crear (para OPERATIVO no debería llegar a esta pantalla, pero no asumas que el guard es la única defensa: el API responde 403).
- Responsive: en móvil la tabla hace scroll horizontal dentro de su contenedor; sin scroll horizontal de la página.

### 3. Chip de quincena en la barra superior (segunda parte, hazla al final)

Un componente pequeño `layout/header/quincena-chip.component.ts` que llama a `actual()` una vez y muestra, por ejemplo, «Quincena 1 · oct 2026 · Abierta» (icono + texto; si está cerrada, tono distinto). Si el API responde 404/20007, muestra «Sin quincena» con un enlace a `/periodos` solo para ADMIN, o no muestra nada para OPERATIVO. Insértalo en `header.component.html` **sin tocar lo demás del header** (esa limpieza es otra tarea).

## Reglas

- Componentes `standalone`, `ChangeDetectionStrategy.OnPush`, signals, control flow (`@if`, `@for`), `inject()`. Reutiliza `shared/ui/*`; no agregues librerías.
- Sin `any` salvo donde ya se use el patrón `$any($event.target)` del proyecto.
- Ocultar un botón **no es seguridad**: el backend responde `403` / `20008`; muestra ese error si ocurre.
- Todos los textos al usuario en es-CO. Accesibilidad: etiquetas en los campos, foco dentro de los diálogos (ya lo hace `app-dialog`), estados nunca solo por color.
- No modifiques Catálogos (se va a renombrar en otra tarea) ni nada del backend.
- Cada decisión tuya que no esté en este prompt ni en el contrato: un comentario `// SUPUESTO: …` en el código y una fila en una nueva sección **«Períodos»** de `docs/SUPUESTOS.md` (ids `P-01`, `P-02`…).

## Pruebas (Vitest, `ng test`)

Hoy el proyecto no tiene ninguna; estas serán las primeras. Mínimo:

1. `http-periodos.repository.spec.ts` con `HttpTestingController`: una prueba por método, verificando método HTTP, URL (`/api/v1/periodos…`), parámetros de consulta y cuerpo (incluido que `cerrar` envía `{estado:'CERRADA'}` y `reabrir` envía `{estado:'ABIERTA', motivo}`).
2. `periodos-page.component.spec.ts` con un repositorio falso: (a) un ADMIN ve «Cerrar» en filas abiertas y «Reabrir» en cerradas; un OPERATIVO no ve ninguno; (b) «Reabrir» no confirma hasta que el motivo tenga 10 caracteres; (c) crear un año con `creados: 0` muestra el aviso de «ya existían»; (d) con `anios()` vacío se ve el estado vacío con el botón de crear.

## Verificación antes de entregar

1. `npx ng build` y `npx ng test` sin errores ni advertencias nuevas.
2. Prueba manual contra el backend real:
   ```bash
   # terminal 1 (el backend suele estar ya corriendo en :8080; comprueba con curl localhost:8080/actuator/health)
   export LLANOLAT_APP_PWD=$(awk '/^LLANOLAT_APP/{print $2}' ~/sila_llanolat/credenciales.txt)
   cd ~/sila-backend && ./mvnw spring-boot:run
   # terminal 2
   cd ~/Documentos/dashboard/dashboard-app && npm start   # http://localhost:4200
   ```
   Usa el selector de sesión «Mock» de la barra superior para alternar ADMIN / OPERATIVO. Comprueba: lista de 2026 (24 filas, año actual preseleccionado), cerrar y reabrir una quincena **que no sea la de hoy** (reabrir deja una fila inmutable en la auditoría; usa la de enero), reabrir con motivo corto bloqueado, crear un año ya existente (aviso de «ya existían»), y el comportamiento como OPERATIVO. **No crees años nuevos innecesarios** (los períodos no se pueden borrar); para probar la creación, el año ya existente basta.
3. Si algo del contrato no se comporta como dice, **detente y repórtalo**.

## Entrega

Resume: archivos creados y modificados, supuestos agregados, resultado de `ng build` / `ng test`, y qué comprobaste a mano y qué no.
