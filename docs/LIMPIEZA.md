# Limpieza del proyecto (Fase 0)

> **Actualización (2026-10-08):** se eliminaron las 7 pantallas de la plantilla (`dashboard`, `customers`, `orders`, `products`, `users`, `files`, `proveedores`), sus rutas y los datos falsos de Catálogos. Los 4 botones del menú que las usaban temporalmente (Tablero, Historial de ventas, Cartera, Inventario) quedaron como "Pronto". También se borró lo que solo ellas usaban: `shared/ui/avatar`, `shared/ui/status-badge`, `shared/utils/format.ts` y el componente `data-table` antiguo (queda su directiva de celda y sus modelos, que usa `server-data-table`). Se conservan `stat-card`, `sparkline`, `chart-theme.service` y `apexcharts` como base de las tarjetas y gráficos del Tablero. Respaldo de todo lo anterior en `~/Documentos/dashboard/respaldos/`.

Fecha de inspección: 2026-09-29. **Estado: propuesta. Todavía no se ha borrado nada en esta fase; falta la aprobación.**

## Estado encontrado

| Aspecto | Hallazgo |
|---|---|
| Angular | 22.1 (`@angular/build:application`). Standalone, signals, control flow y `@defer` disponibles. |
| UI | Sin Material ni PrimeNG. Kit propio con Tailwind CSS 4 (`src/styles/components.css`, clases `sila-*`) + `src/app/shared/ui`. |
| Íconos | `@ng-icons/lucide` (SVG), cargados en un chunk diferido desde `app.config.ts`. |
| Gráficos | `apexcharts` + `ng-apexcharts` instalados, **sin ningún import** hoy. |
| Rutas | `app.routes.ts` solo tiene el shell con `children: []`. No hay pantallas. |
| Menú | `SIDEBAR_NAV_GROUPS = []`. |
| Login | No existe pantalla de login. |
| Git | El directorio **no es un repositorio git**. |
| Compilación | `ng build` (producción) compila sin errores ni advertencias. Inicial: 294 kB (77 kB transferidos). |
| `npm audit --omit=dev` | 0 vulnerabilidades. |

### Limpieza previa (ya hecha antes de esta inspección)

La versión anterior de este documento registra que en una sesión previa se eliminaron `src/app/features/{dashboard,customers,orders,products,users,files,proveedores}`, el personalizador de tema (`layout/theme-customizer`), `header-mock-data.ts`, `shared/ui/{avatar,sparkline,stat-card,status-badge}`, `shared/utils/format.ts`, la URL `https://api.pruebas-dashboard.com` y el guardado del token en `localStorage`. Confirmé que esos archivos ya no existen y que el token vive solo en memoria (`AuthService`).

Pero ese documento también decía que se habían quitado las variantes `[data-accent]`/`[data-radius]` y la lógica de acento del `ThemeService`, **y siguen ahí**. Esta versión reemplaza a la anterior y refleja el estado real.

---

## (a) Se ELIMINA

Pasos pequeños y reversibles, con `ng build` después de cada uno. Como no hay git, propongo hacer `git init` y un commit inicial antes del paso 1 (así queda un commit por paso). Si no quieres git, hago una copia de `src/`, `angular.json`, `package.json` y `package-lock.json` en una carpeta de respaldo.

