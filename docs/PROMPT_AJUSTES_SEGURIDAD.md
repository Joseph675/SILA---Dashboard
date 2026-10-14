# Prompt: Ajustes de seguridad del backend que afectan al dashboard

Lee `docs/CONTRATO_BACKEND.md` (sección de autenticación y «Errores del login»). Backend ya desplegado. Implementa:

## 1. Categorías de gasto: solo ADMIN
`POST /finanzas/categorias` (crear) y `DELETE /finanzas/categorias/{id}` (desactivar) ahora son **solo ADMIN**: el servidor responde `403` a OPERATIVO antes de llegar a la base. Oculta (o deshabilita con tooltip) los botones «Nueva categoría» y «Desactivar» cuando el rol sea OPERATIVO, pero no confíes en eso: si llega un 403, muestra el `message` del servidor. El `GET /finanzas/categorias` sigue abierto para todos los roles.

## 2. Login: ya no existe «Cuenta bloqueada» (423)
`POST /auth/login` **ya no responde `423 / 20014`**. Para no revelar qué usuarios existen, una cuenta bloqueada (incluido el 5.º fallo que la bloquea) responde exactamente igual que una clave incorrecta: `401 / 20013` con el mensaje «Usuario o clave incorrectos. Si el problema continua, contacte al administrador.»
- Quita del login cualquier lógica o texto especial para `423` / `20014` (contador de minutos, aviso de bloqueo, etc.) y muestra siempre el `message` que llegue.
- El `429 / 20015` (demasiados intentos por minuto) se mantiene igual.
- Los pasos de MFA (`/auth/mfa/verificar`, `/auth/mfa/respaldo`, `/auth/mfa/activar`) y las acciones con código (cambiar clave, editar perfil, regenerar códigos) **sí pueden seguir dando `423`**: ahí la persona ya demostró su clave. No cambies ese manejo.

## 3. Estado `CAMBIAR_CLAVE` también en los pasos de MFA
`POST /auth/mfa/verificar`, `/auth/mfa/respaldo` y `/auth/mfa/activar` (con token de enrolamiento) pueden responder `estado: "CAMBIAR_CLAVE"` con un `token_temporal` y **sin `access_token`**. Ocurre cuando un administrador restablece la clave de esa cuenta mientras la persona estaba a mitad del login. Trátalo igual que en el login: lleva a la pantalla de cambio de clave usando ese token temporal; no asumas que un código MFA correcto siempre devuelve la sesión abierta.

## 4. Entrega
Ajusta modelos y repositorio (mock + HTTP) y el mock de errores (el login bloqueado ahora es 401 genérico). Un test por cambio: botones de categorías ocultos para OPERATIVO, login con cuenta bloqueada muestra el mensaje genérico sin lógica de 423, y `mfa/verificar` con `estado: CAMBIAR_CLAVE` navega al cambio de clave. No toques el backend; si el contrato no coincide, avísame.
