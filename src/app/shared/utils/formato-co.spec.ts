import { formatoFechaHora } from './formato-co';

describe('formatoFechaHora', () => {
  it('lee la marca sin zona como UTC y la muestra en hora de Colombia (UTC-5)', () => {
    expect(formatoFechaHora('2026-10-09T03:45:05')).toBe('08/10/2026 22:45');
  });

  it('cruza el día correctamente (madrugada UTC = noche anterior en Colombia)', () => {
    expect(formatoFechaHora('2026-01-01T02:30:00')).toBe('31/12/2025 21:30');
  });

  it('si la marca ya trae zona, la respeta', () => {
    expect(formatoFechaHora('2026-10-09T03:45:05Z')).toBe('08/10/2026 22:45');
    expect(formatoFechaHora('2026-10-09T03:45:05+00:00')).toBe('08/10/2026 22:45');
  });

  it('valores vacíos o inválidos dan «—»', () => {
    expect(formatoFechaHora(null)).toBe('—');
    expect(formatoFechaHora(undefined)).toBe('—');
    expect(formatoFechaHora('')).toBe('—');
    expect(formatoFechaHora('no es una fecha')).toBe('—');
  });
});