| Paso | Elemento | Motivo |
|---|---|---|
| 1 | `dist/` | Salida de compilación. Está en `.gitignore` y se regenera con `ng build`. |
| 1 | Paquetes *extraneous* en `node_modules` (`@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`) vía `npm prune` | Están instalados pero ninguna dependencia los declara. |
| 2 | Bloques `[data-accent="teal"|"blue"|"violet"|"rose"|"green"|"amber"]` (12 bloques) y `[data-radius=…]` (4 reglas) en `src/styles/tokens.css`, más su comentario de cabecera | Restos del personalizador de tema, que ya no existe. El mapa solo pide tema claro/oscuro. **Ojo:** `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring` y `--chart-1` solo se definen dentro de esos bloques. Antes de borrarlos muevo los valores de `blue` (el acento activo hoy) a `:root` y `.dark`. |
| 2 | `ThemeAccent`, `ThemeRadius`, `ThemeDirection`, sus signals y los setters `setAccent`/`setRadius`/`setDirection`/`reset` en `layout/services/theme.service.ts`, y los `setAttribute('data-accent' / 'data-radius' / 'dir')` | Solo los usaba el personalizador. El `ThemeService` se queda con claro/oscuro/automático. |
| 2 | `this.theme.accent()` en `shared/services/chart-theme.service.ts` | Depende de la señal que se quita en el mismo paso. |
| 2 | Atributo `data-accent="blue"` y `class="dark"` fijos en `src/index.html` | El tema lo decide `ThemeService` según `prefers-color-scheme`. (`lang="en"`, el título "pruebas · Dashboard" y la descripción se cambian a es-CO/SILA; eso es un ajuste, no un borrado.) |
| 3 | `SIDEBAR_DOCS_LINK`, la rama `@else` con `[href]="item.externalHref"`, el campo `externalHref` y el bloque del enlace de documentación en `layout/sidebar` | Venían del menú de la plantilla, que enlazaba a un sitio externo. El mapa no tiene enlaces externos. |
| 3 | Usuario fijo "Aigars S." / "Admin" / iniciales "AS" y el enlace `href="#"` del pie del menú lateral; marca "pruebas / Dashboard" y el ícono `lucideZap` | Datos de la plantilla. El usuario y el rol vendrán del `AuthService` (y se mostrarán en la barra superior). |
| 3 | Exportación CSV (`exportCsv`, `exportSelected`, `downloadCsv`, `csvCell`, `exportName`, botones "Export") en `shared/ui/data-table` | El mapa no la pide, y descargar tablas con datos personales choca con la Ley 1581 (Habeas Data). |
| 3 | Borrado masivo (`bulkDelete`, `emitBulkDelete`, botón "Delete") en `shared/ui/data-table` | Ninguna pantalla del mapa borra registros. Las acciones destructivas van individuales, con `ConfirmDialog` y motivo. |
| 3 | Comentario de `DataTableComponent` que menciona "Customers, Orders, Products and Users pages" | Esas pantallas ya no existen. |
| 3 | Miga de pan fija `routerLink="/dashboard"` → "Dashboard" en `shared/ui/page-header` | La ruta `/dashboard` ya no existe. Las migas saldrán de los datos de la ruta. |
| 4 | Redirecciones a `/login` en `core/guards/auth.guard.ts` y `core/interceptors/error.interceptor.ts` | Apuntan a una ruta que no existe. Se reemplazan por `roleGuard` y por la pantalla "sin permiso" / aviso de sesión. |
| 4 | Contenido genérico del `README.md` (plantilla de Angular CLI, incluida la sección e2e) | Se reemplaza por el README entregable (ejecutar el mock, cambiar a HTTP, agregar pantalla). |

**Dependencias que se quitan:** ninguna declarada en `package.json`. Todas tienen uso actual o previsto (ver lista b y c).

---

## (b) Se CONSERVA y se reutiliza

