
import { Dados } from './dados';

describe('Dados', () => {
  it('debe generar resultados válidos para 1d6', () => {
    const dados = new Dados(12345);

    const resultado = dados.tirar('1d6');

    expect(resultado.dados).toHaveLength(1);
    expect(resultado.dados[0]).toBeGreaterThanOrEqual(1);
    expect(resultado.dados[0]).toBeLessThanOrEqual(6);
  });

  it('debe sumar correctamente varios dados', () => {
    const dados = new Dados(12345);

    const resultado = dados.tirar('2d6');

    expect(resultado.dados).toHaveLength(2);
    expect(resultado.total).toBe(
      resultado.dados[0] + resultado.dados[1]
    );
  });

  it('debe mantener el mismo generador entre tiradas', () => {
    const dados = new Dados(12345);
    const estadoInicial = dados.obtenerEstado();

    dados.tirar('1d6');

    expect(dados.obtenerEstado()).not.toBe(estadoInicial);
  });

  it('debe producir la misma secuencia con la misma semilla', () => {
    const dados1 = new Dados(12345);
    const dados2 = new Dados(12345);

    expect(dados1.tirar('2d6')).toEqual(dados2.tirar('2d6'));
    expect(dados1.tirar('1d6')).toEqual(dados2.tirar('1d6'));
  });

  it('debe rechazar expresiones inválidas', () => {
    const dados = new Dados(12345);

    expect(() => dados.tirar('2d')).toThrow();
  });
});
