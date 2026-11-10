import { Generador } from './generador';
import { tirar } from './tirada';

describe('tirar', () => {
  it('debe generar un resultado válido para 1d6', () => {
    const generador = new Generador(12345);

    const resultado = tirar('1d6', generador);

    expect(resultado.dados).toHaveLength(1);
    expect(resultado.dados[0]).toBeGreaterThanOrEqual(1);
    expect(resultado.dados[0]).toBeLessThanOrEqual(6);
  });

  it('debe generar dos dados y sumar sus resultados para 2d6', () => {
    const generador = new Generador(12345);

    const resultado = tirar('2d6', generador);

    expect(resultado.dados).toHaveLength(2);
    expect(resultado.total).toBe(
      resultado.dados[0] + resultado.dados[1]
    );
  });

  it('debe rechazar expresiones no válidas', () => {
    const generador = new Generador(12345);

    expect(() => tirar('2d', generador)).toThrow();
  });

it('debe multiplicar el resultado cuando se indica x5', () => {
  const generador = new Generador(12345);

  const resultado = tirar('1d6x5', generador);

  expect(resultado.total).toBe(resultado.dados[0] * 5);
});

it('debe rechazar un multiplicador igual a cero', () => {
  const generador = new Generador(12345);

  expect(() => tirar('1d6x0', generador)).toThrow();
});


});