
import { Dados } from './dados';
import { Generador } from './generador';

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


describe('Dados: métodos nuevos', () => {
  describe('entero', () => {
    it('devuelve valores dentro del rango, alcanzando ambos extremos', () => {
      const dados = new Dados(1);
      const vistos = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        const n = dados.entero(50, 53);
        expect(n).toBeGreaterThanOrEqual(50);
        expect(n).toBeLessThanOrEqual(53);
        vistos.add(n);
      }
      expect(vistos).toEqual(new Set([50, 51, 52, 53]));
    });

    it('con min igual a max devuelve ese valor', () => {
      expect(new Dados(1).entero(7, 7)).toBe(7);
    });

    it('rechaza rangos no válidos', () => {
      const dados = new Dados(1);
      expect(() => dados.entero(5, 2)).toThrow();
      expect(() => dados.entero(1.5, 3)).toThrow();
    });
  });

  describe('probabilidad', () => {
    it('0 es siempre falso y 1 siempre verdadero', () => {
      const dados = new Dados(2);
      for (let i = 0; i < 200; i++) {
        expect(dados.probabilidad(0)).toBe(false);
        expect(dados.probabilidad(1)).toBe(true);
      }
    });

    it('0.2 acierta aproximadamente el 20 % de las veces', () => {
      const dados = new Dados(3);
      let aciertos = 0;
      for (let i = 0; i < 10000; i++) if (dados.probabilidad(0.2)) aciertos++;
      expect(aciertos).toBeGreaterThan(1700);
      expect(aciertos).toBeLessThan(2300);
    });

    it('rechaza valores fuera de 0-1', () => {
      const dados = new Dados(3);
      expect(() => dados.probabilidad(-0.1)).toThrow();
      expect(() => dados.probabilidad(1.5)).toThrow();
    });
  });

  describe('elegirPonderado', () => {
    it('reparte según los pesos', () => {
      const dados = new Dados(4);
      const lista = [
        { id: 'a', peso: 5 },
        { id: 'b', peso: 3 },
        { id: 'c', peso: 2 },
      ];
      const cuenta: Record<string, number> = { a: 0, b: 0, c: 0 };
      for (let i = 0; i < 10000; i++) cuenta[dados.elegirPonderado(lista).id]++;
      expect(cuenta['a']).toBeGreaterThan(4600);
      expect(cuenta['a']).toBeLessThan(5400);
      expect(cuenta['b']).toBeGreaterThan(2600);
      expect(cuenta['b']).toBeLessThan(3400);
      expect(cuenta['c']).toBeGreaterThan(1600);
      expect(cuenta['c']).toBeLessThan(2400);
    });

    it('con un solo elemento lo devuelve siempre', () => {
      const dados = new Dados(4);
      expect(dados.elegirPonderado([{ id: 'x', peso: 1 }]).id).toBe('x');
    });

    it('rechaza listas vacías y pesos no válidos', () => {
      const dados = new Dados(4);
      expect(() => dados.elegirPonderado([])).toThrow();
      expect(() => dados.elegirPonderado([{ peso: 0 }])).toThrow();
      expect(() => dados.elegirPonderado([{ peso: -1 }])).toThrow();
    });
  });

  it('cada método consume exactamente un número del generador', () => {
    const referencia = new Generador(9);
    referencia.siguiente();
    const esperado = referencia.obtenerEstado();

    const a = new Dados(9); a.entero(1, 6);
    const b = new Dados(9); b.probabilidad(0);
    const c = new Dados(9); c.elegirPonderado([{ peso: 1 }, { peso: 2 }]);

    expect(a.obtenerEstado()).toBe(esperado);
    expect(b.obtenerEstado()).toBe(esperado);
    expect(c.obtenerEstado()).toBe(esperado);
  });
});


  
});
