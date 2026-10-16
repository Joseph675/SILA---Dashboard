# Contrato backend ↔ dashboard

Única fuente de verdad del API de **Autenticación**, **Usuarios**, **Catálogos**, **Períodos**, **Acopio**, **Producción**, **Inventario**, **Ventas**, **Cartera**, **Parámetros** y **Archivos**. El backend (`~/sila-backend`) se adaptó a este contrato; si algo cambia, se cambia aquí primero.
Verificado contra Oracle el 2026-10-07 (clientes, proveedores y productos) y el 2026-10-08 (períodos, autenticación y usuarios); lectura, escritura, roles y errores.

## Convenciones

| Tema | Regla |
|---|---|
| Base | `http://localhost:8080/api/v1/auth`, `/usuarios`, `/catalogos` y `/periodos`. Toda la API cuelga de `/api/v1`; las pantallas que aún no tienen contrato usan rutas `/api/v1/<recurso>` (ver `ENDPOINTS.md` del backend). |
| JSON | `snake_case`, igual que las columnas de las vistas. `activo` es booleano. |
| Identidad | **Modo `jwt` (producción):** `Authorization: Bearer <access_token>`, obtenido en `POST /auth/login`. El backend toma usuario y rol del token firmado; **las cabeceras `X-Usuario` / `X-Rol` se ignoran** y el cliente ya no puede afirmar quién es. **Modo `desarrollo`** (solo por excepción explícita; el backend se niega a arrancarlo con un perfil de producción): identidad por `X-Usuario` / `X-Rol`, sin token. El modo lo fija `SILA_MODO`: **`jwt` es el modo por defecto, también en desarrollo** (`./arrancar.sh`); `./arrancar.sh desarrollo` es la excepción explícita. |
| CORS | Origen exacto `http://localhost:4200`, **con credenciales** (la cookie de renovación lo exige). Métodos GET/POST/PUT/PATCH/DELETE; cabeceras `Content-Type`, `Accept`, `Authorization`, `Idempotency-Key` (y `X-Usuario`/`X-Rol` solo en modo desarrollo). El cliente HTTP debe usar `withCredentials: true` en las llamadas a `/auth/*`. |
| Escrituras | Devuelven **la entidad completa** (releída de la vista tras escribir). POST → `201`; PUT y PATCH → `200`. |
| Idempotencia | Ver sección «Idempotency-Key» más abajo. |
| Nada se borra | No hay `DELETE`. Activar/desactivar (y cerrar/reabrir un período) es `PATCH /{id}/estado`. |

## Autenticación

Todo el API exige un **token de acceso** (JWT, 15 min) salvo `/auth/login`, `/auth/refresh`, `/auth/logout` y `/actuator/health`. Sin token, o con uno vencido o alterado → `401` / `20013`. El token de acceso **va en memoria** en el dashboard (no en `localStorage`). El de **renovación** viaja solo en la cookie `sila_refresh` (`HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`, 12 h, se rota en cada uso): el JavaScript de la página nunca lo ve.

### Pasos del inicio de sesión

```
POST /auth/login ──► estado
   OK              → access_token (+ cookie)           fin
   CAMBIAR_CLAVE   → token_temporal ─► POST /auth/cambiar-clave ─► (siguiente estado)
   MFA_REQUERIDO   → token_temporal ─► POST /auth/mfa/verificar ─► OK
   MFA_ENROLAR     → token_temporal ─► POST /auth/mfa/configurar ─► (QR) ─► POST /auth/mfa/activar ─► OK
```

Orden: clave temporal → cambiarla → segundo factor. Los **ADMIN no pueden entrar sin segundo factor** (`MFA_ENROLAR` la primera vez); los OPERATIVO entran con solo la clave (pueden activar el suyo opcionalmente con un token de acceso). Los tokens temporales (`token_temporal`, 5 min) son de **un solo propósito**: con ellos solo se puede llamar al paso que corresponde; en el resto del API dan `403`.

| Ruta | Authorization | Cuerpo | Respuesta |
|---|---|---|---|
| `POST /auth/login` | — | `{usuario, clave}` | `AuthResponse` |
| `POST /auth/cambiar-clave` | temporal `cambiar_clave` **o** acceso | `{clave_actual, clave_nueva, codigo?}` | `AuthResponse` (con temporal: siguiente paso, **sin** `codigo`; con acceso: **`codigo` obligatorio** (6 dígitos de la app o código de respaldo), `400` si falta, `401` si es incorrecto; responde `{"estado":"CLAVE_CAMBIADA"}` y cierra todas las sesiones) |
| `POST /auth/mfa/configurar` | temporal `mfa_enrolar` **o** acceso | — | `{secreto, otpauth_uri}`: el dashboard dibuja `otpauth_uri` como código QR y muestra `secreto` como alternativa manual. Puede repetirse mientras no se active. `409` si ya está activo. |
| `POST /auth/mfa/activar` | temporal `mfa_enrolar` **o** acceso | `{codigo}` (6 dígitos) | Con temporal: `AuthResponse` `OK`. Con acceso: `{"estado":"MFA_ACTIVADO"}`. |
| `POST /auth/mfa/verificar` | temporal `mfa` | `{codigo}` | `AuthResponse` `OK` |
| `POST /auth/mfa/respaldo` | temporal `mfa` | `{codigo_respaldo}` | `AuthResponse` `OK` + `codigos_restantes`. Alternativa al código de la app cuando se perdió el teléfono (ver «Códigos de respaldo»). |
| `GET /auth/mfa/respaldo` | acceso | — | `{restantes}` |
| `POST /auth/mfa/respaldo/regenerar` | acceso | `{clave_actual, codigo}` | `{codigos_respaldo: [10]}`; los anteriores dejan de servir. `codigo` = 6 dígitos de la app o un código de respaldo (obligatorio, `400` si falta, `401` si es incorrecto). `409` si no tiene segundo factor. |
| `GET /auth/sesiones` | acceso | — | Mis sesiones abiertas: `[{familia, iniciada, ultima_actividad, ip, user_agent, actual}]` (UTC). |
| `DELETE /auth/sesiones/{familia}` | acceso | — | `204`. Cierra una de **mis** sesiones (puede ser la actual). `404` si no existe, ya estaba cerrada o no es mía. |
| `POST /auth/sesiones/cerrar-otras` | acceso | — | `{cerradas: n}`: todas las mías menos la actual. |
| `POST /auth/sesiones/cerrar-todas` | acceso | — | `{cerradas: n}`: todas, **incluida la actual** (hay que volver a iniciar sesión). |
| `POST /auth/refresh` | cookie `sila_refresh` | — | `AuthResponse` `OK` con **nuevo** access_token y **nueva** cookie. Si el token ya se usó, expiró, fue revocado o el usuario está inactivo → `401` y se borra la cookie. Un token usado dos veces **revoca toda la familia** (alguien lo copió): hay que iniciar sesión de nuevo. Se hace **una sola llamada a la vez** (varias pestañas llamando juntas se invalidan entre sí). |
| `POST /auth/logout` | cookie `sila_refresh` | — | `204`; revoca la sesión y borra la cookie. Siempre responde 204. |
| `GET /auth/yo` | acceso | — | `UsuarioSesion` |
| `PUT /auth/yo` | acceso | `{nombre, email, codigo}` | `UsuarioSesion` actualizado. Solo nombre y correo (rol, usuario y estado no se tocan). `codigo` obligatorio: 6 dígitos de la app o código de respaldo. `400` datos inválidos/falta código, `401` código incorrecto, `409` correo ya usado por otra cuenta, `423` cuenta bloqueada. |

```jsonc
// AuthResponse (se omiten los campos nulos)
{ "estado": "OK", "access_token": "eyJ…", "expires_in": 900,
  "usuario": { "id_usuario": 1, "usuario": "ana.perez", "nombre": "Ana Pérez",
               "email": "…", "rol": "ADMIN", "mfa_activo": true } }
{ "estado": "CAMBIAR_CLAVE" | "MFA_REQUERIDO" | "MFA_ENROLAR", "token_temporal": "eyJ…" }
```

### Códigos de respaldo del segundo factor

Si se pierde el teléfono, no hace falta que otro ADMIN lo restablezca: al **activar** el segundo factor (`/mfa/activar`, ya sea en el login o desde «Mi cuenta») la respuesta trae **`codigos_respaldo`: 10 códigos** con formato `XXXXX-XXXXX` (letras mayúsculas y números sin `O/I/0/1`). **Se muestran una sola vez**: el dashboard debe obligar a guardarlos (copiar, imprimir o descargar) y no dejar cerrar el diálogo hasta confirmar. El servidor solo guarda su huella.

- En el paso `MFA_REQUERIDO` el usuario puede elegir «Usar un código de respaldo» → `POST /auth/mfa/respaldo`. Se acepta en minúscula y con o sin guion. **Cada código sirve una sola vez**; la respuesta trae `codigos_restantes` (avisar cuando queden **2 o menos** y ofrecer regenerar). Un código incorrecto cuenta como intento fallido (bloqueo a los 5).
- Regenerar pide la clave actual y deja sin efecto los códigos anteriores. Restablecer el segundo factor (ADMIN) borra los códigos.

### Sesiones

Cada inicio de sesión abre una **sesión** (con su IP, navegador y fecha). Cerrar una sesión —con `logout`, `DELETE /auth/sesiones/{familia}`, «cerrar otras/todas», cambiar la clave, o que un ADMIN la cierre o desactive a la persona— **corta también su token de acceso en segundos** (no hay que esperar los 15 minutos): la siguiente llamada con ese token da `401` / `20013`, el `refresh` también, y el dashboard debe llevar al login con un aviso («Tu sesión fue cerrada»). El campo `actual` marca desde cuál se está pidiendo la lista.

- **Claves:** mínimo 12 caracteres, máximo 72 bytes, distinta de la actual, sin el nombre de usuario ni palabras obvias (`password`, `llanolat`…). Incumplir → `400` / `20001` con el motivo en `message`.
- **Errores del login** (el mensaje es el mismo para «usuario inexistente», «clave incorrecta» y «cuenta desactivada», para no revelar quién existe): `401` / `20013`. **5 fallos seguidos** (clave o código MFA) bloquean la cuenta 15 minutos (aunque luego se escriba la clave correcta). **En el login el bloqueo NO se revela**: responde el mismo `401` / `20013` que una clave mala (mensaje «Usuario o clave incorrectos. Si el problema continua, contacte al administrador.»); solo los pasos de MFA y las acciones con código devuelven `423` / `20014` con los minutos restantes en `message`. Más de 10 intentos por minuto por usuario e IP, o 30 por IP → `429` / `20015`.
- **Códigos MFA:** TOTP estándar (Google/Microsoft Authenticator, Authy), 6 dígitos, 30 s, con un paso de tolerancia. Un código **no se puede reutilizar** (`401`: «Ese codigo ya fue usado»).
- **Sesión caducada en el dashboard:** al recibir `401` / `20013` con un token de acceso vencido, llamar **una vez** a `/auth/refresh` y reintentar; si también da 401, ir a la pantalla de login.
- Los endpoints de cookie (`/refresh`, `/logout`) rechazan con `403` un `Origin` que no sea el del dashboard (defensa contra CSRF).

## Usuarios (solo ADMIN)

Todo `/usuarios/**` exige rol ADMIN (el API y, además, cada procedimiento de la base). Nada se borra: se desactiva. La lista **nunca** incluye el hash de la clave ni el secreto del segundo factor.

