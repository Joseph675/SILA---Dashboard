# Prompt: Adaptar todo el dashboard a teléfono (responsive móvil)

Hoy, en DevTools con modo teléfono (360–430 px de ancho), el dashboard se ve mal. Haz que **todas las pantallas existentes** sean cómodas y completas en teléfono, sin degradar escritorio. Solo front: no toques el backend ni los contratos.

## Criterio de aceptación
En 360×740, 390×844 y 430×932 (y 768 de tablet): **ningún scroll horizontal de la página**, ningún texto cortado o encimado, todo botón/enlace con zona táctil ≥ 44×44 px, todas las acciones de escritorio alcanzables. Escritorio (≥1024) debe quedar igual que hoy.

## 1. Base
- `index.html` ya tiene el viewport; verifica `overflow-x` en `html/body` (no lo ocultes para esconder el problema: encuentra el elemento que desborda). Usa `min-w-0` en hijos de flex/grid y `100dvh` en vez de `100vh` (barras del navegador móvil).
- Mobile-first con los breakpoints de Tailwind (`sm/md/lg`). Padding de página reducido en móvil (p-3/p-4).
- Inputs con `font-size ≥ 16px` en móvil (evita el zoom automático de iOS); `inputmode` adecuado (`numeric`/`decimal` en montos y el código MFA, con `autocomplete="one-time-code"`).
- Respeta áreas seguras (`env(safe-area-inset-*)`) en cabecera y barra inferior si la hay.

## 2. Shell (`layout/shell`, `sidebar`, `header`)
- Bajo `lg`, el sidebar pasa a **cajón off-canvas** con fondo oscuro (backdrop), se abre con botón hamburguesa en la cabecera, se cierra al tocar fuera, con Esc, y **al navegar** a una ruta. Bloquea el scroll del fondo mientras está abierto. Usa `sidebar-state.service.ts`, que ya existe.
- Cabecera compacta: oculta textos secundarios, deja hamburguesa + título + menú de usuario. El `theme-customizer` no debe tapar contenido en móvil (ocúltalo o ponlo dentro del menú de usuario).
- El contenido ocupa el ancho completo; sin margen izquierdo reservado para el sidebar en móvil.

## 3. Componentes compartidos (`shared/ui`) — aquí está el mayor impacto
- **`data-table` / `server-data-table`**: en móvil, cada fila se muestra como **tarjeta** (etiqueta: valor, la columna principal como título, acciones en un menú «⋯» o fila de botones al pie). No una tabla con scroll horizontal. Define por columna un modo de visibilidad (`prioridad`/`ocultarEnMovil`) para las columnas secundarias. Paginación y filtros compactos y táctiles; los filtros se pliegan en un panel «Filtros» en móvil.
- **`dialog` / `confirm-dialog`**: en móvil, **hoja inferior** o pantalla completa, con cabecera y botones de acción fijos y el cuerpo con scroll interno; que el teclado virtual no tape el campo enfocado.
- **`page-header`**: título y acciones se apilan; la acción principal a ancho completo.
- **`form-field`**: una columna en móvil; etiquetas visibles; mensajes de error sin desbordar.
- **`pestanas`**: scroll horizontal propio con indicador, o menú desplegable si hay más de 3.
- **`stat-card`, `sparkline`, gráficos ApexCharts**: rejilla de 1–2 columnas; los gráficos con ancho 100 %, altura razonable, leyendas abajo, y re-render al rotar el teléfono.
- **`selector-buscable`, `cliente-selector`, `toast`, `monto`, `sesiones-lista`**: revisa que el desplegable no se salga de pantalla, que el toast no tape la acción y que los montos grandes no rompan la línea.

## 4. Pantallas (revisa cada una en los tres anchos)
Login (pasos de cambio de clave y MFA, códigos de respaldo), Catálogos (clientes, proveedores, productos, categorías), Períodos, Acopio, Producción/Inventario, Ventas **incluido el punto de venta con varios medios de pago** (prioridad: se usará en el celular), Precios por cliente, Cartera y abonos, Parámetros, Usuarios y sesiones, Auditoría, Cuenta/MFA. En formularios largos (venta con líneas) usa tarjetas por línea en vez de tabla y un **resumen de total fijo al pie**.

## 5. Código muerto
Lo que quede de las pantallas del template sin uso (Customers, Orders, etc.) no se adapta: si ya no está en el sidebar ni en rutas activas, no lo toques.

## 6. Verificación
- Revisa cada pantalla con DevTools en 360, 390, 430 y 768 px, y rotación horizontal. Ten a mano un helper de pruebas manuales: lista en `docs/RESPONSIVE_CHECKLIST.md` (pantalla × ancho, OK/pendiente).
- Tests (vitest): al menos uno para el cajón del sidebar (abre, cierra al navegar y con Esc) y uno para `data-table` (renderiza tarjetas bajo el breakpoint, respeta `ocultarEnMovil`).
- `npm run build` sin errores ni warnings nuevos.

Si una pantalla necesita un cambio de contrato o datos que no existen, avísame en vez de inventarlo.
