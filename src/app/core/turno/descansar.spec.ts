import { AJUSTES } from '../ajustes/ajustes';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import { descansar, opcionesDeDescanso } from './descansar';
import type { TerrenoAlRaso } from './lugar';

const POSADA = AJUSTES.precioPosada;
const MONASTERIO = AJUSTES.precioMonasterio;

// Una partida en la fase de descanso, herida (10 de 15 PV) y con los valores que queramos.
function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return {
    ...estado,
    jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', vida: 10, vidaMax: 15, oro: 50, ...cambios },
    mundo: { ...estado.mundo, fase: 'descanso', dia: 4 },
  };
}

// "Dormir genial" depende de los dados. Estas dos semillas son la primera con la que se duerme
// genial y la primera con la que no (se buscan solas: valen aunque cambie el porcentaje).
function semillaConLaQueSeDuerme(genial: boolean): number {
  for (let semilla = 1; semilla <= 1000; semilla++) {
    if (new Dados(semilla).probabilidad(AJUSTES.probabilidadDormirGenial / 100) === genial) {
      return semilla;
    }
  }
  throw new Error('No hay ninguna semilla así: revisa AJUSTES.probabilidadDormirGenial');
}
const NOCHE_GENIAL = semillaConLaQueSeDuerme(true);
const NOCHE_NORMAL = semillaConLaQueSeDuerme(false);

// Un seguidor herido (8 de 10).
function seguidor(id: string): Seguidor {
  return { id, tipo: 'forzudo', nombre: id, ataque: 2, resistencia: 8, resistenciaMaxima: 10, habilidades: [] };
}

describe('opcionesDeDescanso', () => {
  it('en el barco solo se puede dormir a bordo, gratis', () => {
    expect(opcionesDeDescanso(estadoCon(), 'barco')).toEqual([{ eleccion: 'a_bordo', precio: 0, alcanzaElOro: true }]);
  });

  it('en un puerto, sin seguidores: posada o intemperie', () => {
    expect(opcionesDeDescanso(estadoCon(), 'puerto')).toEqual([
      { eleccion: 'techo_solo', precio: POSADA, alcanzaElOro: true },
      { eleccion: 'intemperie', precio: 0, alcanzaElOro: true },
    ]);
  });

  it('en un puerto, con seguidores: además, posada para todos (se paga por personaje)', () => {
    const estado = estadoCon({ seguidores: [seguidor('a'), seguidor('b')] });
    expect(opcionesDeDescanso(estado, 'puerto')).toEqual([
      { eleccion: 'techo_solo', precio: POSADA, alcanzaElOro: true },
      { eleccion: 'techo_todos', precio: 3 * POSADA, alcanzaElOro: true },
      { eleccion: 'intemperie', precio: 0, alcanzaElOro: true },
    ]);
  });

  it('el monasterio es como la posada, pero con su precio', () => {
    const estado = estadoCon({ seguidores: [seguidor('a')] });
    expect(opcionesDeDescanso(estado, 'monasterio')).toEqual([
      { eleccion: 'techo_solo', precio: MONASTERIO, alcanzaElOro: true },
      { eleccion: 'techo_todos', precio: 2 * MONASTERIO, alcanzaElOro: true },
      { eleccion: 'intemperie', precio: 0, alcanzaElOro: true },
    ]);
  });

  it('si no llega el oro, la opción sale, pero avisa de que no le llega', () => {
    const estado = estadoCon({ oro: POSADA, seguidores: [seguidor('a')] });
    const opciones = opcionesDeDescanso(estado, 'puerto');
    expect(opciones.find(o => o.eleccion === 'techo_solo')?.alcanzaElOro).toBe(true);
    expect(opciones.find(o => o.eleccion === 'techo_todos')?.alcanzaElOro).toBe(false);
  });

  it('en playa o jungla solo se puede dormir a la intemperie; en la aldea, también convencer a los nativos', () => {
    const intemperie = { eleccion: 'intemperie', precio: 0, alcanzaElOro: true };
    expect(opcionesDeDescanso(estadoCon(), 'intemperie')).toEqual([intemperie]);
    expect(opcionesDeDescanso(estadoCon(), 'aldea')).toEqual([intemperie, { eleccion: 'convencer_nativos', precio: 0, alcanzaElOro: true }]);
  });
});