```jsonc
// Usuario
{ "id_usuario": 2, "usuario": "ana.perez", "nombre": "Ana Pérez", "email": "ana@…", "rol": "OPERATIVO",
  "activo": true, "debe_cambiar_clave": true, "mfa_activo": false,
  "bloqueado": false, "bloqueado_minutos": 0,
  "ultimo_login": "2026-10-09T03:45:05", "fecha_cambio_clave": null, "fecha_creacion": "2026-10-09T03:40:00" }
```

Las marcas de tiempo vienen **en UTC y sin zona** (hora del servidor de base de datos): el dashboard debe interpretarlas como UTC (`…Z`) antes de mostrarlas en hora de Colombia.

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /usuarios` | Filtros `texto` (usuario, nombre o correo), `activo`, `rol`; `page`, `size`, `sort` (`id_usuario`, `usuario`, `nombre`, `email`, `rol`, `activo`, `ultimo_login`, `fecha_creacion`; por defecto `nombre,asc`) | `Page<Usuario>` |
| `GET /usuarios/{id}` | — | `Usuario` |
| `POST /usuarios` | `{usuario, nombre, email, rol}`. `usuario`: 3–100 caracteres en **minúscula** (`a-z 0-9 _ . @ -`) | `201` `{usuario: Usuario, clave_temporal}`. **La clave temporal se muestra una sola vez**; la persona debe cambiarla al entrar. Duplicado → `409`. |
| `PUT /usuarios/{id}` | `{nombre, email, rol}` | `Usuario`. Cambiar el rol cierra las sesiones de esa persona. |
| `PATCH /usuarios/{id}/estado` | `{activo: bool}` | `Usuario`. Desactivar cierra sus sesiones; activar limpia el bloqueo. |
| `POST /usuarios/{id}/desbloquear` | — | `Usuario` |
| `POST /usuarios/{id}/restablecer-clave` | — | `{usuario: Usuario, clave_temporal}` (cierra sus sesiones; deberá cambiarla) |
| `GET /usuarios/{id}/sesiones` | — | Sesiones abiertas de esa persona: `[{familia, iniciada, ultima_actividad, ip, user_agent}]` |
| `POST /usuarios/{id}/cerrar-sesiones` | — | `Usuario`. Cierra todas sus sesiones (su token deja de servir en segundos). Se puede aplicar a uno mismo. |
| `POST /usuarios/{id}/restablecer-mfa` | — | `Usuario` (quita el segundo factor; lo configurará de nuevo al entrar; cierra sus sesiones) |

Reglas que aplica la base (`409` / `20006`): **nadie puede desactivarse, cambiarse el rol, restablecerse la clave ni quitarse el segundo factor a sí mismo** (lo hace otro ADMIN), y **debe quedar siempre al menos un ADMIN activo**. Si el único ADMIN pierde su autenticador, se recupera con acceso a la base de datos (ver `~/sila_llanolat/README.md`).

## Auditoría y accesos (solo ADMIN)

Solo lectura; las bitácoras no se modifican ni se borran. Todas devuelven `Page<T>` con `page`, `size`, `sort`. Las fechas del filtro son **días en UTC** (`AAAA-MM-DD`, ambos extremos incluidos) y las marcas de tiempo devueltas vienen en UTC sin zona (mostrarlas en hora de Colombia).

| Ruta | Filtros | `sort` (por defecto `fecha,desc`) |
|---|---|---|
| `GET /auditoria/accesos` | `usuario` (contiene), `evento`, `ip` (exacta), `desde`, `hasta` | `fecha`, `usuario`, `evento`, `ip`, `id_evento` |
| `GET /auditoria/cambios` | `usuario`, `tabla`, `columna`, `desde`, `hasta` | `fecha`, `usuario`, `tabla`, `columna`, `id_auditoria` |
| `GET /auditoria/errores` | `usuario`, `unidad`, `codigo_error`, `desde`, `hasta` | `fecha`, `usuario`, `unidad`, `codigo_error`, `id_log` |

- **`accesos`** → `{id_evento, fecha, usuario, evento, ip, user_agent, detalle}`. Eventos (`evento`): `LOGIN_OK`, `LOGIN_FALLIDO`, `MFA_FALLIDO`, `CUENTA_BLOQUEADA`, `USUARIO_DESCONOCIDO` (intento con un nombre que no existe: señal de ataque; se limita a 20 por IP y hora), `LIMITE_FRECUENCIA`, `LOGOUT`, `CLAVE_CAMBIADA`, `MFA_ACTIVADO`, `CODIGO_RESPALDO_USADO`, `CODIGOS_RESPALDO_REGENERADOS`, `SESION_CERRADA`, `SESIONES_CERRADAS`, `REFRESH_REUSO` (un token de renovación se usó dos veces: posible robo; se cerró la sesión). El dashboard puede destacar los de riesgo (`CUENTA_BLOQUEADA`, `USUARIO_DESCONOCIDO`, `REFRESH_REUSO`, `LIMITE_FRECUENCIA`, ráfagas de `LOGIN_FALLIDO`).
- **`cambios`** → `{id_auditoria, fecha, usuario, tabla, id_registro, columna, valor_anterior, valor_nuevo}`: precios, límites de crédito, estados, roles, reaperturas de quincena…
- **`errores`** → `{id_log, fecha, usuario, unidad, codigo_error, mensaje, contexto}`. El `id_log` es el `support_ref` que ve el usuario cuando hay un error interno.

## Listas: `Page<T>`

```json
{ "items": [ ... ], "total": 4, "page": 0, "size": 20 }
```

Parámetros (todos opcionales): `page` (base 0, por defecto 0), `size` (1–100, por defecto 20), `sort=campo,asc|desc`.
Un `sort` fuera de la lista de abajo, `page < 0` o `size` fuera de rango → `400` / `20001`. Todo orden desempata por id, así que la paginación es estable.

| Recurso | Filtros | `sort` permitido (por defecto `nombre,asc`) |
|---|---|---|
| `GET /clientes` | `texto`, `activo` | `id_cliente`, `tipo_documento`, `numero_documento`, `nombre`, `email`, `limite_credito`, `saldo_deudor`, `activo` |
| `GET /proveedores` | `texto`, `activo`, `tipo_proveedor` (`LECHERO`\|`INSUMOS`) | `id_proveedor`, `tipo_documento`, `numero_documento`, `nombre`, `telefono`, `tipo_proveedor`, `activo` |
| `GET /productos` | `texto`, `activo` | `id_producto`, `codigo_sku`, `nombre`, `unidad_medida`, `precio_base`, `tarifa_iva`, `stock`, `activo` |

`texto` busca en el nombre **sin distinguir mayúsculas, tildes ni eñes** (`ordeno` encuentra "Ordeño") y además en el documento (clientes y proveedores) o en el SKU (productos).

## Escrituras

| Método y ruta | Rol | Cuerpo | Procedimiento |
|---|---|---|---|
| `POST /clientes` | OPERATIVO (ADMIN si `limite_credito > 0`) | `tipo_documento, numero_documento, nombre, email, telefono?, direccion?, limite_credito?` | `sp_crear_cliente` |
| `PUT /clientes/{id}` | OPERATIVO (ADMIN si cambia `limite_credito`) | `nombre, email, telefono?, direccion?, limite_credito?` | `sp_actualizar_cliente` (+ `sp_cambiar_limite_credito`) |
| `PATCH /clientes/{id}/estado` | ADMIN | `{"activo": false}` | `sp_cambiar_estado` |
| `POST /proveedores` | OPERATIVO | `tipo_documento, numero_documento, nombre, telefono?, tipo_proveedor` | `sp_crear_proveedor` |
| `PUT /proveedores/{id}` | OPERATIVO | `nombre, telefono?` | `sp_actualizar_proveedor` |
| `PATCH /proveedores/{id}/estado` | ADMIN | `{"activo": true}` | `sp_cambiar_estado` |
| `POST /productos` | ADMIN | `codigo_sku, nombre, unidad_medida, precio_base, tarifa_iva` | `sp_crear_producto` |
| `PUT /productos/{id}` | OPERATIVO | `nombre, unidad_medida` | `sp_actualizar_producto` |
| `PATCH /productos/{id}/precio` | ADMIN | `precio_base, tarifa_iva` (juntos) | `sp_actualizar_precio` |
| `PATCH /productos/{id}/estado` | ADMIN | `{"activo": false}` | `sp_cambiar_estado` |

Detalles que conviene saber:

- **Cliente nuevo por OPERATIVO:** no enviar `limite_credito`; el servidor lo deja en 0 (C-04).
- **`PUT /clientes`:** `tipo_documento` y `numero_documento` son la identidad y **no se editan**; si llegan se ignoran. Si llega un `limite_credito` distinto al actual, se cambia **antes** que los datos: un OPERATIVO recibe `403` y no se modifica nada. Si llega igual al actual, no pasa nada.
- **`PUT` reemplaza:** los campos opcionales omitidos (`telefono`, `direccion`) quedan en `null`. Enviar siempre el formulario completo.
- **`PUT /productos`:** el nombre cambia siempre. La unidad solo cambia si el producto **no tiene ventas, ajustes, producción ni notas crédito y su stock es 0**; si no, `409` / `20006` con el mensaje "La unidad de medida no puede cambiarse…". El dashboard puede mostrar la unidad como bloqueada cuando `stock > 0`, pero el servidor es quien decide.
- **`stock`:** la vista lo llama `stock_actual`; el API lo expone como `stock`, que es como lo nombra `Producto` en `catalogos.models.ts`.
- **`Idempotency-Key`:** el backend la **acepta** (CORS) pero **todavía no la usa**: reenviar un POST crea un duplicado, salvo por las restricciones únicas (documento y SKU → `409`).

## Idempotency-Key

Para que un **reintento** (red lenta, doble clic) no duplique una venta, un abono o una factura, toda escritura (`POST`, `PUT`, `PATCH`, `DELETE`, salvo `/auth` y `/usuarios`) puede llevar la cabecera `Idempotency-Key`.

- **Formato:** 8 a 100 caracteres `A-Z a-z 0-9 . _ : -` (un UUID sirve). Distinto formato → `400` / `20001`.
- **Obligatoria** en `/api/v1/ventas`, `/api/v1/cartera`, `/api/v1/facturacion`, `/api/v1/acopio` y `/api/v1/produccion` (las operaciones que mueven dinero o stock o crean registros que no se borran); sin ella → `400` / `20001`. En el resto es opcional, pero recomendada en toda escritura.
- **Cómo la usa el dashboard:** genera **una clave nueva por cada acción del usuario** (cada vez que pulsa «Guardar» con datos nuevos) y la **reutiliza solo para reintentar automáticamente esa misma acción**. Nunca una clave fija ni reutilizada entre acciones distintas.
- **Qué hace el servidor:** la primera vez ejecuta y guarda la respuesta (solo si es `2xx`, 24 horas, por usuario). Si llega la misma clave con **el mismo contenido** devuelve **la misma respuesta**, con la cabecera `Idempotency-Replayed: true`, sin ejecutar nada otra vez. Misma clave con **contenido distinto** → `422` / `20017`. Misma clave mientras la primera sigue en proceso → `409` / `20016` (esperar y reintentar). Una respuesta de error (`4xx`/`5xx`) **no se guarda**: tras corregir la solicitud se puede reintentar con la misma clave.
- No sustituye las restricciones únicas: la misma persona (documento) con **otra** clave sigue dando `409` / `20006`.

## Acopio de leche

Cada **recepción** es una entrega de leche de un proveedor LECHERO, con su control de calidad. La base compara la temperatura y la acidez con los **umbrales vigentes** (hoy 10 °C y 18 °Dornic; `GET /acopio/umbrales`): si los superan, la recepción **se guarda igual, pero con `estado_calidad: "RECHAZADO"` y un `motivo_rechazo`** (no se paga). Un rechazo **no es un error**: la respuesta es `201`. Una recepción **no se puede editar ni borrar**. La quincena de la fecha debe estar `ABIERTA` (si no, `409` / `20004`).

```jsonc
// Recepcion
{ "id_recepcion": 7, "id_proveedor": 3, "proveedor": "Finca La Esperanza", "id_periodo": 19,
  "fecha": "2026-10-09", "litros": 100.5, "temperatura": 8, "acidez": 16,
  "estado_calidad": "APROBADO", "motivo_rechazo": null,
  "usuario_registro": "ana.perez", "fecha_registro": "2026-10-09T14:03:11" }   // fecha_registro: UTC sin zona
