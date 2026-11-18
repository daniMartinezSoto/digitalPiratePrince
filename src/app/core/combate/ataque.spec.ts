import { AJUSTES } from '../ajustes/ajustes';
import { reduccionDanoActual } from '../condiciones/consultas';
import { dadosTrucados } from '../dados/dados-trucados';
import type { Jugador } from '../estado/jugador';
import { crearPartida } from '../partida/crear-partida';
import { ataqueBasico, ataqueDelJugador, castigoPorHambre, reducirDano } from './ataque';

describe('ataqueDelJugador', () => {
  it('con un 1 falla', () => {
    expect(ataqueDelJugador(0, dadosTrucados([1]))).toEqual({ dados: [1], acierta: false, danoSinCastigo: 0, bonificador: 0, castigoHambre: 0, dano: 0 });
  });

  it('con 2-5 hace ese daño', () => {
    for (const cara of [2, 3, 4, 5]) {
      const ataque = ataqueDelJugador(0, dadosTrucados([cara]));
      expect(ataque.acierta).toBe(true);
      expect(ataque.dano).toBe(cara);
    }
  });

  it('con un 6 vuelve a tirar y suma: 6 + 4 = 10', () => {
    expect(ataqueDelJugador(0, dadosTrucados([6, 4]))).toEqual({ dados: [6, 4], acierta: true, danoSinCastigo: 10, bonificador: 0, castigoHambre: 0, dano: 10 });
  });

  it('sigue tirando mientras salgan seises: 6 + 6 + 3 = 15', () => {
    const ataque = ataqueDelJugador(0, dadosTrucados([6, 6, 3]));
    expect(ataque.dados).toEqual([6, 6, 3]);
    expect(ataque.dano).toBe(15);
  });

  it('si después de un 6 sale un 1, falla TODO el ataque', () => {
    expect(ataqueDelJugador(0, dadosTrucados([6, 6, 1]))).toEqual({ dados: [6, 6, 1], acierta: false, danoSinCastigo: 0, bonificador: 0, castigoHambre: 0, dano: 0 });
  });

  it('gasta un dado más por cada 6, ni uno más', () => {
    const dados = dadosTrucados([6, 2, 5]);
    ataqueDelJugador(0, dados);
    expect(dados.restantes()).toBe(1);
  });

  it('el hambre se resta al daño: con −3, un 6 + 2 hace 5', () => {
    const ataque = ataqueDelJugador(3, dadosTrucados([6, 2]));
    expect(ataque.danoSinCastigo).toBe(8);
    expect(ataque.castigoHambre).toBe(3);
    expect(ataque.dano).toBe(5);
  });

  it('el hambre puede dejar un golpe en 0: con −3, un 2 no hace nada (pero ha acertado)', () => {
    const ataque = ataqueDelJugador(3, dadosTrucados([2]));
    expect(ataque.acierta).toBe(true);
    expect(ataque.castigoHambre).toBe(3);
    expect(ataque.dano).toBe(0);
  });

  it('el bonificador se suma al daño si aciertas: estoque (+1) con un 4 hace 5', () => {
    const ataque = ataqueDelJugador(0, dadosTrucados([4]), 1);
    expect(ataque.bonificador).toBe(1);
    expect(ataque.dano).toBe(5);
  });

  it('el bonificador no evita el fallo: con +2, un 1 sigue fallando', () => {
    expect(ataqueDelJugador(0, dadosTrucados([1]), 2)).toEqual({ dados: [1], acierta: false, danoSinCastigo: 0, bonificador: 0, castigoHambre: 0, dano: 0 });
  });

  it('un bonificador negativo no quita el 6 que repite: maleficio (−1) con 6 + 3 hace 8', () => {
    const ataque = ataqueDelJugador(0, dadosTrucados([6, 3]), -1);
    expect(ataque.dados).toEqual([6, 3]);
    expect(ataque.dano).toBe(8);
  });

  it('bonificador y hambre juntos: +1 y −3 con un 5 hace 3', () => {
    expect(ataqueDelJugador(3, dadosTrucados([5]), 1).dano).toBe(3);
  });

  it('si falla, no se apunta castigo por hambre (no hay nada que restar)', () => {
    expect(ataqueDelJugador(2, dadosTrucados([1])).castigoHambre).toBe(0);
  });
});

