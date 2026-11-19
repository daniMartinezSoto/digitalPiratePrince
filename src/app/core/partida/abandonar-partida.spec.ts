import { aplicarEfectos } from '../efectos/aplicar-efectos';
import { abandonarPartida } from './abandonar-partida';
import { crearPartida } from './crear-partida';
import { esSemillaValida, SEMILLA_MAXIMA } from './semilla';

describe('abandonarPartida', () => {
  it('termina la partida como derrota por abandono', () => {
    const { estado } = crearPartida(123, 'Marta');
    expect(abandonarPartida(estado).mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'abandono' });
  });

  it('no toca el estado que recibe ni gasta dados', () => {
    const { estado } = crearPartida(123, 'Marta');
    const copia = structuredClone(estado);
    const abandonada = abandonarPartida(estado);
    expect(estado).toEqual(copia);
    expect(abandonada.mundo.estadoDados).toBe(estado.mundo.estadoDados);
  });

  it('da error si la partida ya había terminado', () => {
    const { estado, dados } = crearPartida(123, 'Marta');
    const muerta = aplicarEfectos(estado, [{ tipo: 'vida', operacion: 'todo' }], dados).estado;
    expect(() => abandonarPartida(muerta)).toThrow();
  });
});

describe('la semilla de 6 cifras', () => {
  it.each([0, 7, 482913, SEMILLA_MAXIMA])('%s vale', semilla => {
    expect(esSemillaValida(semilla)).toBe(true);
  });

  it.each([-1, SEMILLA_MAXIMA + 1, 1.5, NaN, '123', null])('%s no vale', semilla => {
    expect(esSemillaValida(semilla)).toBe(false);
  });
});