```

| Ruta | Rol | Detalle |
|---|---|---|
| `GET /acopio/recepciones` | todos | `Page<Recepcion>`. Filtros: `id_proveedor`, `estado_calidad` (`APROBADO`\|`RECHAZADO`), `id_periodo`, `desde`, `hasta` (días `AAAA-MM-DD`, sobre `fecha`). `sort` (por defecto `fecha,desc`): `id_recepcion`, `fecha`, `proveedor`, `litros`, `temperatura`, `acidez`, `estado_calidad`. |
| `POST /acopio/recepciones` | OPERATIVO | `{id_proveedor, litros, temperatura, acidez, fecha?}` → `201` `Recepcion`. **Exige `Idempotency-Key`.** `fecha` opcional (por defecto **hoy en hora de Colombia**); una fecha futura → `400` con `fields.fecha`. `litros` > 0 (hasta 2 decimales); temperatura −5 a 60; acidez 0 a 40. El proveedor debe estar activo y ser LECHERO (`409` / `20006` si no). |
| `GET /acopio/umbrales` | todos | `{temperatura_max, acidez_max}`: para avisar en el formulario («superará el máximo: se rechazará») antes de enviar. |
| `GET /acopio/calidad` | todos | `Page` por proveedor: `{id_proveedor, proveedor, numero_entregas, temperatura_promedio, acidez_promedio, entregas_rechazadas, porcentaje_rechazo}`. `sort`: `proveedor` (defecto), `numero_entregas`, `porcentaje_rechazo`, `entregas_rechazadas`. |
| `GET /acopio/pago-lecheros` | todos | `Page` por quincena y proveedor: `{id_periodo, anio, mes, quincena, id_proveedor, proveedor, litros_a_pagar, litros_rechazados}` (lo rechazado no se paga). Filtros: `id_periodo`, `anio`, `id_proveedor`. |

## Producción e inventario

Un **lote** es lo que se fabrica con leche: consume litros y **suma su cantidad al stock del producto** (el inventario es **por producto, no por lote**). El código del lote lo genera la base: `SKU-AAAAMMDD-NNN`. El costo del lote es `litros × costo_por_litro`. Un **ajuste** corrige el stock a mano (mermas, daños, correcciones) y **exige una observación**. Ni los lotes ni los ajustes se editan o borran. No se controla cuánta leche hay disponible (no hay inventario de leche): `litros_leche_usados` es un dato declarado.

```jsonc
// Lote
{ "id_lote": 5, "codigo_lote": "QSO-20261009-001", "id_producto": 3, "producto": "Queso campesino", "codigo_sku": "QSO", "unidad_medida": "KG",
  "fecha_produccion": "2026-10-09", "litros_leche_usados": 50, "cantidad_obtenida": 40, "porcentaje_rendimiento": 80,
  "costo_total": 100000, "costo_unitario": 2500, "fecha_vencimiento": "2026-10-30",
  "dias_restantes": 21, "nivel_alerta": null,            // nivel_alerta (VENCIDO | CRITICO | PROXIMO) solo si faltan 7 dias o menos
  "usuario_registro": "ana.perez", "fecha_registro": "2026-10-09T14:10:00" }
// Ajuste
{ "id_ajuste": 9, "id_producto": 3, "producto": "Queso campesino", "codigo_sku": "QSO", "unidad_medida": "KG",
  "tipo_ajuste": "MERMA", "cantidad_delta": -5, "observacion": "Se cayó una tina",
  "usuario_registro": "…", "fecha_registro": "…" }
```

| Ruta | Rol | Detalle |
|---|---|---|
| `GET /produccion/lotes` | todos | `Page<Lote>`. Filtros: `texto` (código de lote o producto), `id_producto`, `desde`, `hasta` (sobre `fecha_produccion`). `sort` (defecto `fecha_produccion,desc`): `id_lote`, `codigo_lote`, `producto`, `fecha_produccion`, `fecha_vencimiento`, `cantidad_obtenida`, `porcentaje_rendimiento`, `costo_total`, `dias_restantes`. |
| `POST /produccion/lotes` | OPERATIVO | `{id_producto, litros_leche_usados, cantidad_obtenida, costo_por_litro, fecha_produccion?, fecha_vencimiento?}` → `201` `Lote`. **Exige `Idempotency-Key`.** `fecha_produccion` por defecto hoy en Colombia (no futura); `fecha_vencimiento` por defecto la producción + 21 días (parámetro del sistema) y no puede ser anterior a la producción (`400` con `fields`). El producto debe existir y estar activo. |
| `GET /produccion/ajustes` | todos | `Page<Ajuste>`. Filtros: `id_producto`, `tipo_ajuste`, `desde`, `hasta` (días UTC, sobre `fecha_registro`). `sort` (defecto `fecha_registro,desc`): `id_ajuste`, `fecha_registro`, `producto`, `tipo_ajuste`, `cantidad_delta`. |
| `POST /produccion/ajustes` | ver abajo | `{id_producto, tipo_ajuste, cantidad, observacion}` → `201` `Ajuste`. **Exige `Idempotency-Key`.** `cantidad` es **siempre positiva**: el tipo decide si suma o resta (la respuesta trae `cantidad_delta` con signo). `observacion` de 5 a 255 caracteres. |

**Tipos de ajuste y quién puede:** restan stock y los puede hacer un **OPERATIVO**: `MERMA`, `DANO`, `VENCIMIENTO`, `MUESTRA`. **Solo ADMIN** (un OPERATIVO recibe `403` / `20008`): `INGRESO_INICIAL` y `CORRECCION_MAS` (suman) y `CORRECCION_MENOS` (resta). Un ajuste que dejaría el stock negativo → `409` / `20002` («El ajuste dejaría el stock negativo…»). El dashboard puede ofrecer solo los tipos permitidos al rol de la persona, pero **el servidor decide**.

| Ruta (inventario) | Rol | Detalle |
|---|---|---|
| `GET /inventario` | todos | `Page` de productos **activos**: `{id_producto, codigo_sku, producto, unidad_medida, stock_actual, precio_base, valor_venta_inventario}`. Filtros: `texto` (nombre o SKU), `solo_con_stock` (bool). `sort` (defecto `producto,asc`): `id_producto`, `codigo_sku`, `producto`, `stock_actual`, `precio_base`, `valor_venta_inventario`. |
| `GET /inventario/resumen` | todos | `{total_productos, productos_sin_stock, valor_total}` (para tarjetas). |
| `GET /inventario/alertas-caducidad` | todos | `Page` de lotes que vencen pronto o vencieron hace poco: `{codigo_lote, producto, cantidad_producida, fecha_vencimiento, dias_restantes, nivel_alerta}`. `dias_maximos` (0–60, por defecto 7) y `dias_vencidos` (0–365, por defecto 30: los vencidos hace más tiempo dejan de salir). `sort` (defecto `dias_restantes,asc`). **Ojo:** como el stock es por producto, `cantidad_producida` es lo fabricado en ese lote, **no** lo que queda sin vender. |

Se **eliminaron** las rutas antiguas de lectura de listas sueltas: `GET /produccion/trazabilidad` (ahora `GET /produccion/lotes`, que ya trae rendimiento y costos), y las versiones sin `Page` de `/inventario`, `/inventario/alertas-caducidad`, `/acopio/calidad` y `/acopio/pago-lecheros`.

## Ventas

Una **venta** descuenta stock y se registra **a nombre de un cliente**: **CONTADO** (se paga en el momento, con uno o **varios medios de pago** que suman exactamente el total) o **CREDITO** (queda como deuda del cliente, dentro de su cupo, con vencimiento a los días del parámetro `PLAZO_CREDITO_DIAS`, hoy 30). Para ventas de mostrador sin identificar al comprador existe el cliente **CONSUMIDOR FINAL** (CC `222222222222`, cupo 0: solo contado). Una venta **no se edita ni se borra**: se **anula** (solo ADMIN).

**El precio** de cada línea es el **precio pactado con ese cliente** si existe (ver «Precios pactados»), y si no, el precio de lista del producto. El IVA es el del producto. Precio, IVA y precio de lista **se congelan en la línea**: cambiarlos después no altera ventas pasadas. El total es `Σ(cantidad × precio) + IVA`, con IVA calculado por línea y redondeado a 2 decimales. **El dashboard no envía precios ni totales**: solo producto y cantidad; el servidor calcula.

La fecha de la venta es **hoy en hora de Colombia** (la base está en UTC). Las marcas `fecha_registro` van en UTC, sin zona.

```jsonc
// VentaDetalle
{ "venta": { "id_venta": 12, "id_cliente": 5, "cliente": "Doña Rosa", "tipo_documento": "CC", "numero_documento": "…", "id_periodo": 19,
             "fecha_venta": "2026-10-09T15:42:10", "tipo_venta": "CONTADO", "fecha_vencimiento": null,
             "subtotal_venta": 20, "total_iva": 3.8, "total_venta": 23.8, "saldo_pendiente": 0, "monto_castigado": 0,
             "estado_pago": "PAGADA", "motivo_anulacion": null, "usuario_registro": "…", "fecha_registro": "…" },
  "lineas": [ { "id_detalle": 1, "id_producto": 3, "codigo_sku": "QSO", "producto": "Queso", "unidad_medida": "KG", "cantidad": 2,
                "precio_unitario": 10, "precio_lista": 10, "precio_pactado": false, "tarifa_iva": 19,
                "subtotal": 20, "valor_iva": 3.8, "total_linea": 23.8 } ],
  "pagos":  [ { "id_pago": 1, "metodo_pago": "EFECTIVO", "monto": 10, "referencia_pago": null },
              { "id_pago": 2, "metodo_pago": "TRANSFERENCIA", "monto": 13.8, "referencia_pago": "REF-1" } ] }
