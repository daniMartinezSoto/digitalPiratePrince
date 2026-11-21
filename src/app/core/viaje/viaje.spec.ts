import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import { crearPartida } from '../partida/crear-partida';
import { llegar, lugaresDeLlegada } from './llegar';
import { progresoDePuertos, puertosPrincipalesDe } from './puertos-principales';
import { condicionesQueImpidenViajar, destinosDeViaje, viajar } from './viajar';
import { obtenerMapa } from '../mapa/cargar-mapas';
import { distancia, vecinas } from '../mapa/hexagonos';
import { casillaEn, type Coordenada } from '../mapa/mapa';
import { esAgua } from '../turno/lugar';

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
  it('los declara el mapa de la partida: La Habana, Nassau, Tortuga y Port Royal', () => {
    expect(puertosPrincipalesDe(estadoCon()).map(p => p.nombre)).toEqual(['La Habana', 'Nassau', 'Tortuga', 'Port Royal']);
  });

  it('el progreso dice cuáles se han visitado ("Puertos 1/4")', () => {
    const progreso = progresoDePuertos(estadoCon({}, ['nassau']));
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

describe('viajar por el mapa', () => {
  const mapa = obtenerMapa('primer-mapa-prueba');
  const c = (col: number, fila: number) => ({ col, fila });
  const terreno = (x: Coordenada) => casillaEn(mapa, x.col, x.fila)!.terreno;
  const tierraJuntoA = (x: Coordenada) => vecinas(mapa, x).find(v => !esAgua(terreno(v)))!;
  const aguaJuntoA = (x: Coordenada) => vecinas(mapa, x).find(v => esAgua(terreno(v)))!;

  /** El jugador en "donde" (a pie) o a bordo en "donde" (con el barco allí). */
  function en(donde: Coordenada, aBordo = false, base: Estado = estadoCon()): Estado {
    return { ...base, mundo: { ...base.mundo, posicion: donde, ...(aBordo ? { posicionBarco: donde } : {}) } };
  }

  it('a pie, a las casillas de tierra vecinas (al empezar: 7,0 · 6,1 · 5,0)', () => {
    expect(destinosDeViaje(estadoCon())).toEqual([c(7, 0), c(6, 1), c(5, 0)]);
  });

  it('a bordo, solo a casillas de agua vecinas', () => {
    const destinos = destinosDeViaje(en(c(7, 2), true));
    expect(destinos.length).toBeGreaterThan(0);
    for (const d of destinos) {
      expect(esAgua(terreno(d))).toBe(true);
      expect(distancia(d, c(7, 2))).toBe(1);
    }
  });

  it('nunca a una casilla bloqueada', () => {
    const base = estadoCon();
    const bloqueada: Estado = { ...base, mundo: { ...base.mundo, marcas: [{ col: 6, fila: 1, tipo: 'casilla_bloqueada' }] } };
    expect(destinosDeViaje(bloqueada)).toEqual([c(7, 0), c(5, 0)]);
    expect(() => viajar(bloqueada, c(6, 1), new Dados(1))).toThrow(/no se puede viajar a 6,1/);
  });

  it('el navegante (sobrenombre o seguidor) llega una casilla más lejos por mar, pasando por agua', () => {
    const normal = destinosDeViaje(en(c(7, 2), true));
    for (const jugador of [{ sobrenombre: 'el_navegante' }, { seguidores: [{ id: 'navegante_1', tipo: 'navegante', nombre: 'Rufo', ataque: 1, resistencia: 10, resistenciaMaxima: 10, habilidades: ['navegacion'] }] }]) {
      const destinos = destinosDeViaje(en(c(7, 2), true, estadoCon(jugador)));
      const lejos = destinos.filter(d => distancia(d, c(7, 2)) === 2);
      expect(lejos.length).toBeGreaterThan(0);
      expect(destinos.slice(0, normal.length)).toEqual(normal);
      for (const d of lejos) {
        expect(esAgua(terreno(d))).toBe(true);
        expect(vecinas(mapa, d).some(m => esAgua(terreno(m)) && distancia(m, c(7, 2)) === 1)).toBe(true);
      }
    }
  });

  it('el navegante a pie no llega más lejos', () => {
    expect(destinosDeViaje(estadoCon({ sobrenombre: 'el_navegante' }))).toEqual([c(7, 0), c(6, 1), c(5, 0)]);
  });

  it('el superviviente llega una casilla más lejos solo si la de en medio y la de destino son jungla profunda', () => {
    const destinos = destinosDeViaje(estadoCon({ sobrenombre: 'el_superviviente' }));
    const lejos = destinos.filter(d => distancia(d, c(6, 0)) === 2);
    expect(lejos.length).toBeGreaterThan(0);
    for (const d of lejos) {
      expect(terreno(d)).toBe('jungla_profunda');
      expect(vecinas(mapa, d).some(m => terreno(m) === 'jungla_profunda' && distancia(m, c(6, 0)) === 1)).toBe(true);
    }
  });

  it('a pie, el barco se queda; a bordo, el barco va contigo', () => {
    const aPie = viajar(estadoCon(), c(6, 1), new Dados(1)).estado;
    expect(aPie.mundo.posicion).toEqual(c(6, 1));
    expect(aPie.mundo.posicionBarco).toEqual(estadoCon().mundo.posicionBarco);

    const destino = destinosDeViaje(en(c(7, 2), true))[0];
    const aBordo = viajar(en(c(7, 2), true), destino, new Dados(1)).estado;
    expect(aBordo.mundo.posicion).toEqual(destino);
    expect(aBordo.mundo.posicionBarco).toEqual(destino);
  });

  it('gasta la acción, llega al puerto (La Habana queda visitada) y toca comer', () => {
    const resultado = viajar(en(c(6, 1)), c(6, 2), new Dados(1));
    expect(resultado.estado.mundo.fase).toBe('comida');
    expect(resultado.estado.mundo.puertosVisitados).toEqual(['la_habana']);
    expect(resultado.puertoNuevo).toBe(true);
  });

  it('a veces salta un evento de la lista del terreno de destino (más o menos la mitad de las veces)', () => {
    let conEvento = 0;
    for (let semilla = 1; semilla <= 400; semilla++) {
      if (viajar(estadoCon(), c(6, 1), new Dados(semilla)).eventos.length) conEvento++;
    }
    expect(conEvento).toBeGreaterThan(150);
    expect(conEvento).toBeLessThan(250);
  });

  it('en una zona de barcos, si sale evento, es un encuentro con un barco (E008)', () => {
    const zona = mapa.casillas.find(x => x.eventosDeBarco)!;
    const desde = aguaJuntoA(zona);
    let conEvento = 0;
    for (let semilla = 1; semilla <= 400; semilla++) {
      const { eventos } = viajar(en(desde, true), zona, new Dados(semilla));
      expect(eventos.every(e => e === 'barco')).toBe(true);
      if (eventos.length) conEvento++;
    }
    expect(conEvento).toBeGreaterThan(150);
    expect(conEvento).toBeLessThan(250);
  });

  it('al llegar a una guarida sin explorar salta su evento (E038), sin tirada de viaje', () => {
    const guarida = c(18, 2);
    for (let semilla = 1; semilla <= 20; semilla++) {
      expect(viajar(en(tierraJuntoA(guarida)), guarida, new Dados(semilla)).eventos).toEqual(['guarida_pirata']);
    }
  });

  it('los eventos señalados en la casilla saltan al entrar', () => {
    const base = estadoCon();
    const conTesoro: Estado = { ...base, mundo: { ...base.mundo, marcas: [{ col: 6, fila: 1, tipo: 'evento', evento: 'cofre' }] } };
    expect(viajar(conTesoro, c(6, 1), new Dados(1)).eventos[0]).toBe('cofre');
  });

  it('con tormenta no se puede viajar', () => {
    const conTormenta = estadoCon({ condiciones: [{ id: 'tormenta' }] });
    expect(condicionesQueImpidenViajar(conTormenta)).toEqual(['tormenta']);
    expect(() => viajar(conTormenta, c(6, 1), new Dados(1))).toThrow(/tormenta/);
  });

  it('solo a una casilla elegible', () => {
    expect(() => viajar(estadoCon(), c(6, 2), new Dados(1))).toThrow(/no se puede viajar a 6,2/);
  });

  it('solo en la fase de acción', () => {
    const { estado } = crearPartida(1, 'Marta'); // fase "inicio"
    expect(() => viajar(estado, c(6, 1), new Dados(1))).toThrow(/fase/);
  });

  it('VICTORIA al llegar a Nassau (el 4.º puerto) con 10 de fama: la partida termina allí, sin evento', () => {
    const nassau = c(27, 2);
    const casi = en(tierraJuntoA(nassau), false, estadoCon({ fama: 10 }, TRES_PUERTOS));
    const resultado = viajar(casi, nassau, new Dados(1));
    expect(resultado.estado.mundo.finPartida?.motivo).toBe('fama_y_puertos');
    expect(resultado.eventos).toEqual([]);
  });
});
