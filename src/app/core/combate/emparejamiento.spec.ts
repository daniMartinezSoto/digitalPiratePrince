import { Dados } from '../dados/dados';
import { dadosTrucados } from '../dados/dados-trucados';
import { atacantesDe, emparejar, reemparejar } from './emparejamiento';

// Los números trucados son POSICIONES en la lista de los que quedan por elegir (0 = el primero).

describe('emparejar (sorteo inicial)', () => {
  it('uno contra uno: se atacan entre ellos, sin tirar dados', () => {
    const dados = dadosTrucados([]);
    expect(emparejar(['jugador'], ['jaguar_1'], dados)).toEqual({ jugador: 'jaguar_1', jaguar_1: 'jugador' });
  });

  it('dos contra dos: parejas al azar', () => {
    // jugador elige la posición 1 de [e1, e2] → e2; al forzudo le queda e1 (sin tirar).
    const objetivos = emparejar(['jugador', 'forzudo_1'], ['e1', 'e2'], dadosTrucados([1]));
    expect(objetivos).toEqual({ jugador: 'e2', e2: 'jugador', forzudo_1: 'e1', e1: 'forzudo_1' });
  });

  it('uno contra dos: el jugador ataca a uno y le atacan los dos', () => {
    // jugador elige la posición 0 → e1; e2 sobra y solo puede ir a por el jugador (sin tirar).
    const dados = dadosTrucados([0]);
    const objetivos = emparejar(['jugador'], ['e1', 'e2'], dados);

    expect(objetivos).toEqual({ jugador: 'e1', e1: 'jugador', e2: 'jugador' });
    expect(atacantesDe(objetivos, 'jugador')).toEqual(['e1', 'e2']);
    expect(dados.restantes()).toBe(0);
  });

  it('dos contra tres: el que sobra va al azar a por uno de los dos', () => {
    // jugador → posición 2 de [e1, e2, e3] = e3; forzudo → posición 0 de [e1, e2] = e1;
    // sobra e2, que va a por la posición 1 de [jugador, forzudo_1] = forzudo_1.
    const objetivos = emparejar(['jugador', 'forzudo_1'], ['e1', 'e2', 'e3'], dadosTrucados([2, 0, 1]));

    expect(objetivos).toEqual({ jugador: 'e3', e3: 'jugador', forzudo_1: 'e1', e1: 'forzudo_1', e2: 'forzudo_1' });
    expect(atacantesDe(objetivos, 'forzudo_1')).toEqual(['e1', 'e2']);
  });

  it('también funciona si el bando grande es el nuestro: tres contra un jaguar', () => {
    // El jaguar elige a quién ataca (posición 1 = forzudo_1); los otros dos van a por él.
    const objetivos = emparejar(['jugador', 'forzudo_1', 'nativo_1'], ['jaguar_1'], dadosTrucados([1]));

    expect(objetivos).toEqual({ jaguar_1: 'forzudo_1', forzudo_1: 'jaguar_1', jugador: 'jaguar_1', nativo_1: 'jaguar_1' });
  });

  it('todos tienen objetivo y siempre es del otro bando', () => {
    const aliados = ['jugador', 's1', 's2'];
    const enemigos = ['e1', 'e2', 'e3', 'e4', 'e5'];
    for (let semilla = 1; semilla <= 50; semilla++) {
      const objetivos = emparejar(aliados, enemigos, new Dados(semilla));
      for (const a of aliados) expect(enemigos).toContain(objetivos[a]);
      for (const e of enemigos) expect(aliados).toContain(objetivos[e]);
      // Cada uno del bando pequeño tiene, al menos, a su pareja encima.
      for (const a of aliados) expect(atacantesDe(objetivos, a).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('con la misma semilla sale el mismo emparejamiento', () => {
    const a = emparejar(['jugador', 's1'], ['e1', 'e2', 'e3'], new Dados(99));
    const b = emparejar(['jugador', 's1'], ['e1', 'e2', 'e3'], new Dados(99));
    expect(a).toEqual(b);
  });

  it('si un bando está vacío, no hay objetivos', () => {
    expect(emparejar([], ['e1'], dadosTrucados([]))).toEqual({});
  });

  it('avisa si un luchador está repetido', () => {
    expect(() => emparejar(['jugador'], ['jugador'], dadosTrucados([]))).toThrow(/"jugador" está repetido/);
  });
});

describe('reemparejar (después de una ronda)', () => {
  it('si nadie ha caído, todo sigue igual y no se tira nada', () => {
    const objetivos = { jugador: 'e1', e1: 'jugador', e2: 'jugador' };
    const dados = dadosTrucados([]);
    expect(reemparejar(objetivos, ['jugador'], ['e1', 'e2'], dados)).toEqual(objetivos);
  });

  it('cuando cae tu rival, pasas al que queda', () => {
    const objetivos = { jugador: 'e1', e1: 'jugador', e2: 'jugador' };
    expect(reemparejar(objetivos, ['jugador'], ['e2'], dadosTrucados([]))).toEqual({ jugador: 'e2', e2: 'jugador' });
  });

  it('quien se queda sin rival elige uno nuevo al azar entre los vivos', () => {
    // El forzudo mató a e1; quedan e2 y e3 (los dos sobre el jugador). Elige la posición 1 = e3.
    const objetivos = { jugador: 'e2', e2: 'jugador', forzudo_1: 'e1', e1: 'forzudo_1', e3: 'jugador' };
    const nuevos = reemparejar(objetivos, ['jugador', 'forzudo_1'], ['e2', 'e3'], dadosTrucados([1]));

    // e3 sigue atacando al jugador: su objetivo sigue vivo.
    expect(nuevos).toEqual({ jugador: 'e2', forzudo_1: 'e3', e2: 'jugador', e3: 'jugador' });
  });

  it('vale para los enemigos: si muere el seguidor al que atacaban, buscan otro', () => {
    // Muere el forzudo; e1 y e2 le atacaban; solo queda el jugador.
    const objetivos = { jugador: 'e3', e3: 'jugador', forzudo_1: 'e1', e1: 'forzudo_1', e2: 'forzudo_1' };
    expect(reemparejar(objetivos, ['jugador'], ['e1', 'e2', 'e3'], dadosTrucados([]))).toEqual({
      jugador: 'e3', e1: 'jugador', e2: 'jugador', e3: 'jugador',
    });
  });

  it('si un bando ha caído entero, se acaba: no hay objetivos', () => {
    expect(reemparejar({ jugador: 'e1', e1: 'jugador' }, ['jugador'], [], dadosTrucados([]))).toEqual({});
  });
});
