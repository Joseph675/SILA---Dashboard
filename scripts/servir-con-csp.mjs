#!/usr/bin/env node
/**
 * Sirve el build de producción (dist/) con las cabeceras de seguridad y la CSP de docs/CSP.md,
 * y reenvía /api al backend. Es solo una herramienta de PRUEBA: sirve para recorrer la app
 * buscando violaciones de la política antes de pedirle al servidor web que la aplique. Sin dependencias.
 *
 *   npx ng build
 *   node scripts/servir-con-csp.mjs                 # http://localhost:4300 → API en http://localhost:8080
 *   node scripts/servir-con-csp.mjs --report-only   # la CSP solo avisa, no bloquea
 *
 * Variables: PUERTO (4300), BACKEND (http://localhost:8080), ORIGEN_BACKEND (http://localhost:4200).
 *   ORIGEN_BACKEND: el backend solo acepta /auth/refresh y /auth/logout desde el origen del dashboard
 *   que tiene configurado (:4200); al servir en otro puerto hay que presentarse con ese origen.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist/dashboard-app/browser');
const PUERTO = Number(process.env.PUERTO ?? 4300);
const BACKEND = new URL(process.env.BACKEND ?? 'http://localhost:8080');
const ORIGEN_BACKEND = process.env.ORIGEN_BACKEND ?? 'http://localhost:4200';
const SOLO_AVISAR = process.argv.includes('--report-only');

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const CABECERAS = {
  [SOLO_AVISAR ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy']: CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(join(RAIZ, 'index.html'))) {
  console.error(`No existe ${RAIZ}/index.html. Ejecuta primero: npx ng build`);
  process.exit(1);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    // /api → backend (mismo origen para el navegador, como detrás del proxy inverso de producción)
    if (url.pathname.startsWith('/api/')) {
      const cabeceras = { ...req.headers, host: BACKEND.host, origin: ORIGEN_BACKEND };
      const salida = http.request({ hostname: BACKEND.hostname, port: BACKEND.port, path: req.url, method: req.method, headers: cabeceras }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      });
      salida.on('error', () => {
        res.writeHead(502, { 'Content-Type': 'application/json' }).end('{"code":20999,"message":"Backend no disponible"}');
      });
      req.pipe(salida);
      return;
    }

    // Archivos estáticos; cualquier otra ruta es de la SPA → index.html
    const pedido = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    let archivo = resolve(RAIZ, pedido);
    if (archivo !== RAIZ && !archivo.startsWith(RAIZ + sep)) {
      res.writeHead(403).end();
      return;
    }
    const esArchivo = existsSync(archivo) && statSync(archivo).isFile();
    if (!esArchivo) archivo = join(RAIZ, 'index.html');
    res.writeHead(200, {
      ...CABECERAS,
      'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream',
      'Cache-Control': extname(archivo) === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
    });
    createReadStream(archivo).pipe(res);
  })
  .listen(PUERTO, () => {
    console.log(`SILA con CSP${SOLO_AVISAR ? ' (solo avisa)' : ''}: http://localhost:${PUERTO}  →  /api = ${BACKEND.origin}`);
    console.log(`Política: ${CSP}`);
  });
