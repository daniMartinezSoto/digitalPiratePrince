
import { describe, expect, it } from 'vitest';
import { Dados } from '../dados/dados';
import { crearPersonaje } from './crear-personaje';

describe('crearPersonaje', () => {

  it('debe crear un jugador con todos sus valores iniciales', () => {
    const dados = new Dados(7);

    const jugador = crearPersonaje('Barbanegra', dados);

    expect(jugador).toEqual({
      nombre: 'Barbanegra',
      sobrenombre: 'el_maldito',

      vida: 15,
      vidaMax: 15,
      fuerza: 4,
      ingenio: 2,

      oro: 50,
      tripulacion: 40,
      tripulacionMax: 40,
      comida: 5,
      fama: 0,
      famaObjetivo: 10,

      diasSinComer: 0,

      inventario: [],
      capacidadInventario: 5,

      seguidores: []
    });
  });

  it('debe guardar el nombre recibido', () => {
    const dados = new Dados(7);

    const jugador = crearPersonaje('Capitán Morgan', dados);

    expect(jugador.nombre).toBe('Capitán Morgan');
  });

  it('debe aplicar los ajustes de El fuerte', () => {
    const dados = new Dados(12);

    const jugador = crearPersonaje('Pirata', dados);

    expect(jugador.sobrenombre).toBe('el_fuerte');
    expect(jugador.fuerza).toBe(5);
    expect(jugador.ingenio).toBe(2);
    expect(jugador.capacidadInventario).toBe(7);
  });

  it('debe aplicar los ajustes de El conformista', () => {
    const dados = new Dados(8);

    const jugador = crearPersonaje('Pirata', dados);

    expect(jugador.sobrenombre).toBe('el_conformista');
    expect(jugador.famaObjetivo).toBe(8);
  });

  it('debe generar el mismo personaje utilizando la misma semilla', () => {
    const jugador1 = crearPersonaje('Pirata', new Dados(123));
    const jugador2 = crearPersonaje('Pirata', new Dados(123));

    expect(jugador1).toEqual(jugador2);
  });

});
