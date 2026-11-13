import { Dados } from '../dados/dados';
import type { Jugador } from '../estado/jugador';
import { crearPersonaje } from '../personaje/crear-personaje';
import { calcularModificador } from './calcular-modificador';
import { IDS_TIRADA } from './id-tirada';
import sobrenombres from '../../data/personaje/sobrenombres.json';

// Crea un jugador normal y le pone el sobrenombre que queramos probar.
function jugadorCon(sobrenombre: string): Jugador {
  const base = crearPersonaje('Prueba', new Dados(1));
  return { ...base, sobrenombre };
}

describe('calcularModificador', () => {
  describe('el influyente', () => {
    const influyente = jugadorCon('el_influyente');

    it('tiene +1 al buscar información en puertos', () => {
      expect(calcularModificador(influyente, 'buscar_info_puerto')).toBe(1);
    });

    it('tiene +1 al pedir audiencia en puertos y en guaridas pirata', () => {
      expect(calcularModificador(influyente, 'audiencia_puerto')).toBe(1);
      expect(calcularModificador(influyente, 'audiencia_guarida')).toBe(1);
    });

    it('no tiene bonificador en aldeas', () => {
      expect(calcularModificador(influyente, 'buscar_info_aldea')).toBe(0);
      expect(calcularModificador(influyente, 'audiencia_aldea')).toBe(0);
    });

    it('no tiene bonificador al pescar ni al cazar', () => {
      expect(calcularModificador(influyente, 'pesca')).toBe(0);
      expect(calcularModificador(influyente, 'caza')).toBe(0);
    });
  });

  describe('el nativo', () => {
    const nativo = jugadorCon('el_nativo');

    it('tiene +1 al buscar información y al pedir audiencia en aldeas', () => {
      expect(calcularModificador(nativo, 'buscar_info_aldea')).toBe(1);
      expect(calcularModificador(nativo, 'audiencia_aldea')).toBe(1);
    });

    it('no tiene bonificador en puertos ni en guaridas', () => {
      expect(calcularModificador(nativo, 'buscar_info_puerto')).toBe(0);
      expect(calcularModificador(nativo, 'audiencia_puerto')).toBe(0);
      expect(calcularModificador(nativo, 'audiencia_guarida')).toBe(0);
    });
  });

  it('un sobrenombre sin bonificadores (el fuerte) da 0 en todas las tiradas', () => {
    const fuerte = jugadorCon('el_fuerte');
    for (const id of IDS_TIRADA) {
      expect(calcularModificador(fuerte, id)).toBe(0);
    }
  });

  it('lanza un error si el sobrenombre no existe', () => {
    expect(() => calcularModificador(jugadorCon('el_inventado'), 'pesca')).toThrow(/el_inventado/);
  });

  // Red de seguridad para cuando edites sobrenombres.json a mano.
  describe('datos de sobrenombres.json', () => {
    it('todos los sobrenombres tienen el campo "modificadores"', () => {
      for (const s of sobrenombres) {
        expect(s, `al sobrenombre "${s.id}" le falta "modificadores"`).toHaveProperty('modificadores');
      }
    });

    it('solo usan tiradas que existen y bonificadores enteros', () => {
      const conocidas: readonly string[] = IDS_TIRADA;
      for (const s of sobrenombres) {
        for (const [tirada, valor] of Object.entries(s.modificadores)) {
          expect(conocidas, `"${s.id}" usa una tirada que no existe: "${tirada}"`).toContain(tirada);
          expect(Number.isInteger(valor), `"${s.id}" tiene un bonificador no entero en "${tirada}"`).toBe(true);
        }
      }
    });
  });
});