```

`estado_pago`: `PAGADA`, `PENDIENTE` (debe algo), `ANULADA`, `CASTIGADA` (deuda dada de baja). `precio_pactado: true` = se vendió a un precio distinto al de lista (acuerdo con el cliente).

| Ruta | Rol | Detalle |
|---|---|---|
| `GET /ventas` | todos | `Page<Venta>` (la cabecera). Filtros: `texto` (cliente o documento), `id_cliente`, `estado_pago`, `tipo_venta`, `desde`, `hasta` (días, sobre `fecha_venta`). `sort` (defecto `fecha_venta,desc`): `id_venta`, `fecha_venta`, `cliente`, `total_venta`, `saldo_pendiente`, `estado_pago`, `tipo_venta`. |
| `GET /ventas/{id}` | todos | `VentaDetalle`. `404` / `20007` si no existe. |
| `GET /ventas/precios` | todos | **Para el punto de venta.** `Page<PrecioAplicable>` de productos **activos** con el precio que se le cobra a ese cliente: `{id_producto, codigo_sku, producto, unidad_medida, tarifa_iva, stock_actual, precio_base, precio_pactado (null si no hay acuerdo), precio_aplicable}`. **`id_cliente` obligatorio.** Filtros: `texto` (nombre o SKU), `solo_con_stock`. `sort` (defecto `producto,asc`): `id_producto`, `codigo_sku`, `producto`, `stock_actual`, `precio_aplicable`. |
| `POST /ventas` | OPERATIVO | `{id_cliente, tipo_venta, lineas: [{id_producto, cantidad}], pagos: [{metodo_pago, monto, referencia?}]}` → `201` `VentaDetalle`. **Exige `Idempotency-Key`.** 1 a 200 líneas (un mismo producto repetido se suma). `pagos`: **obligatorio y suma exacta del total si es CONTADO** (1 a 6 pagos); **no debe ir si es CREDITO** (el cobro posterior es un abono en Cartera). `metodo_pago`: `EFECTIVO`, `TRANSFERENCIA`, `TARJETA`, `CHEQUE`, `OTRO`. Errores de forma → `400` con `fields` (p. ej. `pagos`). |
| `POST /ventas/{id}/anular` | ADMIN | `{motivo}` (10 a 255 caracteres) → `VentaDetalle` ya `ANULADA`. **Exige `Idempotency-Key`.** Devuelve el stock y descuenta la deuda. **No se puede si la venta tiene abonos o una factura enviada a la DIAN** (`409` / `20006`: se corrige con nota crédito). |

Errores propios de una venta: `409` / `20002` **stock insuficiente** (el mensaje dice cuánto hay), `409` / `20003` **excede el cupo de crédito** (el mensaje trae cupo, deuda y venta), `409` / `20004` quincena cerrada, `409` / `20006` cliente o producto inactivo, `400` / `20001` pagos que no suman el total («Los pagos suman X y el total de la venta es Y»), `404` / `20007` producto o cliente inexistente.

**Pagos y cambio:** el servidor guarda el monto **aplicado** a la venta. Si el cliente entrega más efectivo del total, el dashboard calcula el «cambio» en pantalla y envía solo lo aplicado (el cambio no se registra).

### Precios pactados por cliente

Acuerdo de un **precio fijo** de un producto con un cliente (por ejemplo «a este cliente se le vende a 1.000 pesos más»). Lo fija **solo un ADMIN**; cada cambio queda en la auditoría. Si el precio de lista cambia después, el pactado **no se mueve** hasta renegociarlo. No se borran: se desactivan.

```jsonc
// PrecioCliente
{ "id_precio": 4, "id_cliente": 5, "cliente": "Doña Rosa", "id_producto": 3, "codigo_sku": "QSO", "producto": "Queso", "unidad_medida": "KG",
  "precio": 12, "precio_base": 10, "diferencia": 2, "activo": true }   // diferencia = precio - precio_base (puede ser negativa)
```

| Ruta | Rol | Detalle |
|---|---|---|
| `GET /precios-cliente` | todos | `Page<PrecioCliente>`. Filtros: `id_cliente`, `id_producto`, `activo`. `sort` (defecto `cliente,asc`): `id_precio`, `cliente`, `producto`, `precio`, `diferencia`. |
| `PUT /precios-cliente` | ADMIN | `{id_cliente, id_producto, precio}` → `PrecioCliente`. Crea el acuerdo o actualiza su precio, y lo deja activo. Cliente y producto deben existir y estar activos. |
| `PATCH /precios-cliente/{id}/estado` | ADMIN | `{activo: false}` → `PrecioCliente`. Solo desactivar; para reactivar se vuelve a fijar el precio con `PUT`. |

## Cartera

La **cartera** es lo que los clientes deben por ventas a crédito. Un **abono** reduce esa deuda y se **reparte automáticamente de la venta pendiente más antigua a la más nueva**; todo el reparto de un mismo pago comparte un `id_recibo`. Un abono **no puede exceder la deuda total del cliente**. Cada abono tiene **un solo medio de pago**: si el cliente paga mitad efectivo y mitad transferencia, son **dos abonos** (dos recibos). Castigar es dar de baja como incobrable toda la cartera pendiente de un cliente (solo ADMIN, **irreversible**).

`estado_credito` (lo calcula la base): `AL_DIA` (no debe), `VIGENTE` (debe, dentro del cupo y sin mora), `EN_MORA` (alguna venta pasó su vencimiento) o `EXCEDIDO` (debe más que su cupo). `dias_mora` = días desde el vencimiento de su venta más atrasada (día de Colombia).

| Ruta | Rol | Detalle |
|---|---|---|
| `GET /cartera/clientes` | todos | `Page<ClienteCartera>`: `{id_cliente, cliente, telefono, limite_credito, saldo_deudor, cupo_disponible, dias_mora, estado_credito}`. Filtros: `texto` (nombre), `estado_credito`, `solo_con_deuda` (**por defecto `true`**), `mora_minima` (días). `sort` (defecto `saldo_deudor,desc`): `id_cliente`, `cliente`, `saldo_deudor`, `dias_mora`, `limite_credito`, `cupo_disponible`, `estado_credito`. |
| `GET /cartera/resumen` | todos | `{total_cartera, clientes_con_deuda, clientes_en_mora, cartera_vencida}`. |
| `GET /cartera/clientes/{id}/ventas-pendientes` | todos | Lista simple (de la más antigua a la más nueva, el orden en que se aplican los abonos): `[{id_venta, fecha_venta, fecha_vencimiento, total_venta, saldo_pendiente, dias_mora}]`. |
| `GET /cartera/abonos` | todos | `Page<Abono>`: `{id_abono, id_recibo, id_cliente, cliente, id_venta, fecha_abono, monto, metodo_pago, referencia_pago, usuario_registro}`. Filtros: `id_cliente`, `id_venta`, `id_recibo`, `metodo_pago`, `desde`, `hasta`. `sort` (defecto `fecha_abono,desc`): `id_abono`, `fecha_abono`, `cliente`, `monto`, `id_recibo`. |
| `POST /cartera/abonos` | OPERATIVO | `{id_cliente, monto, metodo_pago, referencia?}` → `201` **`Recibo`**: `{id_recibo, saldo_restante, abonos: [Abono…]}` (cómo se repartió y cuánto queda debiendo). **Exige `Idempotency-Key`.** `400` / `20005` si el monto excede la deuda del cliente. |
| `POST /cartera/castigos` | ADMIN | `{id_cliente, motivo}` (10 a 255 caracteres) → `{id_cliente, monto_castigado}`. **Exige `Idempotency-Key`.** `409` si el cliente no tiene cartera pendiente. |

Se **eliminaron** las rutas antiguas `GET /ventas` (lista sin paginar), `GET /ventas/{id}/detalle`, `GET /cartera` y `GET /cartera/abonos` sin `Page`; las reemplazan las de arriba.

## Parámetros del sistema

Valores de negocio que se ajustan **sin tocar el código**. Todos son numéricos y tienen un **rango permitido** (`minimo`, `maximo`). **Cualquier persona autenticada los lee; solo un ADMIN los cambia**, y cada cambio queda en la auditoría (valor anterior y nuevo). Un cambio **rige desde la siguiente operación** (no altera lo ya registrado).

| `clave` | Qué controla | Rango |
|---|---|---|
| `PLAZO_CREDITO_DIAS` | Días para pagar una venta a crédito (vencimiento) | 0–365 |
| `MAX_LINEAS_DOCUMENTO` | Productos máximos por venta o nota crédito | 1–500 |
| `TEMP_MAX_LECHE_C` | Temperatura máxima aceptada al recibir leche | 0–30 |
| `ACIDEZ_MAX_DORNIC` | Acidez máxima aceptada al recibir leche | 10–30 |
| `DIAS_VIDA_UTIL_DEFAULT` | Vida útil por defecto de un lote nuevo (días) | 1–365 |
| `IVA_DEFECTO_PORCENTAJE` | IVA que se **propone** al crear un producto nuevo (cada producto conserva el suyo) | 0–100 |
| `LOGIN_MAX_INTENTOS` | Intentos fallidos antes de bloquear una cuenta | 3–20 |
| `LOGIN_BLOQUEO_MINUTOS` | Minutos que dura ese bloqueo | 1–1440 |
| `SESION_MAX_HORAS` | Duración máxima de una sesión aunque se renueve | 1–168 |

| Ruta | Rol | Detalle |
|---|---|---|
| `GET /parametros` | todos | Lista simple (son pocos), por `clave`: `[{clave, valor, minimo, maximo, descripcion}]`. |
| `PUT /parametros/{clave}` | ADMIN | `{valor}` (hasta 2 decimales) → el `Parametro` actualizado. Fuera de rango → `400` / `20001` con el rango en el mensaje; clave inexistente → `404`. |

## Períodos

Una **quincena** es el candado contable: mientras está `ABIERTA` se puede escribir en ella (ventas, recepciones, gastos…); `CERRADA` la bloquea. Hay 24 por año (quincena 1 = días 1–15, quincena 2 = día 16 a fin de mes). Cada fila trae además el **resultado estimado** de la quincena (una estimación de gestión, no un estado contable), calculado por la base: `ingresos_ventas − costo_produccion − gastos_operativos − cartera_castigada`.

### Lectura

| Ruta | Devuelve |
|---|---|
| `GET /periodos` | `Page<Periodo>`. Filtros: `anio`, `estado` (`ABIERTA`\|`CERRADA`). `sort` permitido (por defecto `fecha_inicio,asc`): `id_periodo`, `anio`, `mes`, `quincena`, `fecha_inicio`, `fecha_fin`, `estado`, `resultado_estimado`. Un año completo son 24 filas: pedir `size=50`. |
| `GET /periodos/anios` | Arreglo simple de años con quincenas creadas, ascendente: `[2026]`. Alimenta el selector de año. |
| `GET /periodos/actual` | El `Periodo` que contiene el día de hoy **en Colombia** (antes usaba la hora UTC de la base y entre las 7 p. m. y la medianoche devolvía la quincena siguiente). `404` / `20007` si no hay períodos creados para hoy. |
| `GET /periodos/{id}` | Un `Periodo`. `404` / `20007` si no existe. |

```json
{
  "id_periodo": 19, "anio": 2026, "mes": 10, "quincena": 1,
  "fecha_inicio": "2026-10-01", "fecha_fin": "2026-10-15", "estado": "ABIERTA",
  "ingresos_ventas": 0, "costo_produccion": 0, "gastos_operativos": 0,
  "cartera_castigada": 0, "resultado_estimado": 0
}
```

Fechas ISO (`AAAA-MM-DD`); las cifras son números (COP, hasta 2 decimales).

### Escritura (todo es ADMIN)

| Método y ruta | Cuerpo | Procedimiento | Respuesta |
|---|---|---|---|
| `POST /periodos/anio/{anio}` | — | `sp_crear_periodos_anio` | `{"anio": 2027, "creados": 24}`. `201` si creó alguna; `200` con `creados: 0` si ya existían todas (es idempotente). Año fuera de 2000–2100 → `400` / `20001`. |
| `PATCH /periodos/{id}/estado` | Cerrar: `{"estado": "CERRADA"}`. Reabrir: `{"estado": "ABIERTA", "motivo": "…"}` | `sp_cerrar_periodo` / `sp_reabrir_periodo` | El `Periodo` completo, ya releído. |

- **Reabrir exige `motivo`** de 10 a 200 caracteres (queda en la auditoría). Sin motivo o con menos de 10 → `400` / `20001`. Al cerrar, el `motivo` se ignora.
- Cerrar una quincena ya cerrada, o reabrir una ya abierta → `409` / `20010`.
- `estado` distinto de `ABIERTA`/`CERRADA` → `400` / `20001` con `fields: {"estado": …}`.
- Un OPERATIVO recibe `403` / `20008` en cualquiera de las dos escrituras.
- Quedaron **eliminadas** las rutas viejas `POST /periodos/{id}/cerrar`, `POST /periodos/{id}/reabrir` y `GET /periodos/resultado`; el resultado ya viene dentro de cada `Periodo`.

## Errores

```json
{ "code": 20008, "message": "Operacion reservada al rol ADMIN.", "support_ref": 9 }
```

`support_ref` solo aparece si el error quedó en `log_errores` (numérico). En validaciones de forma (`20001`) viene además `fields`: `{ "campo": "motivo" }`.

| `code` | HTTP | Cuándo |
|---|---|---|
| 20001 | 400 | Datos inválidos, JSON mal formado, `sort`/`page`/`size` inválidos |
| 20016 | 409 | `Idempotency-Key` repetida mientras la primera solicitud sigue en proceso |
| 20017 | 422 | `Idempotency-Key` ya usada con una solicitud distinta |
| 20013 | 401 | No autenticado: sin token, token vencido o alterado, **usuario desactivado o con otro rol del que dice el token (se verifica en segundos)**, credenciales incorrectas, código MFA incorrecto |
| 20014 | 423 | Cuenta bloqueada temporalmente (el `message` dice cuántos minutos) |
| 20015 | 429 | Demasiados intentos; esperar un minuto |
| 20004 | 409 | La quincena de la fecha está CERRADA (lo lanzan las escrituras de otros módulos; Períodos no lo produce) |
| 20006 | 409 | Duplicado (documento o SKU) o la unidad no puede cambiarse |
| 20007 | 404 | La entidad no existe (también: no hay quincena creada para hoy en `/periodos/actual`) |
| 20008 | 403 | Rol insuficiente o sin sesión |
| 20009 | 409 | No existe una quincena para la fecha (hay que crear los períodos del año) |
| 20010 | 409 | Estado inválido: cerrar una quincena ya cerrada, o reabrir una ya abierta |
| 20018 | 422 | **Archivos:** el contenido de un archivo subido no se admite (tipo, extensión que no corresponde, antivirus, PDF con contenido activo, imagen demasiado grande…). El `message` es apto para mostrarse tal cual |
| 20018 | 413 | **Archivos:** el archivo supera el tamaño máximo (11 MB en la solicitud; 10 MB de contenido) |
| 20019 | 503 | **Archivos:** el antivirus o Google Drive no están disponibles / no están conectados, o el archivo guardado no pasa la verificación de integridad. El `message` dice qué |
| 20999 | 500 | Fallo interno; `support_ref` apunta a `log_errores` |

(También existen 20002, 20003, 20005, 20011 y 20012, que no aplican a Catálogos, Períodos, Autenticación ni Usuarios.)

> **Nota sobre `support_ref`:** el archivo `api-error.ts` del dashboard lo llama `supportRef` (camelCase), y como el API entero es snake_case, el JSON trae `support_ref`. El interceptor de errores debe leer `support_ref`.

## Cómo probarlo a mano

```bash
cd ~/sila-backend && ./arrancar.sh        # modo jwt (login real). Las llamadas necesitan Authorization: Bearer <token>
curl -s 'localhost:8080/api/v1/catalogos/productos?size=2&sort=stock,desc'
curl -s -X PUT localhost:8080/api/v1/catalogos/productos/3 \
     -H 'Content-Type: application/json' -H 'X-Usuario: kevin.test' -H 'X-Rol: OPERATIVO' \
     -d '{"nombre":"Leche entera bolsa 900ml","unidad_medida":"UND"}'
