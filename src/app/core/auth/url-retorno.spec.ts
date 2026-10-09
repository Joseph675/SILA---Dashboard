import { URL_INICIO, urlRetornoSegura } from './url-retorno';

describe('urlRetornoSegura (evita la redirección abierta)', () => {
  it.each(['/catalogos', '/usuarios', '/periodos?anio=2026', '/catalogos?pestana=clientes', '/cuenta'])('acepta la ruta interna %s', (url) => {
    expect(urlRetornoSegura(url)).toBe(url);
  });

  it.each([
    ['//evil.com', 'host sin esquema'],
    ['//evil.com/catalogos', 'host sin esquema con ruta'],
    ['https://evil.com', 'URL absoluta'],
    ['http://evil.com/login', 'URL absoluta http'],
    ['javascript:alert(1)', 'esquema javascript'],
    ['data:text/html,<script>alert(1)</script>', 'esquema data'],
    ['/\\evil.com', 'barra invertida (el navegador la lee como //)'],
    ['/catalogos:8080', 'dos puntos en la ruta'],
    ['catalogos', 'ruta relativa'],
    ['', 'vacía'],
    ['/ca\ntalogos', 'carácter de control'],
    ['/login', 'la propia pantalla de login'],
    ['/login?return=%2Fcatalogos', 'el login con parámetros'],
  ])('rechaza %j (%s) y va al inicio', (url) => {
    expect(urlRetornoSegura(url)).toBe(URL_INICIO);
  });

  it('sin valor va al inicio', () => {
    expect(urlRetornoSegura(null)).toBe(URL_INICIO);
    expect(urlRetornoSegura(undefined)).toBe(URL_INICIO);
  });
});
