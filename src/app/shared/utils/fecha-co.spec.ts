import { hoyColombia } from './fecha-co';

describe('hoyColombia', () => {
  it('a las 23:30 en Colombia sigue siendo el mismo día aunque en UTC ya sea el siguiente', () => {
    const ahora = new Date('2026-10-10T04:30:00Z'); // 23:30 del 9 de octubre en Bogotá (UTC−5)

    expect(ahora.toISOString().slice(0, 10)).toBe('2026-10-10');
    expect(hoyColombia(ahora)).toBe('2026-10-09');
  });

  it('cambia de día a la medianoche de Colombia (05:00 UTC), no a la de UTC', () => {
    expect(hoyColombia(new Date('2026-10-09T04:59:59Z'))).toBe('2026-10-08');
    expect(hoyColombia(new Date('2026-10-09T05:00:00Z'))).toBe('2026-10-09');
  });

  it('devuelve AAAA-MM-DD', () => {
    expect(hoyColombia()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