```


### Acciones sensibles: segundo factor otra vez

Con la sesión ya abierta, **cambiar la clave, regenerar los códigos de respaldo y editar mis datos** vuelven a pedir el código de la app de autenticación (o uno de respaldo; si se usa uno de respaldo se consume). Cada código de 6 dígitos sirve una sola vez: si el usuario acaba de usar el mismo en el login, el backend responde `401 "Ese codigo ya fue usado. Espere el siguiente."` (esperar ≤30 s). Un código incorrecto cuenta como intento fallido y **a los 5 la cuenta se bloquea 15 min (423)**. Límite: 10 intentos de código por minuto (429).

## Cuentas con los lecheros y cuentas de la quincena

Todos los montos son pesos (COP). Cada recepción de leche **fija** `precio_litro` (el vigente el día de la entrega, o el parámetro
`PRECIO_LECHE_DEFAULT` si el lechero no tiene precio) y `valor_total = litros × precio` (**0 si fue RECHAZADA**). Cambiar un precio solo
afecta recepciones futuras. La leche se paga **por quincena**: cada pago liquida una quincena (`id_periodo_liquidado`) y no puede superar su saldo.

| Ruta | Rol | Cuerpo / filtros | Respuesta |
|---|---|---|---|
| `GET /acopio/precios` | cualquiera | `id_proveedor`, `solo_vigentes`, Page | `PrecioProveedor {id_precio, id_proveedor, proveedor, precio_litro, vigente_desde, vigente, ...}` |
| `POST /acopio/precios` | ADMIN | `{id_proveedor, precio_litro (0.01–20000), vigente_desde?}` | `201 PrecioProveedor` |
| `GET /acopio/saldos` | cualquiera | `solo_con_saldo`, Page (orden por defecto `saldo,desc`) | `SaldoProveedor {id_proveedor, proveedor, activo, precio_vigente, litros_aprobados, total_comprado, total_pagado, saldo, ultima_entrega, ultimo_pago}` |
| `GET /acopio/pago-lecheros` | cualquiera | `id_periodo`, `anio`, `id_proveedor`, Page | ahora trae `valor_leche, valor_pagado, saldo, precio_promedio` además de los litros |
| `GET /acopio/pagos` | cualquiera | `id_proveedor`, `id_periodo` (quincena en que se pagó), `id_periodo_liquidado` (quincena que se pagó), `estado`, Page | `PagoProveedor {id_pago, proveedor, id_periodo, id_periodo_liquidado, anio, mes, quincena, fecha_pago, monto, metodo_pago, referencia_pago, estado VIGENTE/ANULADO, motivo_anulacion, ...}` |
| `POST /acopio/pagos` | ADMIN, `Idempotency-Key` | `{id_proveedor, id_periodo_liquidado, monto, metodo_pago EFECTIVO/TRANSFERENCIA/CHEQUE/OTRO, referencia_pago?, fecha_pago?}` | `201 PagoProveedor`. `400/20005` si `monto` > saldo de esa quincena; `409` si la quincena de `fecha_pago` está CERRADA; no se paga una quincena que aún no empieza |
| `POST /acopio/pagos/{id}/anular` | ADMIN, `Idempotency-Key` | `{motivo}` (10–255) | `PagoProveedor` ANULADO. `409` si ya estaba anulado o su quincena está cerrada |

`GET /acopio/recepciones` ahora incluye `precio_litro` y `valor_total`.

### Quincena (`GET /periodos`, `/periodos/{id}`, `/periodos/actual`)

Además de `ingresos_ventas, costo_produccion, gastos_operativos, cartera_castigada, resultado_estimado`, cada período trae:

| Campo | Qué es |
|---|---|
| `iva_ventas`, `total_vendido` | IVA de las ventas y total con IVA (no anuladas). `ingresos_ventas` es **sin** IVA |
| `ventas_contado`, `ventas_credito` | total vendido según el tipo de venta |
| `cobrado_contado` | pagos recibidos de ventas de contado de la quincena |
| `cobrado_abonos` | abonos de cartera recibidos **en** la quincena (de cualquier venta) |
| `total_cobrado` | cobrado_contado + cobrado_abonos |
| `cartera_pendiente` | lo que aún deben los clientes de las ventas de esta quincena |
| `leche_litros`, `leche_litros_rechazados` | litros aprobados y rechazados recibidos |
| `leche_comprada` | valor de la leche aprobada (litros × precio) |
| `leche_pagada` | pagos vigentes que liquidan la leche de esta quincena |
| `leche_por_pagar` | leche_comprada − leche_pagada |
| `pagos_proveedores_caja` | pagos hechos **durante** la quincena (de cualquier quincena de leche) |
| `caja_neta` | total_cobrado − pagos_proveedores_caja − gastos_operativos |

Dos miradas distintas, que la pantalla debe rotular sin mezclar:
- **Resultado (devengado)** = `resultado_estimado` = ingresos_ventas − costo_produccion − gastos_operativos − cartera_castigada. Es lo que la quincena ganó, se haya cobrado o pagado o no.
- **Caja** = `caja_neta`. Es la plata que realmente entró y salió.
`leche_comprada` NO resta en el resultado (el costo de la leche entra por `costo_produccion`, al producir); se muestra aparte para saber cuánto se debe a los lecheros.

## Insumos, recetas y costo del lote

Los **insumos** (azúcar, envases…) tienen stock y **costo promedio ponderado**: cada compra lo recalcula. Cada producto puede
tener una **receta**: cuánto de cada insumo gasta UNA unidad del producto, en la unidad del insumo. Al registrar un lote, el
backend descuenta los insumos de la receta (si falta stock responde 409/20002 con el nombre del insumo y no crea nada) y suma su
costo al del lote: `costo_total = costo_leche + costo_insumos`. El costo queda congelado en el lote aunque el precio cambie después.

Roles: crear/editar/activar insumos, **comprar**, **anular compras**, corregir stock y **definir recetas** = ADMIN.
`MERMA`, `DANO`, `VENCIMIENTO` = OPERATIVO. Registrar lotes sigue siendo OPERATIVO. `Idempotency-Key` obligatoria en
`POST /insumos/compras` y `POST /insumos/ajustes`.

| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| GET | `/insumos` | todos | `Page<Insumo>`; filtros `texto`, `activo`, `bajo_minimo=true`; sort: `codigo, nombre, stock_actual, costo_promedio, valor_inventario` |
| GET | `/insumos/resumen` | todos | `{total_insumos, bajo_minimo, valor_total}` (solo activos) |
| GET | `/insumos/{id}` | todos | un insumo |
| POST | `/insumos` | ADMIN | `{codigo, nombre, unidad_medida, stock_minimo}` → 201. Nace con stock 0 y costo 0 |
| PUT | `/insumos/{id}` | ADMIN | `{nombre, unidad_medida, stock_minimo}`; la unidad no cambia si ya tiene movimientos o está en recetas (409/20006) |
| PATCH | `/insumos/{id}/estado` | ADMIN | `{activo}`; no se desactiva si está en la receta de un producto activo (409/20006) |
| GET | `/insumos/compras` | todos | `Page<Compra>`; filtros `id_insumo, id_proveedor, estado (VIGENTE/ANULADA), desde, hasta` |
| POST | `/insumos/compras` | ADMIN | `{id_insumo, id_proveedor?, cantidad, valor_total, referencia?, fecha?}` → 201. `valor_total` es lo de la factura; el costo unitario se calcula. El proveedor, si va, debe ser tipo INSUMOS |
| POST | `/insumos/compras/{id}/anular` | ADMIN | `{motivo}` (10–255). Solo si el stock alcanza para devolver lo comprado (409/20002) |
| GET | `/insumos/ajustes` | todos | `Page<AjusteInsumo>`; filtros `id_insumo, tipo_ajuste, desde, hasta` |
| POST | `/insumos/ajustes` | ver arriba | `{id_insumo, tipo_ajuste, cantidad, observacion}`; `cantidad` siempre positiva. Tipos: `MERMA, DANO, VENCIMIENTO` (restan, OPERATIVO), `CORRECCION_MAS, CORRECCION_MENOS` (ADMIN → si no, 403/20008) |
| GET | `/insumos/consumos?id_lote=` | todos | lista (no paginada) de lo que gastó el lote, con costo congelado |
| GET | `/catalogos/productos/{id}/receta` | todos | `Receta` (ver abajo) |
| PUT | `/catalogos/productos/{id}/receta` | ADMIN | `{"lineas":[{"id_insumo":1,"cantidad":0.5}]}` reemplaza la receta completa; `[]` la vacía. Duplicados → 400, insumo inexistente → 404 |
| POST | `/catalogos/productos` | ADMIN | ahora acepta `receta` opcional (`[{id_insumo, cantidad}]`). Son dos pasos en la base: si la receta falla, **el producto ya existe** y el mensaje lo dice; corregir con el PUT |

```jsonc
// Insumo
{ "id_insumo": 1, "codigo": "AZUCAR", "nombre": "Azúcar", "unidad_medida": "KG", "costo_promedio": 5000,
  "stock_actual": 20, "stock_minimo": 5, "valor_inventario": 100000, "bajo_minimo": false,
  "productos_que_lo_usan": 2, "activo": true, "fecha_creacion": "...", "usuario_creacion": "..." }