describe('ataqueBasico (enemigos y seguidores)', () => {
  it('con 1-2 falla', () => {
    for (const cara of [1, 2]) {
      expect(ataqueBasico(3, 0, dadosTrucados([cara]))).toEqual({ dados: [cara], acierta: false, danoSinCastigo: 0, bonificador: 0, castigoHambre: 0, dano: 0 });
    }
  });

  it('con 3-5 hace su ataque', () => {
    for (const cara of [3, 4, 5]) {
      expect(ataqueBasico(3, 0, dadosTrucados([cara])).dano).toBe(3);
    }
  });

  it('con un 6 hace su ataque +1', () => {
    expect(ataqueBasico(3, 0, dadosTrucados([6])).dano).toBe(4);
  });

  it('un 6 no repite: gasta siempre un solo dado', () => {
    const dados = dadosTrucados([6, 5]);
    ataqueBasico(2, 0, dados);
    expect(dados.restantes()).toBe(1);
  });

  it('si no puede fallar (huida fallida), un 1 o un 2 cuentan como golpe normal', () => {
    for (const cara of [1, 2]) {
      const ataque = ataqueBasico(2, 0, dadosTrucados([cara]), true);
      expect(ataque.acierta).toBe(true);
      expect(ataque.dano).toBe(2);
    }
  });

  it('si no puede fallar, un 6 sigue siendo ataque +1', () => {
    expect(ataqueBasico(2, 0, dadosTrucados([6]), true).dano).toBe(3);
  });

  it('el hambre de un seguidor se resta: un forzudo (3) con −3 hace 0 con un 4 y 1 con un 6', () => {
    expect(ataqueBasico(3, 3, dadosTrucados([4])).dano).toBe(0);
    expect(ataqueBasico(3, 3, dadosTrucados([6])).dano).toBe(1);
  });
});

describe('castigoPorHambre', () => {
  it('es −1 por cada día sin comer', () => {
    expect(castigoPorHambre(0)).toBe(0);
    expect(castigoPorHambre(1)).toBe(1);
    expect(castigoPorHambre(2)).toBe(2);
  });

  it('no pasa del tope (3)', () => {
    expect(castigoPorHambre(3)).toBe(AJUSTES.castigoHambreMaximo);
    expect(castigoPorHambre(10)).toBe(AJUSTES.castigoHambreMaximo);
  });
});

describe('reducirDano (piel de piedra)', () => {
  it('quita la reducción a un golpe: 3 se queda en 2', () => {
    expect(reducirDano(3, 1)).toBe(2);
  });

  it('si te aciertan, siempre te hacen al menos 1', () => {
    expect(reducirDano(1, 1)).toBe(1);
    expect(reducirDano(2, 5)).toBe(1);
  });

  it('un golpe que no hace nada sigue sin hacer nada', () => {
    expect(reducirDano(0, 1)).toBe(0);
  });

  it('sin reducción, el golpe no cambia', () => {
    expect(reducirDano(4, 0)).toBe(4);
  });
});

describe('reduccionDanoActual', () => {
  function jugadorCon(condiciones: Jugador['condiciones']): Jugador {
    const { estado } = crearPartida(1, 'Prueba');
    return { ...estado.jugador, condiciones };
  }

  it('sin piel de piedra, no hay reducción', () => {
    expect(reduccionDanoActual(jugadorCon([]))).toBe(0);
  });

  it('con piel de piedra, 1', () => {
    expect(reduccionDanoActual(jugadorCon([{ id: 'piel_de_piedra' }]))).toBe(1);
  });

  it('también si la piel de piedra viene dentro del amuleto maldito', () => {
    const jugador = jugadorCon([{ id: 'amuleto_maldito', partes: ['piel_de_piedra', 'manos_torpes'] }]);
    expect(reduccionDanoActual(jugador)).toBe(1);
  });
});
