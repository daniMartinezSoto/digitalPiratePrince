import type { Jugador } from '../estado/jugador';
import { crearPartida } from '../partida/crear-partida';
import { tieneVinculoNativo } from './vinculo-nativo';

function jugadorCon(cambios: Partial<Jugador> = {}): Jugador {
  return { ...crearPartida(1, 'Prueba').estado.jugador, sobrenombre: 'el_fuerte', ...cambios };
}

describe('tieneVinculoNativo', () => {
  it('un jugador cualquiera no lo tiene', () => {
    expect(tieneVinculoNativo(jugadorCon())).toBe(false);
  });

  it('lo tiene "el nativo"', () => {
    expect(tieneVinculoNativo(jugadorCon({ sobrenombre: 'el_nativo' }))).toBe(true);
  });

  it('lo tiene quien lleva el amuleto kalinago', () => {
    expect(tieneVinculoNativo(jugadorCon({ inventario: [{ id: 'amuleto_kalinago' }] }))).toBe(true);
    expect(tieneVinculoNativo(jugadorCon({ inventario: [{ id: 'idolo_dorado' }] }))).toBe(false);
  });

  it('lo tiene quien va con un seguidor nativo', () => {
    const seguidor = { id: 'a', nombre: 'a', ataque: 2, resistencia: 10, resistenciaMaxima: 10, habilidades: [] };
    expect(tieneVinculoNativo(jugadorCon({ seguidores: [{ ...seguidor, tipo: 'nativo' }] }))).toBe(true);
    expect(tieneVinculoNativo(jugadorCon({ seguidores: [{ ...seguidor, tipo: 'forzudo' }] }))).toBe(false);
  });
});