// Receta (GET/PUT /catalogos/productos/{id}/receta)
{ "id_producto": 7, "codigo_sku": "AREQUIPE", "producto": "Arequipe 250 g",
  "lineas": [ { "id_insumo": 1, "codigo_insumo": "AZUCAR", "insumo": "Azúcar", "unidad_insumo": "KG",
                "cantidad_por_unidad": 0.5, "costo_unitario_insumo": 5000, "valor_por_unidad": 2500,
                "stock_insumo": 20, "insumo_activo": true } ],
  "costo_insumos_unitario": 2700,   // lo que cuestan los insumos de UNA unidad (al costo promedio de hoy)
  "unidades_posibles": 40 }         // cuántas unidades alcanza a producir el stock actual (null si no hay receta)
```

Cambios en respuestas existentes:
- **Lote** (`/produccion/lotes`): campos nuevos `costo_insumos` y `costo_leche`; `costo_total` = suma de ambos.
- **Período** (`/periodos`): campo nuevo `compras_insumos` (compras vigentes de la quincena). **`caja_neta` ahora también resta las compras de insumos**
  (se asume que se pagan al comprar). El resultado devengado no cambia de fórmula: los insumos entran por `costo_produccion` al producir.
- Códigos: falta de stock de un insumo al producir = `409` / `20002`, con mensaje «Falta <insumo>: se necesitan X y hay Y.».

## Gastos operativos y documentos

Todo bajo `/api/v1`. JSON snake_case, fechas `yyyy-MM-dd`, `fecha_registro`/`fecha_carga` en UTC sin zona.

### Gastos — `/finanzas/gastos`
| Método | Ruta | Rol | Notas |
|---|---|---|---|
| GET | `/finanzas/gastos` | cualquiera | `Page<Gasto>` (incluye anulados). Filtros: `id_periodo`, `id_categoria`, `texto` (concepto, sin tildes), `estado` (VIGENTE/ANULADO), `desde`, `hasta`. Orden: `id_gasto`, `fecha_gasto` (defecto desc), `categoria`, `monto`, `concepto`, `fecha_registro` |
| GET | `/finanzas/gastos/resumen` | cualquiera | `{total, cantidad}` de los gastos **VIGENTES** con los mismos filtros (sin paginación; los anulados no suman) |
| GET | `/finanzas/gastos/por-categoria` | cualquiera | lo que antes era `GET /finanzas/gastos` (lista simple por quincena y categoría; `id_periodo` opcional) |
| GET | `/finanzas/gastos/{id}` | cualquiera | 404/20007 si no existe |
| POST | `/finanzas/gastos/{id}/anular` | ADMIN | **`Idempotency-Key` obligatoria.** `{motivo (10-255)}` → 200 con el `Gasto` en estado ANULADO. 404/20007, 409/20010 si ya estaba anulado, 409/20004 si su quincena está cerrada |
| POST | `/finanzas/gastos` | OPERATIVO+ | **`Idempotency-Key` obligatoria.** Cuerpo `{id_categoria, concepto (3-255), monto (>0, 2 decimales), fecha_gasto?}`; sin fecha = hoy en Colombia (no futura). 201 con el `Gasto` |

`Gasto`: `id_gasto, id_periodo, anio, mes, quincena, id_categoria, categoria, fecha_gasto, concepto, monto, usuario_registro, fecha_registro, estado (VIGENTE|ANULADO), motivo_anulacion, usuario_anulacion, fecha_anulacion`.
Errores: 404/20007 categoría inexistente, 409/20006 categoría inactiva, 409/20004 quincena cerrada. **Un gasto no se edita ni se borra**
(la base lo impide): si se digitó mal, ADMIN lo **anula** con motivo y se registra el correcto. Un gasto anulado deja de sumar en `/finanzas/gastos/resumen`, `/por-categoria`,
`GET /periodos` (resultado y caja) y se conserva en la lista con su motivo.

### Documentos (cola de Google Drive) — `/documentos`
El backend solo lleva el registro y el estado; la subida real a Drive la hace quien llama y reporta el resultado.
| Método | Ruta | Rol | Notas |
|---|---|---|---|
| GET | `/documentos` | cualquiera | `Page<Documento>`. Filtros: `tipo_entidad`, `id_entidad`, `estado_carga` (PENDIENTE/SUBIDO/ERROR). Orden: `id_documento`, `tipo_entidad`, `nombre_archivo`, `estado_carga`, `fecha_registro` (defecto desc), `fecha_carga` |
| GET | `/documentos/pendientes` | cualquiera | cola PENDIENTE+ERROR sin paginar (`?estado=`) |
| GET | `/documentos/{id}` | cualquiera | 404/20007 |
| POST | `/documentos` | OPERATIVO+ | `{tipo_entidad: FACTURA|NOTA_CREDITO|RECEPCION_LECHE, id_entidad, nombre_archivo, mime_type?}` (defecto `application/pdf`). 201 PENDIENTE. 404/20007 si la entidad no existe |
| POST | `/documentos/{id}/subido` | OPERATIVO+ | `{drive_file_id, drive_url?, checksum_sha256? (64 hex)}` → SUBIDO. 409/20010 si ya estaba subido |
| POST | `/documentos/{id}/error` | OPERATIVO+ | `{mensaje}` → ERROR, suma un intento; sigue en la cola. 409/20010 si ya estaba subido |

Las tres escrituras exigen `Idempotency-Key`. `Documento`: `id_documento, tipo_entidad, id_entidad, nombre_archivo, mime_type, drive_url, checksum_sha256, estado_carga, intentos, ultimo_error, usuario_carga, fecha_registro, fecha_carga`.

## Notificaciones y stock mínimo

**`GET /api/v1/notificaciones`** (cualquier usuario autenticado) → `{ total, criticas, items: Notificacion[] }`, máximo 100, críticas primero.
Las alertas se **calculan al consultar**: no se guardan y desaparecen solas cuando el problema se resuelve. «Marcar como leídas» lo resuelve el cliente guardando las `clave` vistas (localStorage); una alerta nueva trae una `clave` que no está en ese conjunto.

`Notificacion = { clave, tipo, severidad: 'CRITICA'|'ADVERTENCIA', titulo, detalle, entidad, id_entidad, fecha }` (`fecha` e `id_entidad` pueden ser null).

| `tipo` | Cuándo | `entidad` (a dónde llevar) |
|---|---|---|
| `INSUMO_AGOTADO` (crítica) / `INSUMO_BAJO` | insumo activo con `stock_minimo` > 0 y stock = 0 / ≤ mínimo | `INSUMO` |
| `PRODUCTO_AGOTADO` (crítica) / `PRODUCTO_BAJO` | igual, para productos terminados | `PRODUCTO` |
| `LOTE_VENCIDO` / `LOTE_POR_VENCER` | lote con ≤ 7 días (hasta 30 vencido) y el producto aún tiene stock; crítica si ≤ 2 días | `LOTE` |
| `CARTERA_VENCIDA` | por cliente; crítica si la mora supera 30 días | `CLIENTE` |
| `CARTERA_POR_VENCER` | por cliente, vence en los próximos 3 días | `CLIENTE` |
| `PERIODO_SIN_CERRAR` | quincena terminada que sigue abierta | `PERIODO` |
| `LECHE_POR_PAGAR` | quincena terminada con saldo pendiente a lecheros | `PERIODO` |
| `DOCUMENTOS_ERROR` | documentos que fallaron al subir (una sola fila con el conteo) | `DOCUMENTO` |

**Stock mínimo de productos:** `Producto` ahora trae `stock_minimo` y `bajo_minimo` (boolean; 0 = sin alerta). Se fija con `PATCH /catalogos/productos/{id}/stock-minimo` `{stock_minimo}` (**ADMIN**, 0 a 99.999.999, 3 decimales) o con el campo opcional `stock_minimo` en `POST /catalogos/productos` y `PUT /catalogos/productos/{id}` (en el PUT exige ADMIN solo si el campo viene; `null` = no cambia). Los insumos ya tenían `stock_minimo` y `bajo_minimo`.

**Categoría de gasto INSUMOS desactivada:** las compras de ingredientes y empaques se registran en Insumos (si no, la misma compra se contaba en la caja y en el resultado dos veces). Ya no aparece al registrar gastos.

## Comprobantes

Vista unificada **de solo lectura** de todos los movimientos de plata. **No son facturas DIAN** (no llamarlos «factura» en la pantalla): son el documento interno de cada movimiento. Cualquier usuario autenticado. No hay tabla nueva: sale de `vw_comprobantes`, que une ventas, abonos, pagos a lecheros, compras de insumos y gastos.

`Comprobante = { tipo, id_documento, numero, sentido, afecta_caja, fecha, monto, id_tercero, tercero_tipo, tercero, descripcion, metodo_pago, referencia, estado, motivo_anulacion, id_periodo, usuario_registro }`

- `tipo`: `VENTA` | `ABONO` | `PAGO_LECHERO` | `COMPRA_INSUMO` | `GASTO`. `numero` = `"VENTA #123"` (tipo + `#` + `id_documento`); el abono se numera por **recibo** (un recibo agrupa los abonos de un pago: `ABONO #id_recibo`).
- `sentido`: `INGRESO` (venta, abono) | `EGRESO` (pago a lechero, compra de insumos, gasto). `afecta_caja`: `false` solo en la venta **a crédito** (la plata entra con los abonos).
- `estado`: `VIGENTE` | `ANULADO` (con `motivo_anulacion`). `tercero_tipo`: `CLIENTE` | `PROVEEDOR` | null (el gasto no tiene tercero). `metodo_pago` puede ser `VARIOS` (venta de contado con varios medios) o null.

