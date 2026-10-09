# Prompt: Mi cuenta — editar datos y pedir el código MFA en acciones sensibles

Lee `docs/CONTRATO_BACKEND.md` (secciones Auth y «Acciones sensibles»). Cambios del backend ya desplegados:

- `PUT /auth/yo` `{nombre, email, codigo}` → `UsuarioSesion` actualizado.
- `POST /auth/cambiar-clave` con token de **acceso** ahora exige `codigo`; con token temporal (primer ingreso) NO.
- `POST /auth/mfa/respaldo/regenerar` ahora exige `codigo` además de `clave_actual`.
- `codigo` = 6 dígitos de la app, o un código de respaldo (se acepta en minúscula y con/sin guion).

Implementa en `features/auth/cuenta-page`:

1. **Mis datos editable**: botón «Editar» en la tarjeta. Pasa nombre y correo a campos (usuario, rol y segundo factor siguen de solo lectura). Validación: nombre 3–120, correo válido ≤150. Al guardar pide el código (ver 4). Al éxito actualiza la `Sesion` en memoria con la respuesta y muestra un aviso.
2. **Cambiar mi clave**: agrega el campo «Código de tu app de autenticación» (`inputmode="numeric"`, `autocomplete="one-time-code"`, 6 dígitos) y envía `codigo`. NO lo agregues en el paso `cambiar-clave` del login (token temporal).
3. **Generar códigos nuevos** (`regenerar-codigos-dialog`): agrega el mismo campo de código junto a la clave actual y envía `codigo`.
4. Un solo componente reutilizable `app-campo-codigo-mfa` para el campo, con la opción «Usar un código de respaldo» (cambia el campo a texto libre, máx. 30).
5. **Errores**: `400` → mensaje del servidor bajo el formulario; `401` "Codigo incorrecto" → error en el campo del código y límpialo; `401` "Ese codigo ya fue usado" → «Espera unos segundos a que la app genere uno nuevo»; `409` (correo en uso) → error en el campo correo; `423` → aviso de cuenta bloqueada con los minutos del mensaje; `429` → «Demasiados intentos, espera un minuto». Aclara en la ayuda: «5 códigos incorrectos bloquean tu cuenta 15 minutos».
6. Actualiza `AuthService`/modelos (`CambiarClaveRequest.codigo?`, `RegenerarRequest.codigo`, `ActualizarPerfilRequest`) y el mock de auth.
7. Tests: un `spec` por cada flujo (editar datos OK, código incorrecto, correo en uso, cambiar clave envía `codigo`, el login con token temporal NO lo envía).

No toques el backend. Si algo del contrato no coincide, dímelo en vez de adaptarlo en silencio.
