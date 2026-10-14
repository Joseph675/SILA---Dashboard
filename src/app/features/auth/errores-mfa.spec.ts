import { TestBed } from '@angular/core/testing';
import { ApiErrorService } from '../../core/api/api-error';
import { describirErrorSensible } from './errores-mfa';

describe('describirErrorSensible', () => {
  const errores = () => TestBed.inject(ApiErrorService);

  it('20014 (cuenta bloqueada) SÍ se avisa en las acciones con código, con los minutos del servidor', () => {
    const e = describirErrorSensible(errores(), { code: 20014, message: 'Cuenta bloqueada temporalmente. Intente de nuevo en 15 minutos.' });
    expect(e.mensaje).toBe('Cuenta bloqueada. Cuenta bloqueada temporalmente. Intente de nuevo en 15 minutos.');
    expect(e.campo).toBeNull();
    expect(e.limpiarCodigo).toBe(true);
  });

  it('20015 pide esperar un minuto', () => {
    expect(describirErrorSensible(errores(), { code: 20015, message: 'x' }).mensaje).toBe('Demasiados intentos, espera un minuto.');
  });
});
