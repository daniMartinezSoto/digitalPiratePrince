import { crearPartida } from '../partida/crear-partida';
import { obtenerMapa } from './cargar-mapas';
import { casillaActual, casillaInicialDelBarco, mapaDeLaPartida, vasABordo } from './donde-estas';
import type { Casilla, Mapa } from './mapa';

describe('dónde estás y dónde está el barco', () => {
  it('el barco empieza en la primera vecina de agua de La Habana (N, NE, SE, S, SO, NO)', () => {
    const mapa = obtenerMapa('primer-mapa-prueba');
    const barco = casillaInicialDelBarco(mapa)!;
    // La Habana está en 6,2 (columna par): su N (6,1) es tierra; su NE (7,1)...
    const casilla = mapa.casillas[barco.fila * mapa.columnas + barco.col];

    expect(casilla.terreno === 'costa' || casilla.terreno === 'alta_mar').toBe(true);
    expect([
      { col: 6, fila: 1 },
      { col: 7, fila: 1 },
      { col: 7, fila: 2 },
      { col: 6, fila: 3 },
      { col: 5, fila: 2 },
      { col: 5, fila: 1 },
    ]).toContainEqual(barco);
  });

  it('si el puerto principal más cercano no tiene agua al lado, no hay sitio para el barco', () => {
    const casillas: Casilla[] = [0, 1, 2].map(col => ({ col, fila: 0, terreno: 'playa' as const }));
    const mapa: Mapa = {
      id: 'seco',
      nombre: 'Seco',
      columnas: 3,
      filas: 1,
      inicio: { col: 0, fila: 0 },
      puertosPrincipales: [{ id: 'la_habana', nombre: 'La Habana', col: 1, fila: 0 }],
      casillas,
    };

    expect(casillaInicialDelBarco(mapa)).toBeNull();
  });

  it('vas a bordo solo si estás en la casilla del barco', () => {
    const { estado } = crearPartida(123, 'Marta');
    const aBordo = { ...estado, mundo: { ...estado.mundo, posicion: { ...estado.mundo.posicionBarco } } };

    expect(vasABordo(estado)).toBe(false);
    expect(vasABordo(aBordo)).toBe(true);
  });

  it('la casilla en la que estás, con su terreno', () => {
    const { estado } = crearPartida(123, 'Marta');

    expect(mapaDeLaPartida(estado).id).toBe('primer-mapa-prueba');
    expect(casillaActual(estado)).toMatchObject({ col: 6, fila: 0, terreno: 'jungla_profunda' });
  });

  it('avisa si la posición cae fuera del mapa', () => {
    const { estado } = crearPartida(123, 'Marta');
    const perdido = { ...estado, mundo: { ...estado.mundo, posicion: { col: 99, fila: 0 } } };

    expect(() => casillaActual(perdido)).toThrow(/fuera del mapa/);
  });
});
