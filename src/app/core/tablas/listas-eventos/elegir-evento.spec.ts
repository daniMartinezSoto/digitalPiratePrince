import { Dados } from '../../dados/dados';
import { elegirEvento, eventoAleatorio } from './elegir-evento';
import type { ListaEventos } from './lista-eventos';

const lista: ListaEventos = {
  id: 'prueba',
  eventos: [
    { evento: 'comun', peso: 3 },
    { evento: 'raro', peso: 1 },
  ],
};

describe('elegirEvento', () => {
  it('devuelve siempre un evento de la lista', () => {
    const dados = new Dados(1);
    for (let i = 0; i < 100; i++) {
      expect(['comun', 'raro']).toContain(elegirEvento(lista, dados));
    }
  });

  it('respeta los pesos: con peso 3 contra 1, el común sale alrededor del 75 %', () => {
    const dados = new Dados(2);
    let comunes = 0;
    for (let i = 0; i < 4000; i++) {
      if (elegirEvento(lista, dados) === 'comun') comunes++;
    }
    expect(comunes / 4000).toBeGreaterThan(0.72);
    expect(comunes / 4000).toBeLessThan(0.78);
  });

  it('con la misma semilla elige lo mismo', () => {
    expect(elegirEvento(lista, new Dados(9))).toBe(elegirEvento(lista, new Dados(9)));
  });
});

describe('eventoAleatorio', () => {
  it('con 0 % nunca pasa nada', () => {
    const dados = new Dados(3);
    for (let i = 0; i < 200; i++) {
      expect(eventoAleatorio(lista, 0, dados)).toBeNull();
    }
  });

  it('con 100 % siempre pasa algo', () => {
    const dados = new Dados(4);
    for (let i = 0; i < 200; i++) {
      expect(eventoAleatorio(lista, 100, dados)).not.toBeNull();
    }
  });

  it('con 50 % pasa algo más o menos la mitad de las veces', () => {
    const dados = new Dados(5);
    let veces = 0;
    for (let i = 0; i < 4000; i++) {
      if (eventoAleatorio(lista, 50, dados) !== null) veces++;
    }
    expect(veces / 4000).toBeGreaterThan(0.47);
    expect(veces / 4000).toBeLessThan(0.53);
  });

  it('gasta 1 número si no pasa nada y 2 si pasa algo (protege la reproducibilidad)', () => {
    const sinEvento = new Dados(6);
    const gemelo1 = new Dados(6);
    eventoAleatorio(lista, 0, sinEvento);
    gemelo1.probabilidad(0);
    expect(sinEvento.obtenerEstado()).toBe(gemelo1.obtenerEstado());

    const conEvento = new Dados(7);
    const gemelo2 = new Dados(7);
    eventoAleatorio(lista, 100, conEvento);
    gemelo2.probabilidad(1);
    gemelo2.elegirPonderado(lista.eventos);
    expect(conEvento.obtenerEstado()).toBe(gemelo2.obtenerEstado());
  });
});
