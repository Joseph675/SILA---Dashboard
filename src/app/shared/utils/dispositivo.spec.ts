import { DISPOSITIVO_DESCONOCIDO, describirDispositivo } from './dispositivo';

const UA = {
  chromeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  headless: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36',
};

describe('describirDispositivo', () => {
  it.each([
    [UA.chromeWindows, 'Chrome en Windows'],
    [UA.edgeWindows, 'Edge en Windows'],
    [UA.firefoxLinux, 'Firefox en Linux'],
    [UA.safariMac, 'Safari en macOS'],
    [UA.safariIphone, 'Safari en iOS'],
    [UA.chromeAndroid, 'Chrome en Android'],
    [UA.headless, 'Chrome en Linux'],
  ])('reconoce %s', (userAgent, esperado) => {
    expect(describirDispositivo(userAgent)).toBe(esperado);
  });

  it.each(['node', 'curl/8.5.0', 'python-requests/2.31', '', null, undefined])('lo que no reconoce (%j) dice «Dispositivo desconocido»', (userAgent) => {
    expect(describirDispositivo(userAgent)).toBe(DISPOSITIVO_DESCONOCIDO);
  });

  it('si reconoce el navegador pero no el sistema, da solo el navegador', () => {
    expect(describirDispositivo('Mozilla/5.0 (PlayStation 5) AppleWebKit/605.1.15 (KHTML, like Gecko) Safari/605.1.15')).toBe('Safari');
  });
});