| Elemento | Uso nuevo |
|---|---|
| `layout/shell/dashboard-shell.component.*` | Estructura base: menú lateral + barra superior + `<main>` con ancho máximo. |
| `layout/sidebar/*` | Menú colapsable. Se llena con los 6 grupos y sus íconos; los grupos plegables ya funcionan. Textos en español y `aria-*` correctos. |
| `layout/header/header.component.ts` | Barra superior (hoy solo tiene el botón del menú móvil). Se agregan el chip de quincena, usuario, rol, cerrar sesión y migas de pan. |
| `layout/services/sidebar-state.service.ts` | Estado colapsado / cajón móvil. |
| `layout/services/theme.service.ts` (solo modo claro/oscuro/auto) | Tema con `prefers-color-scheme`. |
| `shared/services/chart-theme.service.ts` | Colores de ApexCharts según el tema (gráficos del Tablero y de Resultado por quincena). |
| `shared/ui/icon/icon.component.ts` | Envoltorio único de íconos SVG Lucide. |
| `shared/ui/page-header/page-header.component.ts` | Base del `PageHeader`. |
| `shared/ui/data-table/*` | Base del `DataTable`: columnas, orden con `aria-sort`, selección, menú de acciones por fila, celdas con plantilla. Se cambia a paginación del servidor (`Page<T>`) y se agregan los estados cargando, vacío y error. |
| `shared/ui/dialog/dialog.component.ts` | Base del `ConfirmDialog` (usa el `<dialog>` nativo: foco atrapado y Escape). |
| `core/api/api.service.ts` | Punto único HTTP para los repositorios `Http*`. **Hay un defecto que corregir:** concatena `${apiBaseUrl}/api/v1`, y con `apiBaseUrl: '/api'` queda `/api/api/v1`. |
| `core/services/auth.service.ts` | Token en memoria (signal). Se amplía con `{ usuario, rol }`. |
| `core/interceptors/auth.interceptor.ts`, `error.interceptor.ts` | Esqueletos que se completan: correlación, timeout, reintento solo en GET, `ApiError`, 401/403/409/500. |
| `core/guards/auth.guard.ts` | Se conserva el archivo como base de `authGuard` + `roleGuard` (sin la redirección a `/login`). |
| `src/environments/*` | Se agrega `mockAuth` (el flag `useMocks` se creó y luego se eliminó junto con los datos de prueba de Catálogos). Falta el `fileReplacements` de producción; hoy `environment.ts` ya es el de producción, así que funciona. |
| `src/styles.css`, `src/styles/tokens.css` (sin acentos), `src/styles/components.css` | Sistema de diseño con tokens + puente a Tailwind. Se revisa el contraste AA en ambos temas. |
| `public/fonts/geist-*.woff2` | Tipografía local, sin depender de un CDN. |
| `app.config.ts` (carga diferida del set de íconos) | Se agregan `LOCALE_ID` es-CO, la estrategia de precarga y los providers de repositorios. |
| `.editorconfig`, `.prettierrc`, `.postcssrc.json`, `tsconfig*.json`, `.vscode/*` | Configuración de herramientas. |
| `angular.json` | Se conserva. Se baja el presupuesto inicial de 700 kB a ~500 kB (advertencia), como pide el documento. |
| Dependencias `@angular/*`, `@angular/cdk`, `@ng-icons/*`, `rxjs`, `tslib`, `tailwindcss`, `@tailwindcss/postcss`, `postcss` | `@angular/cdk` no se usa todavía, pero se necesita para el scroll virtual, `LiveAnnouncer` y `Clipboard`. |

---

## (c) DUDOSO (no se borra; decisión pendiente)

| Elemento | Por qué hay duda |
|---|---|
| `apexcharts` + `ng-apexcharts` | Hoy no se importan en ninguna parte (técnicamente es una dependencia sin uso). Planeo usarlas para los dos gráficos que pide el documento, cargadas con `@defer`. Si prefieres algo más ligero, la alternativa es un gráfico SVG propio y borrar ambas. |
| `localStorage` en `ThemeService` (preferencia de tema) y `SidebarStateService` (menú colapsado) | Las reglas prohíben `localStorage` solo para tokens y datos sensibles; estas son preferencias de interfaz. Además acceden sin `try/catch`, lo que puede fallar en modo privado. Propuesta: conservarlas y envolver el acceso. |
| ~~Prefijo `pruebas-*` en las clases CSS y en las claves de almacenamiento~~ | **Resuelto:** las clases pasaron a `sila-*`, las claves a `sila_*` y la marca visible a "SILA". |
| `public/favicon.ico`, `public/favicon.svg` | Son de la plantilla, pero no hay logo de SILA para reemplazarlos. |
| `vitest`, `jsdom`, `prettier` (devDependencies) y el target `test` de `angular.json` | No hay pruebas ni script de formato, pero son herramientas de desarrollo y no afectan el bundle. |
| `tailwindcss`, `@tailwindcss/postcss`, `postcss` en `dependencies` | Solo se usan al compilar; podrían ir en `devDependencies`. Moverlas no cambia el bundle. |
| Kit propio en Tailwind en vez de Angular Material | El documento pide Material solo si el proyecto no tiene librería de UI. Este tiene un kit propio y coherente, así que propongo conservarlo (se anotará en `SUPUESTOS.md`) en vez de sumar Material. |
| `console.error(err)` en `src/main.ts` | Solo registra fallos de arranque, sin datos de clientes. Propuesta: conservarlo. |
| `environment.development.ts` → `apiBaseUrl: 'http://localhost:8080'` | No es una URL de producción; es la dirección del backend en desarrollo. Propuesta: dejarla como ruta relativa (`/api`) con un proxy de desarrollo. |