| Endpoint | Detalle |
|---|---|
| `GET /comprobantes` | `Page<Comprobante>`. Filtros: `tipo`, `sentido`, `estado`, `id_periodo`, `texto` (número, tercero, descripción o referencia; sin tildes), `desde`, `hasta` (ISO). `sort`: `fecha` (por defecto desc), `monto`, `tipo`, `numero`, `tercero`, `estado`, `sentido`. Valor inválido en `tipo`/`sentido`/`estado`/`sort` → `400`. |
| `GET /comprobantes/resumen` | `{ ingresos, egresos, neto, cantidad }` con los mismos filtros (menos `estado`): solo **VIGENTES**; los ingresos cuentan solo lo que mueve caja. |
| `GET /comprobantes/{tipo}/{id}` | `{ comprobante, lineas: [{concepto, cantidad, valor_unitario, valor}], pagos: [{metodo_pago, monto, referencia}], subtotal, iva }` — `subtotal` e `iva` solo en VENTA (null en los demás). Para ABONO el `id` es el `id_recibo`. `404` si no existe, `400` si el tipo es inválido. |

## Tablero

Pantalla de inicio. **Un solo endpoint de solo lectura**, igual para OPERATIVO y ADMIN (los dos ven todas las cifras). No hay tabla ni vista nueva: el backend lee vistas que ya existen (ventas, comprobantes, recepciones, lotes, cartera, inventario, insumos, saldo de lecheros, notificaciones y cuentas de la quincena) en una consulta de indicadores y tres más pequeñas. «Hoy» es el día en Colombia. Las ventas **ANULADAS no suman**.

`GET /tablero` →

```json
{
  "fecha": "2026-10-14",
  "hoy": { "ventas_total": 423114.24, "ventas_cantidad": 12, "ventas_contado": 406000, "ventas_credito": 17114.24,
           "caja_ingresos": 423114.24, "caja_egresos": 650000, "caja_neta": -226885.76,
           "litros_recibidos": 300, "litros_rechazados": 20, "lotes_producidos": 2 },
  "quincena": { "id_periodo": 19, "anio": 2026, "mes": 10, "quincena": 1, "fecha_inicio": "2026-10-01", "fecha_fin": "2026-10-15",
                "estado": "ABIERTA", "ingresos_ventas": 0, "total_vendido": 0, "total_cobrado": 0, "costo_produccion": 0,
                "gastos_operativos": 0, "cartera_castigada": 0, "resultado_estimado": 0, "caja_neta": 0,
                "leche_litros": 0, "leche_por_pagar": 0 },
  "cartera": { "saldo_total": 0, "saldo_vencido": 0, "clientes_con_saldo": 0, "clientes_en_mora": 0 },
  "inventario": { "valor_productos": 0, "productos_bajo_minimo": 0, "productos_agotados": 0,
                  "valor_insumos": 0, "insumos_bajo_minimo": 0, "lotes_por_vencer": 0 },
  "lecheros": { "saldo_por_pagar": 0, "proveedores_con_saldo": 0 },
  "alertas": { "total": 3, "criticas": 1, "principales": [ /* Notificacion, máx. 5, críticas primero */ ] },
  "ventas_semana": [ { "fecha": "2026-10-08", "total": 0, "cantidad": 0 }, "… 7 filas, la última es hoy" ]
}
```

- **`hoy.caja_*`**: lo que entró y salió de caja hoy (como `/comprobantes/resumen` del día): la venta a crédito no entra, los abonos sí; los egresos son pagos a lecheros, compras de insumos y gastos. `caja_neta` puede ser negativa.
- **`hoy.ventas_total`** = `ventas_contado + ventas_credito` (con IVA). `litros_recibidos` son solo los aprobados; los rechazados van aparte.
- **`quincena`**: la que contiene hoy, con las mismas cifras de `GET /periodos` (`resultado_estimado`, `caja_neta`, `leche_por_pagar`…). Es **`null`** si hoy no cae en ninguna quincena creada: mostrar un aviso («No hay quincena creada para hoy» con enlace a Períodos para el ADMIN).
- **`cartera`**: `saldo_total` = lo que deben los clientes activos; `saldo_vencido` = saldo de ventas pendientes con vencimiento antes de hoy; `clientes_en_mora` = clientes con estado de crédito `EN_MORA`.
- **`inventario`**: `valor_productos` a precio de venta (stock × precio base); `valor_insumos` a costo promedio. `lotes_por_vencer` = lotes que vencen en 7 días o menos y aún no vencieron.
- **`lecheros.saldo_por_pagar`**: lo que se debe a los lecheros en total (histórico, no solo esta quincena; el de la quincena es `quincena.leche_por_pagar`).
- **`alertas`**: `total` y `criticas` son los mismos de `GET /notificaciones` (la campana); `principales` trae las 5 primeras con el mismo formato.
- **`ventas_semana`**: siempre 7 filas en orden, de hace 6 días a hoy; los días sin ventas vienen en 0 (sirve directo para una gráfica de barras).
- Es una foto al momento: refrescar al entrar a la pantalla y, si se quiere, cada 1–2 minutos mientras esté abierta (no más seguido).

## Passkeys: Face ID / huella como segundo factor

Una **passkey** reemplaza los 6 dígitos de la app en el paso de segundo factor del login. **La biometría nunca sale del teléfono**: el teléfono guarda una llave privada en su chip seguro y Face ID / huella solo la desbloquea para firmar un desafío; el servidor guarda la **llave pública** y verifica la firma. El TOTP y los códigos de respaldo **siguen sirviendo** (son el rescate).

- **Requisitos:** la persona debe tener el segundo factor (app de autenticación) **activo**; agregar un dispositivo pide el código de la app o uno de respaldo. Máximo 10 dispositivos por persona. Si un ADMIN **restablece el segundo factor** de alguien, sus passkeys se borran.
- **Dominio:** la llave queda ligada al dominio desde el que se registró (RP ID = host del origen). Una passkey registrada en `localhost` no sirve en ngrok, ni la de ngrok en el dominio definitivo: al migrar hay que volver a registrarla. El backend acepta los orígenes de `SILA_CORS_ORIGENES`.
- **Formato de las opciones:** `POST …/opciones` devuelve **tal cual** el JSON del estándar WebAuthn, en **camelCase** (excepción al snake_case del resto del API): `{ "publicKey": { challenge, rp, user, … } }` con binarios en base64url. Pasa `publicKey` a `PublicKeyCredential.parseCreationOptionsFromJSON()` / `parseRequestOptionsFromJSON()` y envía `credencial = cred.toJSON()` (si el navegador no los tiene, convertir base64url ↔ ArrayBuffer a mano).

| Endpoint | Token | Cuerpo | Respuesta |
|---|---|---|---|
| `POST /auth/passkey/opciones` | temporal `mfa` | — | `{publicKey}` para `navigator.credentials.get()`. `409` si la persona no tiene passkeys. |
| `POST /auth/passkey/verificar` | temporal `mfa` | `{credencial}` | Igual que `/mfa/verificar`: `OK` + `access_token` + cookie (o `CAMBIAR_CLAVE`). Firma inválida → `401` (cuenta como intento fallido y puede bloquear la cuenta → `423`). Desafío vencido (3 min) o ya usado → `409`. |
| `GET /auth/passkeys` | acceso | — | `[{id_passkey, nombre, fecha_creacion, fecha_ultimo_uso}]` (UTC sin zona). |
| `POST /auth/passkeys/opciones` | acceso | `{codigo}` (6 dígitos o respaldo) | `{publicKey}` para `navigator.credentials.create()`. Sin código → `400`; código malo → `401`; sin segundo factor activo → `409`. |
| `POST /auth/passkeys` | acceso | `{nombre, credencial}` (nombre 1–60) | `201` `{id_passkey, nombre, fecha_creacion, fecha_ultimo_uso}`. Desafío vencido/usado, dispositivo repetido o tope de 10 → `409`; credencial inválida → `400`. |
| `DELETE /auth/passkeys/{id}` | acceso | `{codigo}` (6 dígitos o respaldo; **cuerpo JSON en el DELETE**) | `204`; `400` sin código; `401` código malo; `404` si no existe o no es mía. Quitar un dispositivo es una acción sensible igual que agregarlo. |

- **En el login:** la respuesta `MFA_REQUERIDO` trae ahora **`passkey_disponible`** (`true`/`false`). Si es `true` y el navegador lo soporta, ofrecer primero «Entrar con Face ID / huella», y dejar el código de 6 dígitos y el de respaldo como alternativas.
- Un origen que no esté permitido → `403`. Todo queda en la bitácora de accesos: `PASSKEY_REGISTRADA`, `PASSKEY_USADA`, `PASSKEY_FALLIDA`, `PASSKEY_QUITADA`.
- Las **acciones sensibles** (cambiar clave, editar perfil, regenerar códigos) siguen pidiendo el código de la app o de respaldo; todavía no aceptan passkey.

## Archivos

Gestor de archivos. Hay **dos clases** de archivo, las dos cifradas en el servidor (AES-256-GCM) y con una copia, también cifrada, en Google Drive:

- **PDF de comprobantes** (`origen = COMPROBANTE`): los genera el sistema, **una sola vez**, al registrar una venta, un abono (recibo), un pago a lechero, una compra de insumos o un gasto; **nadie los sube ni los edita**. Quedan congelados (huella SHA-256). Si el movimiento se **anula**, el original NO se toca: se crea un **segundo PDF** (`version = ANULADO`) con la marca de agua «ANULADO», el motivo, quién y cuándo, y apunta al original (`id_documento_original`). Son comprobantes internos, **no facturas**. Los movimientos **anteriores** a esta función no tienen PDF: `GET /archivos/comprobante/{tipo}/{id}` devuelve `[]`.
- **Archivos del ADMIN** (`origen = ADMIN`, `tipo_entidad = ARCHIVO`): PDF, JPG o PNG hasta **10 MB**, que sube solo el ADMIN a «Mis carpetas». No se borran: se **archivan** con motivo.

**Permisos:** ADMIN y OPERATIVO **ven y descargan todo** (comprobantes y archivos, también los archivados). **Solo ADMIN** sube, archiva, crea/archiva carpetas, ve la bitácora y maneja Drive. Cada ver/descargar/descifrar queda en la bitácora (usuario, IP, navegador, y el **tipo** de clave usado; la clave nunca se guarda).

> **No mandes `Idempotency-Key` en `/archivos/**`** (cuerpos y respuestas binarios; el backend la ignora aquí). Todas las respuestas binarias llevan `Cache-Control: no-store`.

### El objeto `Archivo`

`{ id_documento, origen, tipo_entidad, id_entidad, version, id_documento_original, nombre_archivo, mime_type, tamano_bytes, checksum_sha256, id_carpeta, carpeta, archivado, motivo_archivo, usuario_archivo, fecha_archivo, estado_drive, fecha_drive, usuario_carga, fecha_registro, fecha, numero, sentido, monto, id_tercero, tercero_tipo, tercero, estado_comprobante, id_periodo, anio, mes, quincena }`

- `tipo_entidad`: `VENTA` | `ABONO` (`id_entidad` = id del recibo) | `PAGO_LECHERO` | `COMPRA_INSUMO` | `GASTO` | `ARCHIVO`. `version`: `ORIGINAL` | `ANULADO`.
- `fecha`: la del comprobante (día de Colombia) o, en archivos subidos, el día en que se subieron. `numero`, `sentido`, `monto`, `tercero*`, `estado_comprobante` (`VIGENTE` | `ANULADO`), `id_periodo`, `anio`, `mes`, `quincena`: solo en comprobantes (null en archivos del ADMIN). `carpeta`/`id_carpeta`: solo en archivos del ADMIN.
- `estado_drive`: `PENDIENTE` | `SUBIDO` | `ERROR` (copia de respaldo). `mime_type`: `application/pdf` | `image/jpeg` | `image/png`. Nunca viene la ruta interna del archivo.

### Explorador de carpetas

