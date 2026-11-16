import type { Habilidad } from '../catalogos/habilidad';
import { Dados } from '../dados/dados';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPersonaje } from '../personaje/crear-personaje';
import { crearSeguidor } from '../seguidores/crear-seguidor';
import { calcularModificador } from './calcular-modificador';

// Tests de los bonificadores que dan los seguidores (parte de calcularModificador).

// Un jugador sin bonificadores propios ("el fuerte" no da ninguno a tiradas) con esos seguidores.
function jugadorCon(seguidores: Seguidor[], cambios: Partial<Jugador> = {}): Jugador {
  return { ...crearPersonaje('Prueba', new Dados(1)), sobrenombre: 'el_fuerte', seguidores, ...cambios };
}

// Fabrica seguidores de verdad, del catálogo del juego.
function grupo(...tipos: string[]): Seguidor[] {
  const seguidores: Seguidor[] = [];
  for (const tipo of tipos) {
    seguidores.push(crearSeguidor(tipo, seguidores, new Dados(1)));
  }
  return seguidores;
}

function seguidorSuelto(id: string, habilidades: string[]): Seguidor {
  return { id, tipo: 'raro', nombre: 'Ana', ataque: 2, resistencia: 10, resistenciaMaxima: 10, habilidades };
}

describe('calcularModificador: seguidores', () => {
  it('sin seguidores no hay bonificador', () => {
    expect(calcularModificador(jugadorCon([]), 'audiencia_puerto')).toBe(0);
  });

  it('el barbero-cirujano da +1 en todas las audiencias', () => {
    const jugador = jugadorCon(grupo('barbero_cirujano'));

    expect(calcularModificador(jugador, 'audiencia_puerto')).toBe(1);
    expect(calcularModificador(jugador, 'audiencia_aldea')).toBe(1);
    expect(calcularModificador(jugador, 'audiencia_guarida')).toBe(1);
  });

  it('el barbero-cirujano no da nada al pescar', () => {
    expect(calcularModificador(jugadorCon(grupo('barbero_cirujano')), 'pesca')).toBe(0);
  });

  it('el nativo da +1 en audiencias y en buscar información en aldeas, pero no en puertos', () => {
    const jugador = jugadorCon(grupo('nativo'));

    expect(calcularModificador(jugador, 'audiencia_aldea')).toBe(1);
    expect(calcularModificador(jugador, 'buscar_info_aldea')).toBe(1);
    expect(calcularModificador(jugador, 'audiencia_puerto')).toBe(0);
    expect(calcularModificador(jugador, 'buscar_info_puerto')).toBe(0);
  });

  it('el nativo y la bruja vudú dan +1 contra "el mal está a bordo"', () => {
    expect(calcularModificador(jugadorCon(grupo('nativo')), 'el_mal')).toBe(1);
    expect(calcularModificador(jugadorCon(grupo('bruja_vudu')), 'el_mal')).toBe(1);
  });

  it('un seguidor sin habilidades (el forzudo) no da nada', () => {
    const jugador = jugadorCon(grupo('forzudo'));

    expect(calcularModificador(jugador, 'audiencia_puerto')).toBe(0);
    expect(calcularModificador(jugador, 'el_mal')).toBe(0);
  });

  it('dos seguidores con la misma habilidad suman los dos: dos nativos dan +2', () => {
    expect(calcularModificador(jugadorCon(grupo('nativo', 'nativo')), 'audiencia_aldea')).toBe(2);
  });

  it('seguidores distintos suman cada uno lo suyo: nativo + barbero = +2 en audiencia de aldea', () => {
    expect(calcularModificador(jugadorCon(grupo('nativo', 'barbero_cirujano')), 'audiencia_aldea')).toBe(2);
  });

  it('nativo + bruja vudú = +2 contra el mal', () => {
    expect(calcularModificador(jugadorCon(grupo('nativo', 'bruja_vudu')), 'el_mal')).toBe(2);
  });

  it('se suma con el sobrenombre y los objetos: el nativo + amuleto kalinago + seguidor nativo = +3', () => {
    const jugador = jugadorCon(grupo('nativo'), { sobrenombre: 'el_nativo', inventario: [{ id: 'amuleto_kalinago' }] });

    expect(calcularModificador(jugador, 'audiencia_aldea')).toBe(3);
    expect(calcularModificador(jugador, 'buscar_info_aldea')).toBe(3);
  });

  it('se puede pasar otro catálogo de habilidades (para tests)', () => {
    const habilidades: Habilidad[] = [
      { id: 'ojo_de_halcon', nombre: 'Ojo de halcón', descripcion: 'x', tipo: 'pasiva', modificadores: { caza: 2 } },
    ];
    const cazador = seguidorSuelto('cazador_1', ['ojo_de_halcon']);

    expect(calcularModificador(jugadorCon([cazador]), 'caza', { objetos: [], condiciones: [], habilidades })).toBe(2);
  });

  it('avisa si un seguidor tiene una habilidad que no está en el catálogo', () => {
    const raro = seguidorSuelto('raro_1', ['volar']);

    expect(() => calcularModificador(jugadorCon([raro]), 'pesca')).toThrow(
      /el seguidor "raro_1" tiene la habilidad "volar", que no está en el catálogo/,
    );
  });
});
