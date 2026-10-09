# Prompt: Precio de la leche, pagos a lecheros y cuentas claras de la quincena

Lee `docs/CONTRATO_BACKEND.md`, sección «Cuentas con los lecheros y cuentas de la quincena». Backend ya desplegado. Implementa:

## 1. Vista de quincena (la pantalla más importante) — «Cuentas de la quincena»
Al abrir un período (o desde el chip de la quincena actual), muestra **tres bloques claros**, con montos en COP (`formato-co`), negativos en rojo, y un ícono de ayuda (tooltip) en cada concepto:

1. **Ventas y cobros**: Total vendido (con IVA) → desglose Contado / Crédito → Cobrado en la quincena (contado + abonos) → Cartera pendiente de esta quincena → Cartera castigada.
2. **Leche y lecheros**: Litros recibidos (y rechazados), Leche comprada ($), Pagada ($), **Por pagar ($)** destacado. Botón «Ver por lechero» → tabla de `GET /acopio/pago-lecheros?id_periodo=` (litros, precio promedio, valor, pagado, saldo) con botón «Pagar» por fila (ver 3).
3. **Resultado**: dos tarjetas separadas y rotuladas, nunca sumadas entre sí:
   - «Resultado (lo que ganó la quincena)» = `resultado_estimado`, con la fórmula visible: Ventas sin IVA − Costo de producción − Gastos − Cartera castigada.
   - «Caja (plata que entró y salió)» = `caja_neta`, con la fórmula: Cobrado − Pagos a lecheros − Gastos.
   Nota breve: «El costo de la leche entra en el resultado cuando se produce; lo que se debe a los lecheros se ve aparte».
Si la quincena está CERRADA, muestra la etiqueta y deshabilita las acciones. Reutiliza la tabla de períodos para agregar columnas opcionales Leche por pagar y Caja neta.

## 2. Precios de la leche (en Acopio → pestaña «Precios»)
Tabla de `GET /acopio/precios` (historial por lechero; resalta el vigente) y botón «Fijar precio» (solo ADMIN): lechero, precio por litro, «Rige desde» (por defecto hoy). Aviso: «Solo afecta las entregas nuevas; las ya registradas conservan su precio». En el formulario de recibir leche muestra el precio vigente del lechero seleccionado y el **valor estimado** (litros × precio) antes de enviar; si la entrega sale RECHAZADA, aclara que no se paga. En el listado de recepciones agrega columnas Precio/L y Valor.
Existe un precio por defecto (parámetro `PRECIO_LECHE_DEFAULT` en Parámetros) para lecheros sin precio propio: indícalo con una etiqueta «precio por defecto» cuando `precio_vigente` venga de ahí (no hay fila en `/acopio/precios` para ese lechero).

## 3. Cuentas por pagar (Acopio → pestaña «Lecheros» o página «Cuánto le debo»)
- Tarjetas arriba: Total comprado, Total pagado, **Total que se debe** (suma de `saldo`).
- Tabla de `GET /acopio/saldos` (ordenada por saldo desc, filtro «Solo con deuda»): lechero, precio vigente, litros, comprado, pagado, saldo, última entrega, último pago.
- Detalle del lechero: sus quincenas (`/acopio/pago-lecheros?id_proveedor=`) y sus pagos (`/acopio/pagos?id_proveedor=`).
- «Registrar pago» (solo ADMIN; OPERATIVO no ve el botón): lechero, **quincena que se paga** (selector con su saldo de cada una; por defecto la más antigua con saldo), monto (botón «Pagar todo el saldo»), medio, referencia, fecha. Envía `Idempotency-Key`. Errores: 400/20005 → «El pago supera el saldo de esa quincena (…)»; 409 → la quincena de la fecha está cerrada.
- Pagos: tabla con estado VIGENTE/ANULADO (tachado + motivo) y «Anular» (ADMIN, motivo ≥10).

## 4. Permisos y errores
Precios, pagos y anulaciones: solo ADMIN (el servidor responde 403 a OPERATIVO; oculta los botones pero no confíes en eso). Muestra el `message` del servidor en los errores.

## 5. Entrega
Modelos y repositorio (mock + HTTP), mock con datos coherentes, y un test por flujo (cuentas de la quincena renderiza los tres bloques con `resultado ≠ caja`, fijar precio, pago que supera saldo, anular pago). No toques el backend; si el contrato no coincide, avísame.
