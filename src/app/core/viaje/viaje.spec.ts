import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import { crearPartida } from '../partida/crear-partida';
import { llegar, lugaresDeLlegada } from './llegar';
import { progresoDePuertos, PUERTOS_PRINCIPALES } from './puertos-principales';
import { condicionesQueImpidenViajar, viajar } from './viajar';

const TRES_PUERTOS = ['tortuga', 'port_royal', 'la_habana'];

/** Partida en la fase de acción con lo que digamos. */
function estadoCon(jugador: Partial<Jugador> = {}, puertosVisitados: string[] = []): Estado {
  const { estado } = crearPartida(123, 'Marta');
  return {
    ...estado,
    jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', condiciones: [], ...jugador },
    mundo: { ...estado.mundo, fase: 'accion', puertosVisitados },
  };
}

describe('los puertos principales', () => {
  it('son 4: Tortuga, Port Royal, La Habana y Nassau', () => {
    expect(PUERTOS_PRINCIPALES.map(p => p.nombre)).toEqual(['Tortuga', 'Port Royal', 'La Habana', 'Nassau']);
  });

  it('el progreso dice cuáles se han visitado ("Puertos 1/4")', () => {
    const progreso = progresoDePuertos(estadoCon({}, ['nassau']).mundo);
    expect(progreso.visitados).toBe(1);
    expect(progreso.total).toBe(4);
    expect(progreso.puertos.find(p => p.id === 'nassau')?.visitado).toBe(true);
  });
});

describe('llegar', () => {
  it('a qué cuenta como llegar: tierra, puerto, aldea, naufragio', () => {
    expect(lugaresDeLlegada({ lugar: 'barco' })).toEqual([]);
    expect(lugaresDeLlegada({ lugar: 'intemperie' })).toEqual(['tierra']);
    expect(lugaresDeLlegada({ lugar: 'puerto' })).toEqual(['tierra', 'puerto']);
    expect(lugaresDeLlegada({ lugar: 'intemperie', rasgo: 'naufragio' })).toEqual(['tierra', 'naufragio']);
  });

  it('el escorbuto se cura al tocar tierra (y no al seguir en el mar)', () => {
    const conEscorbuto = estadoCon({ condiciones: [{ id: 'escorbuto' }] });
    expect(llegar(conEscorbuto, { lugar: 'barco' }, new Dados(1)).estado.jugador.condiciones).toEqual([{ id: 'escorbuto' }]);
    const enTierra = llegar(conEscorbuto, { lugar: 'intemperie' }, new Dados(1));
    expect(enTierra.estado.jugador.condiciones).toEqual([]);
    expect(enTierra.cambios).toContainEqual({ tipo: 'condicion_quitada', condicion: 'escorbuto' });
  });

  it('un puerto principal queda apuntado una sola vez', () => {
    const primera = llegar(estadoCon(), { lugar: 'puerto', puertoPrincipal: 'tortuga' }, new Dados(1));
    expect(primera.estado.mundo.puertosVisitados).toEqual(['tortuga']);
    expect(primera.puertoNuevo).toBe(true);
    const segunda = llegar(primera.estado, { lugar: 'puerto', puertoPrincipal: 'tortuga' }, new Dados(1));
    expect(segunda.estado.mundo.puertosVisitados).toEqual(['tortuga']);
    expect(segunda.puertoNuevo).toBe(false);
  });

  it('error si el puerto principal no existe o no se llega a un puerto', () => {
    expect(() => llegar(estadoCon(), { lugar: 'puerto', puertoPrincipal: 'atlantida' }, new Dados(1))).toThrow();
    expect(() => llegar(estadoCon(), { lugar: 'aldea', puertoPrincipal: 'tortuga' }, new Dados(1))).toThrow();
  });

  it('VICTORIA: al llegar al 4.º puerto principal con 10 de fama', () => {
    const casi = estadoCon({ fama: 10 }, TRES_PUERTOS);
    const resultado = llegar(casi, { lugar: 'puerto', puertoPrincipal: 'nassau' }, new Dados(1));
    expect(resultado.estado.mundo.finPartida).toEqual({ resultado: 'victoria', motivo: 'fama_y_puertos' });
  });

  it('VICTORIA: también al llegar a un puerto cualquiera con todo ya cumplido (regreso triunfal)', () => {
    const todo = estadoCon({ fama: 10 }, [...TRES_PUERTOS, 'nassau']);
    expect(llegar(todo, { lugar: 'puerto' }, new Dados(1)).estado.mundo.finPartida?.resultado).toBe('victoria');
  });

  it('sin victoria: con los 4 puertos pero poca fama, o con la fama pero fuera de un puerto', () => {
    const pocaFama = estadoCon({ fama: 9 }, [...TRES_PUERTOS, 'nassau']);
    expect(llegar(pocaFama, { lugar: 'puerto' }, new Dados(1)).estado.mundo.finPartida).toBeNull();
    const enLaJungla = estadoCon({ fama: 10 }, [...TRES_PUERTOS, 'nassau']);
    expect(llegar(enLaJungla, { lugar: 'intemperie' }, new Dados(1)).estado.mundo.finPartida).toBeNull();
    const faltaUno = estadoCon({ fama: 10 }, TRES_PUERTOS);
    expect(llegar(faltaUno, { lugar: 'puerto' }, new Dados(1)).estado.mundo.finPartida).toBeNull();
  });

  it('el conformista gana con 8 de fama (su fama objetivo), pero también necesita los 4 puertos', () => {
    const conformista = estadoCon({ sobrenombre: 'el_conformista', famaObjetivo: 8, fama: 8 }, TRES_PUERTOS);
    expect(llegar(conformista, { lugar: 'puerto' }, new Dados(1)).estado.mundo.finPartida).toBeNull();
    expect(llegar(conformista, { lugar: 'puerto', puertoPrincipal: 'nassau' }, new Dados(1)).estado.mundo.finPartida?.resultado).toBe(
      'victoria',
    );
  });
});

