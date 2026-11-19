import { Dados } from '../dados/dados';
import { crearPartida } from './crear-partida';

describe('crearPartida', () => {
  it('crea un estado inicial completo', () => {
    const { estado } = crearPartida(123, 'Marta');
    expect(estado.version).toBe(1);
    expect(estado.jugador.nombre).toBe('Marta');
    expect(estado.jugador.oro).toBe(50);
    expect(estado.jugador.comida).toBe(5);
    expect(estado.jugador.fama).toBe(0);
    expect(estado.mundo.dia).toBe(1);
    expect(estado.mundo.mapaId).toBeNull();
    expect(estado.mundo.pilaEventos).toEqual([]);
    expect(estado.mundo.finPartida).toBeNull();
  });

  it('una partida nueva empieza en el día 1, en la fase de inicio', () => {
    const { estado } = crearPartida(123, 'Marta');
    expect(estado.mundo.dia).toBe(1);
    expect(estado.mundo.fase).toBe('inicio');
  });

  it('con la misma semilla genera siempre el mismo estado', () => {
    const a = crearPartida(2024, 'Marta');
    const b = crearPartida(2024, 'Marta');
    expect(a.estado).toEqual(b.estado);
  });

  it('con semillas distintas no siempre sale el mismo personaje', () => {
    const sobrenombres = new Set<string>();
    for (let semilla = 1; semilla <= 50; semilla++) {
      sobrenombres.add(crearPartida(semilla, 'Marta').estado.jugador.sobrenombre);
    }
    expect(sobrenombres.size).toBeGreaterThan(1);
  });

  it('guarda en el estado la semilla con la que empezó (Sprint 8)', () => {
    const { estado } = crearPartida(7, 'Marta');
    expect(estado.mundo.semilla).toBe(7);
  });

  it('la semilla no cambia aunque los dados avancen', () => {
    const { estado } = crearPartida(2024, 'Marta');
    expect(estado.mundo.semilla).toBe(2024);
    expect(estado.mundo.estadoDados).not.toBe(2024); // crear el personaje ya ha gastado dados
  });

  it('guarda en el estado el número interno de los dados', () => {
    const { estado, dados } = crearPartida(7, 'Marta');
    expect(estado.mundo.estadoDados).toBe(dados.obtenerEstado());
  });

  it('el estado sobrevive a JSON.stringify y JSON.parse sin perder nada', () => {
    const { estado } = crearPartida(99, 'Marta');
    const recuperado = JSON.parse(JSON.stringify(estado));
    expect(recuperado).toEqual(estado);
  });

  it('un Dados creado con estadoDados continúa la misma secuencia', () => {
    const { estado, dados } = crearPartida(555, 'Marta');
    const recuperado = new Dados(estado.mundo.estadoDados);
    for (let i = 0; i < 20; i++) {
      expect(recuperado.tirar('2d6')).toEqual(dados.tirar('2d6'));
    }
  });
});