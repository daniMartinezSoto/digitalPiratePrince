import { AJUSTES } from '../ajustes/ajustes';
import { Dados } from '../dados/dados';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPersonaje } from '../personaje/crear-personaje';
import { grupoLleno, seguidoresDespedibles } from './consultas';

function seguidor(id: string, inseparable = false): Seguidor {
  const s: Seguidor = { id, tipo: 'forzudo', nombre: id, ataque: 2, resistencia: 10, resistenciaMaxima: 10, habilidades: [] };
  return inseparable ? { ...s, inseparable: true } : s;
}

function jugadorCon(seguidores: Seguidor[]): Jugador {
  return { ...crearPersonaje('Prueba', new Dados(1)), seguidores };
}

describe('grupoLleno', () => {
  it('sin seguidores no está lleno', () => {
    expect(grupoLleno(jugadorCon([]))).toBe(false);
  });

  it('con uno menos del máximo todavía hay sitio', () => {
    const casi = Array.from({ length: AJUSTES.maximoSeguidores - 1 }, (_, i) => seguidor(`s${i}`));

    expect(grupoLleno(jugadorCon(casi))).toBe(false);
  });

  it('con el máximo de seguidores está lleno', () => {
    const lleno = Array.from({ length: AJUSTES.maximoSeguidores }, (_, i) => seguidor(`s${i}`));

    expect(grupoLleno(jugadorCon(lleno))).toBe(true);
  });
});

describe('seguidoresDespedibles', () => {
  it('a un seguidor normal se le puede despedir', () => {
    const jugador = jugadorCon([seguidor('a'), seguidor('b')]);

    expect(seguidoresDespedibles(jugador).map(s => s.id)).toEqual(['a', 'b']);
  });

  it('a un inseparable no', () => {
    const jugador = jugadorCon([seguidor('a'), seguidor('hermano', true), seguidor('c')]);

    expect(seguidoresDespedibles(jugador).map(s => s.id)).toEqual(['a', 'c']);
  });

  it('si todos son inseparables, no se puede despedir a nadie', () => {
    const jugador = jugadorCon([seguidor('a', true), seguidor('b', true)]);

    expect(seguidoresDespedibles(jugador)).toEqual([]);
  });
});