describe('viajar sin mapa', () => {
  it('gasta la acción, llega al sitio y toca comer', () => {
    const resultado = viajar(estadoCon(), { terreno: 'playa', lugar: 'puerto', puertoPrincipal: 'tortuga' }, new Dados(1));
    expect(resultado.estado.mundo.fase).toBe('comida');
    expect(resultado.estado.mundo.puertosVisitados).toEqual(['tortuga']);
    expect(resultado.puertoNuevo).toBe(true);
  });

  it('a veces salta un evento de la lista del terreno de destino (más o menos la mitad de las veces)', () => {
    let conEvento = 0;
    for (let semilla = 1; semilla <= 400; semilla++) {
      const { eventos } = viajar(estadoCon(), { terreno: 'alta_mar', lugar: 'barco' }, new Dados(semilla));
      if (eventos.length) conEvento++;
    }
    expect(conEvento).toBeGreaterThan(150);
    expect(conEvento).toBeLessThan(250);
  });

  it('con tormenta no se puede viajar', () => {
    const conTormenta = estadoCon({ condiciones: [{ id: 'tormenta' }] });
    expect(condicionesQueImpidenViajar(conTormenta)).toEqual(['tormenta']);
    expect(() => viajar(conTormenta, { terreno: 'costa', lugar: 'barco' }, new Dados(1))).toThrow(/tormenta/);
  });

  it('en el agua se va a bordo; en tierra, no', () => {
    expect(() => viajar(estadoCon(), { terreno: 'costa', lugar: 'puerto' }, new Dados(1))).toThrow();
    expect(() => viajar(estadoCon(), { terreno: 'jungla', lugar: 'barco' }, new Dados(1))).toThrow();
  });

  it('solo en la fase de acción', () => {
    const { estado } = crearPartida(1, 'Marta'); // fase "inicio"
    expect(() => viajar(estado, { terreno: 'costa', lugar: 'barco' }, new Dados(1))).toThrow(/fase/);
  });

  it('si gana al llegar, la partida termina allí (sin evento)', () => {
    const casi = estadoCon({ fama: 10 }, TRES_PUERTOS);
    const resultado = viajar(casi, { terreno: 'playa', lugar: 'puerto', puertoPrincipal: 'nassau' }, new Dados(1));
    expect(resultado.estado.mundo.finPartida?.motivo).toBe('fama_y_puertos');
    expect(resultado.eventos).toEqual([]);
  });
});
