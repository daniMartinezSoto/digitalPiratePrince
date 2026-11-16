import { TIPOS_SEGUIDOR } from '../catalogos/cargar-seguidores';
import { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import { crearSeguidor } from '../seguidores/crear-seguidor';
import type { Efecto } from '../tablas/efecto';
import { crearPersonaje } from './crear-personaje';

// "El hermano": empieza con un seguidor al azar y gratis. Si ese seguidor muere, pierde la partida.

// Semillas con las que el personaje sale "el hermano" (y una con la que no).
const SEMILLAS_HERMANO = [30, 41, 44, 48, 64, 81, 88, 119, 125, 143, 162, 187, 195, 238, 244, 245, 256, 266, 270, 283, 286, 295];
const SEMILLA_OTRO = 7; // el maldito

// Un seguidor cualquiera, con las marcas que queramos.
function seguidor(id: string, marcas: Partial<Seguidor> = {}): Seguidor {
  return { id, tipo: 'forzudo', nombre: id, ataque: 2, resistencia: 10, resistenciaMaxima: 10, habilidades: [], ...marcas };
}

// Una partida de un personaje sin reglas raras, con esos seguidores.
function estadoCon(seguidores: Seguidor[]): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado, jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', seguidores } };
}

const MATAR_A_UNO_AL_AZAR: Efecto = { tipo: 'vida', operacion: 'todo', destino: 'seguidor_azar' };

describe('el hermano: al crear el personaje', () => {
  it('las semillas de prueba dan de verdad "el hermano"', () => {
    for (const semilla of SEMILLAS_HERMANO) {
      expect(crearPersonaje('Prueba', new Dados(semilla)).sobrenombre, `semilla ${semilla}`).toBe('el_hermano');
    }
    expect(crearPersonaje('Prueba', new Dados(SEMILLA_OTRO)).sobrenombre).not.toBe('el_hermano');
  });

  it('empieza con un seguidor, y solo uno', () => {
    const hermano = crearPersonaje('Prueba', new Dados(30));

    expect(hermano.seguidores).toHaveLength(1);
  });

  it('ese seguidor es inseparable y vital', () => {
    const [seguidorInicial] = crearPersonaje('Prueba', new Dados(30)).seguidores;

    expect(seguidorInicial.inseparable).toBe(true);
    expect(seguidorInicial.vital).toBe(true);
  });

  it('es de un tipo del catálogo, con los números de su ficha, la resistencia entera y un nombre', () => {
    const [seguidorInicial] = crearPersonaje('Prueba', new Dados(30)).seguidores;
    const ficha = TIPOS_SEGUIDOR.find(t => t.id === seguidorInicial.tipo);

    expect(ficha).toBeDefined();
    expect(seguidorInicial.ataque).toBe(ficha?.ataque ?? 2);
    expect(seguidorInicial.resistenciaMaxima).toBe(ficha?.resistencia ?? 10);
    expect(seguidorInicial.resistencia).toBe(seguidorInicial.resistenciaMaxima);
    expect(seguidorInicial.nombre.length).toBeGreaterThan(0);
  });

  it('es gratis: empieza con el mismo oro que cualquiera', () => {
    expect(crearPersonaje('Prueba', new Dados(30)).oro).toBe(50);
  });

  it('con la misma semilla sale el mismo seguidor', () => {
    const uno = crearPersonaje('Prueba', new Dados(30));
    const otro = crearPersonaje('Prueba', new Dados(30));

    expect(uno.seguidores).toEqual(otro.seguidores);
  });

  it('según la partida, el seguidor es de tipos distintos', () => {
    const tipos = new Set(SEMILLAS_HERMANO.map(semilla => crearPersonaje('Prueba', new Dados(semilla)).seguidores[0].tipo));

    expect(tipos.size).toBeGreaterThan(1);
  });

  it('los demás sobrenombres empiezan sin seguidores', () => {
    expect(crearPersonaje('Prueba', new Dados(SEMILLA_OTRO)).seguidores).toEqual([]);
  });
});

