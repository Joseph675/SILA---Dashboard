# Política de contenido (CSP) y cabeceras de seguridad

Probada el 2026-10-09 contra el build de producción con el login real (backend en `:8080`): **0 violaciones** en el recorrido completo. La política la aplica el **proxy inverso** (nginx, Caddy…); el dashboard no la fija por sí mismo. `ng serve` (desarrollo) usa scripts en línea de Vite y **no** está pensado para correr con esta política.

## Política recomendada

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

| Directiva | Valor | Por qué |
|---|---|---|
| `default-src` | `'self'` | Todo lo que no se nombra aparte, solo del propio origen. |
| `script-src` | `'self'` | **Sin `unsafe-inline` ni `unsafe-eval`.** Es la defensa principal contra XSS: un script inyectado no corre. Todo el JavaScript (incluido el trozo de `qrcode`, que se carga aparte) viene del propio origen. |
| `style-src` | `'self' 'unsafe-inline'` | **Única concesión.** Angular crea una etiqueta `<style>` por componente al ejecutarse; sin `'unsafe-inline'` se bloquean (con `'self'` a secas, solo la pantalla de login ya produce 4 violaciones). Un estilo en línea no ejecuta código; el riesgo es mucho menor que el de un script. Ver «Endurecer más» abajo. |
| `img-src` | `'self' data:` | `data:` es para el **código QR** del segundo factor (una imagen PNG generada en el navegador; el secreto no sale a ningún servicio externo). |
| `font-src` | `'self'` | Las fuentes (Geist) están en `/fonts`, sin CDN. |
| `connect-src` | `'self'` | Las llamadas al API van al mismo origen (`/api`), por el proxy. No hay otros orígenes. |
| `frame-ancestors` | `'none'` | Nadie puede incrustar el dashboard en un `<iframe>` (clickjacking). |
| `base-uri` | `'self'` | Evita que un `<base>` inyectado cambie hacia dónde apuntan las rutas relativas. |
| `form-action` | `'self'` | Los formularios solo envían al mismo origen. |

No hizo falta permitir ningún origen externo (ni fuentes, ni íconos, ni analíticas), ni `blob:` (la descarga de los códigos de respaldo funciona con la política tal cual), ni `unsafe-inline` en scripts.

### Qué hubo que cambiar en la app para poder usar `script-src 'self'`

El build de producción de Angular inserta por defecto un **script en línea** (`document.querySelectorAll('link[data-beasties-media]')…`) para cargar la hoja de estilos de forma diferida. Con esta política se bloquea y la hoja se queda en `media="print"`: la aplicación saldría sin estilos. En lugar de debilitar `script-src` (ni con `unsafe-inline` ni con un hash que se rompería con cada versión de Angular), se desactivó el CSS crítico en línea en producción (`angular.json` → `optimization.styles.inlineCritical: false`). Resultado: `index.html` ya no trae ningún `<script>` ni `<style>` en línea. El costo es pequeño (la hoja se pide como archivo normal en vez de pintarse parte en línea).

## Otras cabeceras

| Cabecera | Valor | Para qué |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | El navegador respeta el tipo de archivo declarado. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | No filtra rutas ni parámetros a otros sitios. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | La aplicación no usa esas funciones. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | **Solo en producción con HTTPS.** |
| `Cache-Control` (HTML) | `no-store` | `index.html` nunca queda en caché; los archivos con hash en el nombre pueden ser `immutable`. |

La cookie de renovación (`sila_refresh`) es `HttpOnly`, `SameSite=Strict` y, **en producción con HTTPS, `Secure`** (`SILA_COOKIE_SECURE=true` en el backend; en desarrollo `./arrancar.sh` la deja en `false`).

### Ejemplo (nginx)

```nginx
location /api/ { proxy_pass http://127.0.0.1:8080; }          # mismo origen: la cookie y el CSRF del backend lo exigen
location / {
  root /var/www/sila; try_files $uri /index.html;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
# index.html sin caché. OJO: add_header NO se hereda si el bloque define el suyo; repite las cabeceras de arriba aquí.
location = /index.html { add_header Cache-Control "no-store" always; }
```

Recomendación de despliegue: empezar con `Content-Security-Policy-Report-Only` (misma política) unos días y pasar a `Content-Security-Policy` cuando no haya avisos.

## Cómo se probó (y cómo repetirlo)

```bash
npx ng build
node scripts/servir-con-csp.mjs                 # http://localhost:4300, /api → :8080  (--report-only para que solo avise)
```

`scripts/servir-con-csp.mjs` es un servidor estático de unas pocas líneas, **sin dependencias**: entrega `dist/` con las cabeceras de arriba, devuelve `index.html` para las rutas de la SPA y reenvía `/api` al backend. Como el backend solo acepta `/auth/refresh` y `/auth/logout` desde el origen del dashboard que tiene configurado (`:4200`), el servidor de prueba se presenta con ese origen (`ORIGEN_BACKEND`).

Con él se recorrió con el login real: login por pasos, cambio de clave, **QR** (imagen `data:`), pantalla de **códigos de respaldo** (copiar, descargar por `blob:`, imprimir), Catálogos (3 pestañas), Períodos, Usuarios, Auditoría (3 pestañas), Mi cuenta (regenerar códigos, cerrar sesiones), diálogos, menú de usuario, cambio de tema, personalizador, un estado de error de la API y cerrar sesión, escuchando el evento `securitypolicyviolation` del navegador: **0 violaciones**.

Controles para que ese «0» valga: la política **sí bloquea** un `<script>` en línea, un script de otro origen, una imagen externa y un `fetch` externo (4 violaciones registradas); y quitar `'unsafe-inline'` de `style-src` produce 4 violaciones (los estilos de componentes).

### Un error de producción que esta prueba encontró

La librería `qrcode` es CommonJS: en el build de producción sus funciones llegan bajo `default` y no por nombre, así que el QR no se dibujaba (solo en producción; en desarrollo y en las pruebas sí). Estaba oculto porque nadie había abierto el flujo en un build de producción. Corregido en `mfa-enrolar.component.ts` (acepta ambas formas) con una prueba de regresión (`mfa-enrolar-cjs.component.spec.ts`).

## Endurecer más (opcional, más adelante)

Quitar `'unsafe-inline'` de `style-src` es posible con un **nonce** por respuesta: el proxy lo genera, lo pone en la cabecera (`style-src 'self' 'nonce-…'`) y en `<app-root ngCspNonce="…">` de `index.html`, y Angular lo aplica a las etiquetas `<style>` que crea. Exige que `index.html` se genere dinámicamente por petición (hoy es un archivo estático), así que se dejó fuera de esta entrega.