`GET /archivos/explorador?arbol=…&ruta=…&ruta=…&incluir_archivados=false&page&size&sort` → `Explorador = { arbol, ruta: [Entrada], carpetas: [Entrada], archivos: Page<Archivo>, puede_subir }`, con `Entrada = { clave, nombre, cantidad }`.

- **Sin `arbol`**: la raíz. `carpetas` = 4 entradas: `TIPO` («Por tipo»), `CLIENTE` («Por cliente»), `PROVEEDOR` («Por proveedor») y `MANUAL` («Mis carpetas»), cada una con su `cantidad` de archivos.
- **`ruta`** (parámetro repetido) es el camino de **claves** (`Entrada.clave`) desde el árbol hasta la carpeta; para bajar un nivel se agrega la `clave` elegida. `ruta` devuelve las migas de pan con sus nombres.

| `arbol` | Niveles (cada uno es una `ruta`) | Qué hay en el último nivel |
|---|---|---|
| `TIPO` | tipo (`VENTA`, `ABONO`…) → año (`2026`) → quincena (`10-1` = «Octubre - quincena 1») | los PDF de ese tipo y quincena |
| `CLIENTE` | cliente (`id`) → año | los PDF de ese cliente en el año (ventas y abonos) |
| `PROVEEDOR` | proveedor (`id`) → año | pagos a lecheros y compras de ese proveedor |
| `MANUAL` | carpetas anidadas (cada `ruta` es un `id_carpeta`, máx. 5 niveles; sin `ruta` = raíz de «Mis carpetas») | los archivos del ADMIN de esa carpeta |

Los árboles `TIPO`, `CLIENTE` y `PROVEEDOR` son **virtuales y de solo lectura**: un mismo PDF aparece en varios (no se duplica) y no se pueden crear carpetas ahí. Una carpeta virtual sin archivos no existe (`404`). `archivos` viene vacío mientras la carpeta solo contiene otras carpetas. `puede_subir` es `true` solo en `MANUAL` y si quien consulta es ADMIN. `ruta` inválida o más profunda que el árbol → `400`; en `MANUAL`, una `ruta` que no encadena carpetas → `400`. Las compras de insumos sin proveedor y los gastos solo aparecen en `TIPO`.

### Lecturas y descargas

| Endpoint | Detalle |
|---|---|
| `GET /archivos` | `Page<Archivo>` plano. Filtros: `origen` (`COMPROBANTE`/`ADMIN`), `tipo` (`tipo_entidad`), `version`, `archivado` (bool), `estado_drive`, `id_carpeta`, `texto` (nombre, número o tercero), `desde`, `hasta` (ISO). `sort`: `fecha` (por defecto desc), `nombre`, `tamano`, `monto`, `tercero`, `numero`, `fecha_registro`, `id`. |
| `GET /archivos/{id}` | `Archivo`. `404` si no existe. |
| `GET /archivos/comprobante/{tipo}/{id}` | Los PDF de un comprobante: `[]`, `[ORIGINAL]` o `[ORIGINAL, ANULADO]`. Para ABONO el `id` es el recibo. Úsalo para el botón «Ver PDF» de la pantalla Comprobantes. `400` si el `tipo` es inválido. |
| `GET /archivos/{id}/contenido` | **Ver**: los bytes tal cual (`Content-Type` real). Queda en bitácora (`VER`). |
| `GET /archivos/{id}/opciones-descarga` | `{ documento_disponible, motivo_no_disponible, tercero, tercero_tipo, pista_clave_documento, clave_min, clave_max, es_imagen }`. `documento_disponible` es `false` si el archivo no tiene cliente/proveedor (gastos, archivos subidos), si es CONSUMIDOR FINAL o si el tercero no tiene un documento usable; `motivo_no_disponible` dice por qué. `pista_clave_documento` es el documento enmascarado (`900***567`). |
| `POST /archivos/{id}/descarga` | **Copia protegida con clave** (PDF AES-256). Cuerpo `{ "modo_clave": "DOCUMENTO" \| "ESCRITA" \| "ALEATORIA", "clave": "…" }`. Responde los bytes de un **PDF** (una imagen se envuelve en un PDF de una página). Queda en bitácora (`DESCARGAR` + `modo_clave`). Ver abajo. |

**Modos de clave:** `DOCUMENTO` = el número de documento del cliente/proveedor **solo letras y dígitos, en mayúsculas** (`900.123.456-7` → `9001234567`); `ESCRITA` = la que escribe quien descarga (4 a 64 caracteres, va en `clave`); `ALEATORIA` = el backend genera una de 12 caracteres (`K7MQ-4XPD-9TRB`) y la devuelve **una sola vez** en la cabecera **`X-Clave-Generada`** de la respuesta (mostrarla con botón «Copiar» y avisar que no se puede volver a ver). `DOCUMENTO` sin documento usable → `409` con el motivo; `ESCRITA` fuera de largo → `400` (campo `clave`); otro valor de `modo_clave` → `400`. Texto de ayuda recomendado: «Mande el PDF y la clave por canales distintos (por ejemplo, el PDF por correo y la clave por WhatsApp)».

**Cabeceras de las respuestas binarias:** `Content-Type`, `Content-Disposition: attachment; filename="…"; filename*=UTF-8''…`, `X-Archivo-Id`, `X-Archivo-Nombre` (nombre con %-codificación), `X-Clave-Generada` (solo en ALEATORIA). CORS ya las expone. Lee el cuerpo con `responseType: 'blob'`; la **URL del blob** (`URL.createObjectURL`) se libera con `revokeObjectURL` al cerrar. Los errores de estas rutas siguen siendo JSON `{code, message}`: si pides un blob y el estado no es 2xx, lee el blob como texto y conviértelo a JSON.

### Subir y archivar (solo ADMIN)

| Endpoint | Detalle |
|---|---|
| `POST /archivos` | `multipart/form-data`: `archivo` (el archivo) e `id_carpeta` (opcional; sin él, la raíz de «Mis carpetas»). `201` con el `Archivo`. Pasa por: tipo real por los primeros bytes (la extensión debe corresponder), tamaño ≤ 10 MB, **antivirus ClamAV**, revisión (PDF sin JavaScript/acciones/adjuntos ni clave; imágenes re-codificadas y sin metadatos) y cifrado. **422** (`20018`) con el motivo si algo no se admite; **503** (`20019`) si el antivirus no responde (**no se guarda nada sin escanear**); **413** si pasa del límite; `404` si la carpeta no existe; `409` si está archivada. Las subidas rechazadas quedan en la bitácora. El nombre mostrado es el del archivo (sin rutas); el backend nunca lo usa como nombre en disco. |
| `POST /archivos/{id}/archivar` | `{ "motivo": 5–255 caracteres }` → `Archivo` con `archivado = true`. **No hay borrar ni desarchivar.** Solo archivos del ADMIN; un comprobante del sistema → `409` («nunca se archivan ni se borran»). Un archivo archivado sigue pudiendo verse y descargarse; el explorador lo oculta salvo `incluir_archivados=true`. |
| `GET /archivos/carpetas` | `List<Carpeta>` hijas de `id_padre` (sin él, las de la raíz). `incluir_archivadas=false`. `Carpeta = { id_carpeta, id_padre, nombre, ruta, nivel, archivada, motivo_archivo, usuario_archivo, fecha_archivo, usuario_creacion, fecha_creacion, n_archivos, n_subcarpetas }`. Cualquier usuario. |
| `POST /archivos/carpetas` | `{ "id_padre": null \| id, "nombre": 1–80 caracteres sin / ni \\ }` → `201 Carpeta`. Máx. 5 niveles (`409`); nombre repetido en la misma carpeta, sin distinguir mayúsculas → `409`. No se renombran ni se mueven. |
| `POST /archivos/carpetas/{id}/archivar` | `{ "motivo": … }` → `Carpeta`. Solo si no tiene archivos ni subcarpetas activas (`409`). |

### «Ver documento» (recuperación desde Drive)

`POST /archivos/descifrar` (cualquier usuario) — `multipart/form-data` con `archivo`: un archivo `.sila` bajado de Drive (o del disco del servidor). Responde los **bytes del documento original** (con las mismas cabeceras; `X-Archivo-Id` solo si la base lo conoce). Queda en bitácora (`DESCIFRAR`). Si la base no lo conoce (por ejemplo tras restaurar una base vieja) igual se descifra y se entrega como `recuperado-xxxxxxxx.pdf|jpg|png`. `422` si el archivo no es de SILA, está alterado o no coincide con lo registrado. Solo sirve para archivos cifrados por SILA con la llave del servidor.

### Bitácora (solo ADMIN)

`GET /archivos/accesos` → `Page<{ id_acceso, fecha, id_documento, nombre_archivo, tipo_entidad, id_entidad, version, usuario, accion, modo_clave, ip, user_agent, detalle }>` (más recientes primero). Filtros: `id_documento`, `usuario`, `accion`, `page`, `size`. `accion`: `VER` | `DESCARGAR` | `DESCIFRAR` | `SUBIR` | `ARCHIVAR` | `CARPETA_CREAR` | `CARPETA_ARCHIVAR` | `SUBIDA_RECHAZADA` (esta última sin `id_documento`; el `detalle` dice el nombre y el motivo, p. ej. la amenaza detectada). `modo_clave` (`DOCUMENTO` | `ESCRITA` | `ALEATORIA`) solo en `DESCARGAR`.

### Copia en Google Drive (solo ADMIN)

La copia de respaldo es **cifrada y con nombres opacos** (`<32 hex>.sila`, todo plano en una carpeta `SILA-respaldo`): Google no ve nombres de clientes ni la estructura de carpetas. Un proceso del servidor envía solo lo pendiente cada minuto; el dashboard solo conecta y vigila.

| Endpoint | Detalle |
|---|---|
| `GET /archivos/drive/estado` | `{ configurado, conectado, cuenta, carpeta, pendientes, con_error, subidos, ultimo_error, ultima_sincronizacion }`. `configurado = false` si el servidor no tiene las credenciales de Google (mostrar «Drive no está configurado en el servidor»). `ultimo_error` explica el problema (p. ej. «Google rechazó el permiso… vuelva a conectar»). |
| `GET /archivos/drive/autorizar` | `{ url }`: la dirección de Google a la que hay que **mandar al ADMIN** (`window.location.href = url`) para autorizar con la cuenta de la empresa. `503` si no está configurado. |
| `GET /archivos/drive/callback` | A donde vuelve Google (el dashboard **no** lo llama). Es público pero exige un `state` firmado de un solo uso (10 min). Termina redirigiendo a la página del dashboard configurada en el servidor (`SILA_DRIVE_RETORNO`) con **`?drive=ok`** o **`?drive=error`**; al volver, vuelve a pedir `/drive/estado`. |
| `POST /archivos/drive/sincronizar` | Envía ahora lo pendiente (también los que fallaron) y devuelve el estado. `503` si no está conectado. |
| `POST /archivos/drive/desconectar` | Borra el acceso guardado y devuelve el estado. Lo ya subido queda en Drive; la cola espera una nueva conexión. |

### Qué NO hace el dashboard
No genera PDF de comprobantes (los hace el servidor); no construye rutas de archivos; no muestra nunca `ruta_interna` (no existe en el API); no guarda archivos ni claves en `localStorage`; no usa `[innerHTML]` con nombres de archivo o carpeta (son texto de usuario). Los PDF subidos **no** se incrustan en un `<iframe>`: se descargan o se abren en una pestaña nueva (ver `docs/PROMPT_ARCHIVOS.md`).
