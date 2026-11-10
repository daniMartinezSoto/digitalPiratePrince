
import { Generador } from './generador';

describe('Generador', () => {
  it('debe generar la misma secuencia con la misma semilla', () => {
    const generador1 = new Generador(12345);
    const generador2 = new Generador(12345);

    for (let i = 0; i < 100; i++) {
      expect(generador1.siguiente()).toBe(generador2.siguiente());
    }
  });

  it('debe generar números entre 0 y 1', () => {
    const generador = new Generador(12345);

    for (let i = 0; i < 1000; i++) {
      const numero = generador.siguiente();

      expect(numero).toBeGreaterThanOrEqual(0);
      expect(numero).toBeLessThan(1);
    }
  });

  it('debe avanzar el estado al generar números', () => {
    const generador = new Generador(12345);
    const estadoInicial = generador.obtenerEstado();

    generador.siguiente();

    expect(generador.obtenerEstado()).not.toBe(estadoInicial);
  });
});
