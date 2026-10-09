import { ClaveIdempotente } from './idempotencia';

const sinRed = { code: 0, message: 'sin conexión' };
const validacion = { code: 20001, message: 'datos inválidos' };

describe('ClaveIdempotente', () => {
  it('cada acción nueva (datos nuevos tras un éxito) lleva una clave nueva', () => {
    const clave = new ClaveIdempotente();
    const primera = clave.para({ litros: 10 });
    clave.exito();

    expect(clave.para({ litros: 10 })).not.toBe(primera);
  });

  it('reintenta con la MISMA clave solo si los datos son iguales y el fallo fue de red, 5xx o 20016', () => {
    const clave = new ClaveIdempotente();
    const primera = clave.para({ litros: 10 });
    clave.fallo(sinRed);

    expect(clave.para({ litros: 10 })).toBe(primera);

    clave.fallo({ code: 20999, message: 'interno' });
    expect(clave.para({ litros: 10 })).toBe(primera);

    clave.fallo({ code: 20016, message: 'en proceso' });
    expect(clave.para({ litros: 10 })).toBe(primera);
  });

  it('usa clave nueva si el cuerpo cambió, aunque el fallo anterior fuera de red', () => {
    const clave = new ClaveIdempotente();
    const primera = clave.para({ litros: 10 });
    clave.fallo(sinRed);

    expect(clave.para({ litros: 11 })).not.toBe(primera);
  });

  it('un error de validación no reutiliza la clave', () => {
    const clave = new ClaveIdempotente();
    const primera = clave.para({ litros: 10 });
    clave.fallo(validacion);

    expect(clave.para({ litros: 10 })).not.toBe(primera);
  });

  it('descartar (20017) obliga a una clave nueva', () => {
    const clave = new ClaveIdempotente();
    const primera = clave.para({ litros: 10 });
    clave.fallo(sinRed);
    clave.descartar();

    expect(clave.para({ litros: 10 })).not.toBe(primera);
  });

  it('entiende el error envuelto por un recurso (en `cause`)', () => {
    const clave = new ClaveIdempotente();
    const primera = clave.para({ a: 1 });
    clave.fallo(new Error('x', { cause: sinRed }));

    expect(clave.para({ a: 1 })).toBe(primera);
  });
});