describe('crearSeguidor: vital', () => {
  it('se puede crear vital', () => {
    expect(crearSeguidor('forzudo', [], new Dados(1), { vital: true }).vital).toBe(true);
  });

  it('un seguidor normal no lleva el campo "vital"', () => {
    expect('vital' in crearSeguidor('forzudo', [], new Dados(1))).toBe(false);
  });

  it('vital e inseparable son cosas distintas: se puede ser una sin la otra', () => {
    const soloVital = crearSeguidor('forzudo', [], new Dados(1), { vital: true });
    const soloInseparable = crearSeguidor('forzudo', [], new Dados(1), { inseparable: true });

    expect('inseparable' in soloVital).toBe(false);
    expect('vital' in soloInseparable).toBe(false);
  });
});

describe('si muere un seguidor vital, se pierde la partida', () => {
  it('la partida termina en derrota, con motivo "seguidor"', () => {
    const estado = estadoCon([seguidor('hermano', { inseparable: true, vital: true })]);

    const { estado: nuevo } = aplicarEfectos(estado, [MATAR_A_UNO_AL_AZAR], new Dados(1));

    expect(nuevo.mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'seguidor' });
  });

  it('el chivato cuenta las dos cosas: que ha muerto y que la partida termina', () => {
    const estado = estadoCon([seguidor('hermano', { vital: true })]);

    const { cambios } = aplicarEfectos(estado, [MATAR_A_UNO_AL_AZAR], new Dados(1));

    expect(cambios).toEqual([
      { tipo: 'resistencia_seguidor', seguidor: 'hermano', antes: 10, despues: 0 },
      { tipo: 'seguidor_muerto', seguidor: 'hermano' },
      { tipo: 'fin_partida', fin: { resultado: 'derrota', motivo: 'seguidor' } },
    ]);
  });

  it('también si muere por un daño a todo el grupo', () => {
    const estado = estadoCon([seguidor('hermano', { vital: true, resistencia: 2 })]);

    const { estado: nuevo } = aplicarEfectos(estado, [{ tipo: 'vida', cantidad: -3, destino: 'todos' }], new Dados(1));

    expect(nuevo.mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'seguidor' });
  });

  it('si solo queda herido, la partida sigue', () => {
    const estado = estadoCon([seguidor('hermano', { vital: true })]);

    const { estado: nuevo } = aplicarEfectos(estado, [{ tipo: 'vida', cantidad: -3, destino: 'todos' }], new Dados(1));

    expect(nuevo.jugador.seguidores[0].resistencia).toBe(7);
    expect(nuevo.mundo.finPartida).toBeNull();
  });

  it('la muerte de un seguidor normal no termina la partida', () => {
    const estado = estadoCon([seguidor('forzudo_1')]);

    const { estado: nuevo } = aplicarEfectos(estado, [MATAR_A_UNO_AL_AZAR], new Dados(1));

    expect(nuevo.jugador.seguidores).toEqual([]);
    expect(nuevo.mundo.finPartida).toBeNull();
  });

  it('la muerte de un inseparable que no es vital tampoco', () => {
    const estado = estadoCon([seguidor('naufrago', { inseparable: true })]);

    const { estado: nuevo } = aplicarEfectos(estado, [MATAR_A_UNO_AL_AZAR], new Dados(1));

    expect(nuevo.mundo.finPartida).toBeNull();
  });

  it('tras la derrota, los efectos que quedan ya no se aplican', () => {
    const estado = estadoCon([seguidor('hermano', { vital: true })]);

    const { estado: nuevo } = aplicarEfectos(estado, [MATAR_A_UNO_AL_AZAR, { tipo: 'oro', cantidad: 100 }], new Dados(1));

    expect(nuevo.jugador.oro).toBe(estado.jugador.oro);
  });

  it('una partida de "el hermano" de principio a fin: muere su seguidor y pierde', () => {
    const { estado, dados } = crearPartida(30, 'Prueba');

    const { estado: nuevo } = aplicarEfectos(estado, [MATAR_A_UNO_AL_AZAR], dados);

    expect(nuevo.jugador.seguidores).toEqual([]);
    expect(nuevo.mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'seguidor' });
  });
});
