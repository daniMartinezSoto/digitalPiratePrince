import type { Estado } from '../estado/estado';
import type { FinPartida } from '../estado/fin-partida';
import { crearPartida } from '../partida/crear-partida';
import { conCausaDeMuerte } from './causa-de-muerte';

// Por qué has muerto (22-nov): quien hace el daño apunta la causa; solo la primera, y solo en derrotas
// por vida, tripulación o un "perder_partida" de un evento.

function terminada(fin: FinPartida | null): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado, mundo: { ...estado.mundo, finPartida: fin } };
}

describe('conCausaDeMuerte', () => {
  it('apunta la causa en una derrota por vida o por tripulación', () => {
    expect(conCausaDeMuerte(terminada({ resultado: 'derrota', motivo: 'vida' }), { tipo: 'hambre' }).mundo.finPartida).toEqual({
      resultado: 'derrota',
      motivo: 'vida',
      causa: { tipo: 'hambre' },
    });
    expect(conCausaDeMuerte(terminada({ resultado: 'derrota', motivo: 'tripulacion' }), { tipo: 'combate_naval', barco: 'x' }).mundo.finPartida!.causa).toEqual({
      tipo: 'combate_naval',
      barco: 'x',
    });
  });

  it('si la partida sigue, no hace nada', () => {
    const estado = terminada(null);
    expect(conCausaDeMuerte(estado, { tipo: 'hambre' })).toBe(estado);
  });

  it('no cambia una causa ya apuntada (manda la primera)', () => {
    const estado = terminada({ resultado: 'derrota', motivo: 'vida', causa: { tipo: 'hambre' } });
    expect(conCausaDeMuerte(estado, { tipo: 'accion', accion: 'cazar' }).mundo.finPartida!.causa).toEqual({ tipo: 'hambre' });
  });

  it('ni en victorias, ni al abandonar, ni por el seguidor vital', () => {
    for (const fin of [
      { resultado: 'victoria', motivo: 'fama_y_puertos' },
      { resultado: 'derrota', motivo: 'abandono' },
      { resultado: 'derrota', motivo: 'seguidor' },
    ] as FinPartida[]) {
      expect(conCausaDeMuerte(terminada(fin), { tipo: 'hambre' }).mundo.finPartida!.causa).toBeUndefined();
    }
  });
});
