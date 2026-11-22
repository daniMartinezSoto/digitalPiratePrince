import { crearPartida } from '../partida/crear-partida';
import { dadosTrucados } from '../dados/dados-trucados';
import type { Jugador } from '../estado/jugador';
import { chequeo } from './chequeo';

// Chequeos (Sprint 6) con las reglas del 22-nov: máximo 5 y un 6 siempre falla.

function jugador(cambios: Partial<Jugador>): Jugador {
  return { ...crearPartida(1, 'Prueba').estado.jugador, condiciones: [], inventario: [], seguidores: [], ...cambios };
}

describe('chequeo de Fuerza o Ingenio', () => {
  it('se supera sacando la característica o menos', () => {
    expect(chequeo(jugador({ fuerza: 3 }), 'fuerza', 0, dadosTrucados([3])).superado).toBe(true);
    expect(chequeo(jugador({ fuerza: 3 }), 'fuerza', 0, dadosTrucados([4])).superado).toBe(false);
  });

  it('un 6 en el dado falla siempre, aunque con el modificador el total lo permita', () => {
    // Fuerza 5 contra el borracho (−1): 6 − 1 = 5 pasaría, pero un 6 natural falla.
    const r = chequeo(jugador({ fuerza: 5 }), 'fuerza', -1, dadosTrucados([6]));
    expect(r.total).toBe(5);
    expect(r.superado).toBe(false);
  });

  it('con el amuleto, la característica no pasa de 5 (ingenio 4 + súper cerebro = 5, no 6)', () => {
    const conAmuleto = jugador({ ingenio: 4, condiciones: [{ id: 'amuleto_maldito', partes: ['super_cerebro', 'hedor_nauseabundo'] }] });
    expect(chequeo(conAmuleto, 'ingenio', 0, dadosTrucados([5])).valor).toBe(5);
  });

  it('el dado fijo de la trampa de prueba manda', () => {
    expect(chequeo(jugador({ fuerza: 3 }), 'fuerza', 0, dadosTrucados([]), 2)).toMatchObject({ dado: 2, superado: true });
  });
});