describe('descansar', () => {
  // -------------------------------------------------------------------------
  describe('lo básico', () => {
    it('solo se puede llamar en la fase de descanso', () => {
      const estado = estadoCon();
      const enComida: Estado = { ...estado, mundo: { ...estado.mundo, fase: 'comida' } };
      expect(() => descansar(enComida, 'a_bordo', 'barco', new Dados(1))).toThrow(/solo se puede descansar en la fase "descanso".*"comida"/);
    });

    it('no se puede llamar si la partida ya ha terminado', () => {
      const estado = estadoCon();
      const terminada: Estado = { ...estado, mundo: { ...estado.mundo, finPartida: { resultado: 'derrota', motivo: 'vida' } } };
      expect(() => descansar(terminada, 'a_bordo', 'barco', new Dados(1))).toThrow(/ya ha terminado/);
    });

    it('no modifica el estado que recibe: devuelve uno nuevo', () => {
      const estado = estadoCon({ seguidores: [seguidor('a')] });
      const copia = structuredClone(estado);
      descansar(estado, 'techo_todos', 'puerto', new Dados(1));
      expect(estado).toEqual(copia);
    });

    it('da error si esa opción no existe en ese lugar', () => {
      expect(() => descansar(estadoCon(), 'techo_solo', 'intemperie', new Dados(1))).toThrow(/en "intemperie" no se puede elegir "techo_solo"/);
      expect(() => descansar(estadoCon(), 'a_bordo', 'puerto', new Dados(1))).toThrow(/en "puerto" no se puede elegir "a_bordo"/);
      expect(() => descansar(estadoCon(), 'techo_todos', 'puerto', new Dados(1))).toThrow(/no se puede elegir "techo_todos"/); // sin seguidores
    });

    it('da error si no llega el oro', () => {
      expect(() => descansar(estadoCon({ oro: POSADA - 1 }), 'techo_solo', 'puerto', new Dados(1))).toThrow(/cuesta .* de oro/);
    });
  });

  // -------------------------------------------------------------------------
  describe('se acaba el día', () => {
    it('el día sube en 1 y la partida vuelve a la fase de inicio', () => {
      const r = descansar(estadoCon(), 'a_bordo', 'barco', new Dados(1));
      expect(r.estado.mundo.dia).toBe(5);
      expect(r.estado.mundo.fase).toBe('inicio');
    });

    it('también al dormir a la intemperie', () => {
      const r = descansar(estadoCon(), 'intemperie', 'intemperie', new Dados(1));
      expect(r.estado.mundo.dia).toBe(5);
      expect(r.estado.mundo.fase).toBe('inicio');
    });

    it('apunta en el estado por dónde van los dados', () => {
      const dados = new Dados(7);
      const r = descansar(estadoCon(), 'intemperie', 'intemperie', dados);
      expect(r.estado.mundo.estadoDados).toBe(dados.obtenerEstado());
    });
  });

  // -------------------------------------------------------------------------
  describe('dónde se duerme', () => {
    it('a bordo, durmiendo genial: gratis, +1 PV al jugador y a sus seguidores', () => {
      const r = descansar(estadoCon({ seguidores: [seguidor('a'), seguidor('b')] }), 'a_bordo', 'barco', new Dados(NOCHE_GENIAL));
      expect(r.haDormidoGenial).toBe(true);
      expect(r.estado.jugador.oro).toBe(50);
      expect(r.estado.jugador.vida).toBe(11);
      expect(r.estado.jugador.seguidores.map(s => s.resistencia)).toEqual([9, 9]);
      expect(r.eventos).toEqual([]);
    });

    it('a bordo, en una noche normal: no se cura nadie', () => {
      const r = descansar(estadoCon({ seguidores: [seguidor('a'), seguidor('b')] }), 'a_bordo', 'barco', new Dados(NOCHE_NORMAL));
      expect(r.haDormidoGenial).toBe(false);
      expect(r.estado.jugador.vida).toBe(10);
      expect(r.estado.jugador.seguidores.map(s => s.resistencia)).toEqual([8, 8]);
      expect(r.cambios).toEqual([]);
    });

    it('posada solo el jugador, durmiendo genial: paga su parte y solo se cura él', () => {
      const r = descansar(estadoCon({ seguidores: [seguidor('a')] }), 'techo_solo', 'puerto', new Dados(NOCHE_GENIAL));
      expect(r.estado.jugador.oro).toBe(50 - POSADA);
      expect(r.estado.jugador.vida).toBe(11);
      expect(r.estado.jugador.seguidores[0].resistencia).toBe(8);
    });

    it('posada para todos, durmiendo genial: paga por cada personaje y se curan todos', () => {
      const r = descansar(estadoCon({ seguidores: [seguidor('a'), seguidor('b')] }), 'techo_todos', 'puerto', new Dados(NOCHE_GENIAL));
      expect(r.estado.jugador.oro).toBe(50 - 3 * POSADA);
      expect(r.estado.jugador.vida).toBe(11);
      expect(r.estado.jugador.seguidores.map(s => s.resistencia)).toEqual([9, 9]);
    });

    it('monasterio: igual que la posada, con su precio', () => {
      const r = descansar(estadoCon({ seguidores: [seguidor('a')] }), 'techo_todos', 'monasterio', new Dados(NOCHE_GENIAL));
      expect(r.estado.jugador.oro).toBe(50 - 2 * MONASTERIO);
      expect(r.estado.jugador.vida).toBe(11);
      expect(r.estado.jugador.seguidores[0].resistencia).toBe(9);
    });

    it('la posada se paga igual aunque la noche sea normal y no cure', () => {
      const r = descansar(estadoCon(), 'techo_solo', 'puerto', new Dados(NOCHE_NORMAL));
      expect(r.estado.jugador.oro).toBe(50 - POSADA);
      expect(r.estado.jugador.vida).toBe(10);
    });

    it('se duerme genial más o menos la mitad de las noches (AJUSTES.probabilidadDormirGenial)', () => {
      let geniales = 0;
      for (let semilla = 1; semilla <= 1000; semilla++) {
        if (descansar(estadoCon(), 'a_bordo', 'barco', new Dados(semilla)).haDormidoGenial) {
          geniales++;
        }
      }
      const esperadas = AJUSTES.probabilidadDormirGenial * 10;
      expect(geniales).toBeGreaterThan(esperadas - 80);
      expect(geniales).toBeLessThan(esperadas + 80);
    });

    it('es una sola tirada para todo el grupo: o se curan todos o ninguno', () => {
      for (let semilla = 1; semilla <= 100; semilla++) {
        const r = descansar(estadoCon({ seguidores: [seguidor('a'), seguidor('b')] }), 'a_bordo', 'barco', new Dados(semilla));
        const curados = [r.estado.jugador.vida - 10, ...r.estado.jugador.seguidores.map(s => s.resistencia - 8)];
        expect(new Set(curados).size).toBe(1);
      }
    });

    it('a bordo o bajo techo gasta un número del generador (la tirada de dormir genial)', () => {
      const dados = new Dados(5);
      const testigo = new Dados(5);
      descansar(estadoCon(), 'a_bordo', 'barco', dados);
      testigo.probabilidad(0.5);
      expect(dados.obtenerEstado()).toBe(testigo.obtenerEstado());
    });

    it('a la intemperie no se tira: nunca se duerme genial', () => {
      const r = descansar(estadoCon(), 'intemperie', 'puerto', new Dados(NOCHE_GENIAL));
      expect('haDormidoGenial' in r).toBe(false);
      expect(r.estado.jugador.vida).toBe(10);
    });

    it('descansar no cura por encima del máximo', () => {
      const sano = { ...seguidor('a'), resistencia: 10 };
      const r = descansar(estadoCon({ vida: 15, seguidores: [sano] }), 'a_bordo', 'barco', new Dados(NOCHE_GENIAL));
      expect(r.estado.jugador.vida).toBe(15);
      expect(r.estado.jugador.seguidores[0].resistencia).toBe(10);
      expect(r.cambios).toEqual([]);
    });

    it('a la intemperie: gratis y no cura a nadie', () => {
      const r = descansar(estadoCon({ seguidores: [seguidor('a')] }), 'intemperie', 'intemperie', new Dados(1));
      expect(r.estado.jugador.oro).toBe(50);
      expect(r.estado.jugador.vida).toBe(10);
      expect(r.estado.jugador.seguidores[0].resistencia).toBe(8);
    });

    it('nadie se marcha por dormir al raso', () => {
      for (let semilla = 1; semilla <= 200; semilla++) {
        const r = descansar(estadoCon({ seguidores: [seguidor('a'), seguidor('b')] }), 'intemperie', 'puerto', new Dados(semilla));
        expect(r.estado.jugador.seguidores).toHaveLength(2);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('eventos nocturnos', () => {
    // Repite la noche con muchas semillas y devuelve los eventos que han saltado.
    function noches(
      eleccion: Parameters<typeof descansar>[1],
      lugar: Parameters<typeof descansar>[2],
      estado = estadoCon(),
      terreno?: TerrenoAlRaso,
    ): string[] {
      const eventos: string[] = [];
      for (let semilla = 1; semilla <= 1000; semilla++) {
        eventos.push(...descansar(estado, eleccion, lugar, new Dados(semilla), undefined, undefined, terreno).eventos);
      }
      return eventos;
    }

    it('en jungla y playa salta un evento nocturno más o menos una de cada cuatro noches (25 %)', () => {
      for (const terreno of ['jungla', 'playa'] as const) {
        const eventos = noches('intemperie', 'intemperie', estadoCon(), terreno);
        expect(eventos.length).toBeGreaterThan(200);
        expect(eventos.length).toBeLessThan(300);
      }
    });

    it('en jungla profunda, más (35 %)', () => {
      const eventos = noches('intemperie', 'intemperie', estadoCon(), 'jungla_profunda');
      expect(eventos.length).toBeGreaterThan(300);
      expect(eventos.length).toBeLessThan(400);
    });

    it('sin decir el terreno (hasta que exista el mapa), se usa el de la jungla', () => {
      expect(noches('intemperie', 'intemperie').length).toBe(noches('intemperie', 'intemperie', estadoCon(), 'jungla').length);
    });

    it('los eventos salen de la lista de eventos nocturnos', () => {
      const eventos = new Set(noches('intemperie', 'intemperie'));
      expect(eventos.has('jaguar')).toBe(true);
      expect(eventos.has('piratas_esqueleto')).toBe(true);
      expect(eventos.has('taberna_clandestina')).toBe(false);
    });

    it('también puede saltar durmiendo al raso junto a una aldea o un monasterio', () => {
      expect(noches('intemperie', 'aldea').length).toBeGreaterThan(0);
      expect(noches('intemperie', 'monasterio').length).toBeGreaterThan(0);
    });

    it('en la calle de un puerto no hay eventos nocturnos', () => {
      expect(noches('intemperie', 'puerto')).toEqual([]);
    });

    it('bajo techo o a bordo no hay eventos nocturnos', () => {
      expect(noches('techo_solo', 'puerto')).toEqual([]);
      expect(noches('techo_solo', 'monasterio')).toEqual([]);
      expect(noches('a_bordo', 'barco')).toEqual([]);
    });

    it('con la misma semilla pasa siempre lo mismo', () => {
      expect(descansar(estadoCon(), 'intemperie', 'intemperie', new Dados(42))).toEqual(descansar(estadoCon(), 'intemperie', 'intemperie', new Dados(42)));
    });
  });

  describe('tienda de campaña', () => {
    const conTienda = (cambios: Partial<Jugador> = {}) => estadoCon({ inventario: [{ id: 'tienda_de_campana' }], ...cambios });
    // Cuántos eventos nocturnos salen en 1000 noches en la tienda.
    const nochesEnTienda = (terreno: TerrenoAlRaso) => {
      let total = 0;
      for (let semilla = 1; semilla <= 1000; semilla++) {
        total += descansar(conTienda(), 'tienda', 'intemperie', new Dados(semilla), undefined, undefined, terreno).eventos.length;
      }
      return total;
    };

    it('solo sale si la llevas, y nunca en un puerto ni a bordo', () => {
      const elecciones = (estado: Estado, lugar: Parameters<typeof opcionesDeDescanso>[1]) => opcionesDeDescanso(estado, lugar).map(o => o.eleccion);
      expect(elecciones(estadoCon(), 'intemperie')).not.toContain('tienda');
      expect(elecciones(conTienda(), 'intemperie')).toContain('tienda');
      expect(elecciones(conTienda(), 'aldea')).toContain('tienda');
      expect(elecciones(conTienda(), 'monasterio')).toContain('tienda');
      expect(elecciones(conTienda(), 'puerto')).not.toContain('tienda');
      expect(elecciones(conTienda(), 'barco')).not.toContain('tienda');
    });

    it('es gratis y todo el grupo puede dormir genial (+1 PV)', () => {
      const estado = conTienda({ seguidores: [{ ...seguidor('forzudo_1'), resistencia: 5 }] });
      const resultado = descansar(estado, 'tienda', 'intemperie', new Dados(NOCHE_GENIAL));
      expect(resultado.haDormidoGenial).toBe(true);
      expect(resultado.estado.jugador.vida).toBe(11);
      expect(resultado.estado.jugador.seguidores[0].resistencia).toBe(6);
      expect(resultado.estado.jugador.oro).toBe(50);
    });

    it('resta 10 puntos al evento nocturno: 25 % → 15 % en la jungla, 35 % → 25 % en jungla profunda', () => {
      const enJungla = nochesEnTienda('jungla');
      expect(enJungla).toBeGreaterThan(100);
      expect(enJungla).toBeLessThan(200);
      const enProfunda = nochesEnTienda('jungla_profunda');
      expect(enProfunda).toBeGreaterThan(200);
      expect(enProfunda).toBeLessThan(300);
    });
  });
});
