import { dadosTrucados } from './dados-trucados';

describe('dadosTrucados (ayuda para tests)', () => {
  it('saca los números en el orden pedido', () => {
    const dados = dadosTrucados([6, 1, 4]);

    expect(dados.tirar('1d6').total).toBe(6);
    expect(dados.tirar('1d6').total).toBe(1);
    expect(dados.entero(1, 6)).toBe(4);
    expect(dados.restantes()).toBe(0);
  });

  it('avisa si se acaban los números', () => {
    const dados = dadosTrucados([3]);
    dados.tirar('1d6');

    expect(() => dados.tirar('1d6')).toThrow(/se han acabado/);
  });

  it('avisa si el número no puede salir en ese dado', () => {
    expect(() => dadosTrucados([7]).tirar('1d6')).toThrow(/el 7 no puede salir/);
  });

  it('solo sabe tirar un dado', () => {
    expect(() => dadosTrucados([3, 3]).tirar('2d6')).toThrow(/solo saben tirar un dado/);
  });
});
