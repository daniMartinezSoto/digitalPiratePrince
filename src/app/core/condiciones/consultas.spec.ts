import type { Condicion } from '../catalogos/condicion';
import type { Jugador } from '../estado/jugador';
import { crearPartida } from '../partida/crear-partida';
import { comidaPorDia, condicionesQueProhiben, estaProhibido, famaObjetivoActual } from './consultas';

// Catálogo de prueba (inventado para los tests, no es el del juego).
const CATALOGO: Condicion[] = [
  { id: 'tormenta', nombre: 'Tormenta', descripcion: 'x', categoria: 'clima', prohibe: ['viajar'] },
  { id: 'calma_chicha', nombre: 'Calma chicha', descripcion: 'x', categoria: 'clima', prohibe: ['viajar'] },
  { id: 'rechazo_autoridad', nombre: 'Rechazo a la autoridad', descripcion: 'x', categoria: 'maldicion', prohibe: ['solicitar_audiencia'] },
  { id: 'ambicion', nombre: 'Ambición desmedida', descripcion: 'x', categoria: 'maldicion', ajustes: { famaObjetivo: 2 } },
  { id: 'humildad', nombre: 'Humildad', descripcion: 'x', categoria: 'bendicion', ajustes: { famaObjetivo: -20 } },
  { id: 'hambre', nombre: 'Hambre insaciable', descripcion: 'x', categoria: 'maldicion', ajustes: { comidaPorDia: 1 } },
  { id: 'ayuno', nombre: 'Ayuno', descripcion: 'x', categoria: 'bendicion', ajustes: { comidaPorDia: -5 } },
  { id: 'escorbuto', nombre: 'Escorbuto', descripcion: 'x', categoria: 'enfermedad' },
];

// Un jugador normal con las condiciones (por id) y los valores que queramos.
function jugadorCon(idsCondiciones: string[], cambios: Partial<Jugador> = {}): Jugador {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado.jugador, famaObjetivo: 10, condiciones: idsCondiciones.map(id => ({ id })), ...cambios };
}

describe('consultas sobre condiciones', () => {
  describe('estaProhibido', () => {
    it('sin condiciones, nada está prohibido', () => {
      expect(estaProhibido(jugadorCon([]), 'viajar', CATALOGO)).toBe(false);
    });

    it('con tormenta no se puede viajar', () => {
      expect(estaProhibido(jugadorCon(['tormenta']), 'viajar', CATALOGO)).toBe(true);
    });

    it('una condición solo prohíbe lo suyo', () => {
      const jugador = jugadorCon(['tormenta']);
      expect(estaProhibido(jugador, 'solicitar_audiencia', CATALOGO)).toBe(false);
      expect(estaProhibido(jugador, 'enterrar_tesoro', CATALOGO)).toBe(false);
    });

    it('una condición que no prohíbe nada no molesta', () => {
      expect(estaProhibido(jugadorCon(['escorbuto', 'ambicion']), 'viajar', CATALOGO)).toBe(false);
    });

    it('al quitarse la condición, deja de estar prohibido', () => {
      const jugador = jugadorCon(['tormenta']);
      const sinTormenta = { ...jugador, condiciones: [] };
      expect(estaProhibido(sinTormenta, 'viajar', CATALOGO)).toBe(false);
    });
  });

  describe('condicionesQueProhiben', () => {
    it('dice qué condiciones lo prohíben, en el orden en que las tiene el jugador', () => {
      const jugador = jugadorCon(['calma_chicha', 'escorbuto', 'tormenta']);
      expect(condicionesQueProhiben(jugador, 'viajar', CATALOGO)).toEqual(['calma_chicha', 'tormenta']);
    });

    it('lista vacía si nada lo prohíbe', () => {
      expect(condicionesQueProhiben(jugadorCon(['escorbuto']), 'viajar', CATALOGO)).toEqual([]);
    });
  });

  describe('famaObjetivoActual', () => {
    it('sin condiciones, es la del personaje', () => {
      expect(famaObjetivoActual(jugadorCon([]), CATALOGO)).toBe(10);
      expect(famaObjetivoActual(jugadorCon([], { famaObjetivo: 8 }), CATALOGO)).toBe(8); // el conformista
    });

    it('la ambición desmedida pide 2 puntos más', () => {
      expect(famaObjetivoActual(jugadorCon(['ambicion']), CATALOGO)).toBe(12);
      expect(famaObjetivoActual(jugadorCon(['ambicion'], { famaObjetivo: 8 }), CATALOGO)).toBe(10);
    });

    it('no cambia el número apuntado en el personaje', () => {
      const jugador = jugadorCon(['ambicion']);
      famaObjetivoActual(jugador, CATALOGO);
      expect(jugador.famaObjetivo).toBe(10);
    });

    it('nunca baja de 1', () => {
      expect(famaObjetivoActual(jugadorCon(['humildad']), CATALOGO)).toBe(1);
    });
  });

  describe('comidaPorDia', () => {
    it('lo normal es 1 reserva al día', () => {
      expect(comidaPorDia(jugadorCon([]), CATALOGO)).toBe(1);
    });

    it('el hambre insaciable pide 1 reserva más', () => {
      expect(comidaPorDia(jugadorCon(['hambre']), CATALOGO)).toBe(2);
    });

    it('nunca baja de 0', () => {
      expect(comidaPorDia(jugadorCon(['ayuno']), CATALOGO)).toBe(0);
    });
  });

  it('avisa si el jugador tiene una condición que no está en el catálogo', () => {
    expect(() => estaProhibido(jugadorCon(['inventada']), 'viajar', CATALOGO)).toThrow(/"inventada".*no está en el catálogo/);
  });

  it('por defecto usa el catálogo del juego: la tormenta real prohíbe viajar', () => {
    expect(estaProhibido(jugadorCon(['tormenta']), 'viajar')).toBe(true);
    expect(estaProhibido(jugadorCon(['escorbuto']), 'viajar')).toBe(false);
  });
});
