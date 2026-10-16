# Checklist responsive (teléfono y tableta)

Criterio: sin scroll horizontal de la página, sin objetos fuera de pantalla, zonas táctiles ≥ 44 px y campos con fuente ≥ 16 px.
Escritorio (≥ 1024 px) no debe cambiar.

## 1. Revisión automática (Chrome con emulación táctil)

Se midió cada pantalla, ya con sesión de administrador, en los cuatro anchos. «OK» = ninguna de las cuatro condiciones falló.

| Pantalla | 360 px | 390 px | 430 px | 768 px |
|---|---|---|---|---|
| `/catalogos?pestana=clientes` | OK | OK | OK | OK |
| `/catalogos?pestana=proveedores` | OK | OK | OK | OK |
| `/catalogos?pestana=productos` | OK | OK | OK | OK |
| `/periodos` | OK | OK | OK | OK |
| `/periodos/19` | OK | OK | OK | OK |
| `/acopio?pestana=recepciones` | OK | OK | OK | OK |
| `/acopio?pestana=calidad` | OK | OK | OK | OK |
| `/acopio?pestana=pago` | OK | OK | OK | OK |
| `/acopio?pestana=lecheros` | OK | OK | OK | OK |
| `/acopio?pestana=precios` | OK | OK | OK | OK |
| `/produccion?pestana=lotes` | OK | OK | OK | OK |
| `/produccion?pestana=ajustes` | OK | OK | OK | OK |
| `/inventario` | OK | OK | OK | OK |
| `/ventas` | OK | OK | OK | OK |
| `/ventas/nueva` | OK | OK | OK | OK |
| `/precios-cliente` | OK | OK | OK | OK |
| `/cartera?pestana=clientes` | OK | OK | OK | OK |
| `/cartera?pestana=abonos` | OK | OK | OK | OK |
| `/parametros` | OK | OK | OK | OK |
| `/usuarios` | OK | OK | OK | OK |
| `/auditoria?pestana=accesos` | OK | OK | OK | OK |
| `/auditoria?pestana=cambios` | OK | OK | OK | OK |
| `/auditoria?pestana=errores` | OK | OK | OK | OK |
| `/cuenta` | OK | OK | OK | OK |
| `/resultado-quincena` | OK | OK | OK | OK |
| `/archivos` (raíz, carpeta, «Ver documento») | OK | OK | OK | OK |
| `/archivos/MANUAL` + subir + nueva carpeta (ADMIN) | OK | OK | OK | OK |
| `/archivos/drive` y `/archivos/accesos` (ADMIN) | OK | OK | OK | OK |
| Descargar con clave, detalle y PDF en `/comprobantes?ver=` | OK | OK | OK | OK |

Escritorio (1280 px): sin scroll horizontal en las 24 pantallas.
`/resultado-quincena` se midió aparte (360, 390, 430 y 768 px, con sesión de OPERATIVO): sin scroll horizontal de la página, zonas táctiles ≥ 44 px y campos ≥ 16 px; la gráfica del año se desliza dentro de su propio contenedor y la tabla del año pasa a tarjetas por debajo de 768 px.
Se midió con un guion de Playwright que no está en el repo; para repetirlo a mano, DevTools en modo teléfono a cada ancho.

## 2. Interacciones revisadas a 390 px (automático)

| Qué | Estado |
|---|---|
| Login (360, 390, 430, 768) y paso del código MFA | OK |
| Menú: abre con la hamburguesa, bloquea el scroll, cierra con Esc, tocando fuera y al navegar | OK |
| Tablas → tarjetas (Catálogos), orden con «Ordenar por», filtros plegados en «Filtros» | OK |
| Diálogos como hoja inferior: recepción, lote, ajuste, fijar precio | OK |
| Punto de venta: barra de total fija al pie, ticket y pago mixto | OK |

## 3. Pendiente de revisar a mano (no se puede comprobar con emulación)

- [ ] En un teléfono real (Android e iPhone): que el teclado virtual no tape el campo enfocado en los diálogos y en el punto de venta.
- [ ] Rotación horizontal con el cajón o un diálogo abierto.
- [ ] Impresión del ticket y del recibo desde el teléfono.
- [ ] Tablas pequeñas dentro de diálogos que siguen con scroll horizontal propio: detalle de lechero («Cuánto le debo») y «Ventas pendientes» de Cartera.
- [ ] Pestañas con el indicador de scroll en 360 px (se desplazan a la pestaña elegida, sin degradado en el borde).
- [ ] Gráficos (Tablero y «Resultado por quincena»): en teléfono real, que deslizar la gráfica del año con el dedo no choque con el scroll de la página, y que el toque en una columna seleccione la quincena (con emulación táctil solo se probó con el puntero).
- [ ] «Archivos»: en un teléfono real, que «Ver» abra el PDF en el visor del teléfono (con emulación solo se comprobó que se abre una pestaña `blob:`), que la descarga con clave guarde el PDF y que el teclado no tape el campo de la clave ni el motivo; subir una foto desde la cámara y arrastrar no aplica en el celular.
- [x] «Resultado por quincena»: gráfica del año (24 quincenas, scroll propio, leyenda a la izquierda) y tabla del año (tarjetas en móvil) revisadas a 360, 390, 430 y 768 px.
