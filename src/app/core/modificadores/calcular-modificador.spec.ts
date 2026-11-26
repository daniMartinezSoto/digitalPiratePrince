import type { Condicion } from '../catalogos/condicion';
import { OBJETOS } from '../catalogos/cargar-objetos';
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

  describe('el paso rocoso (E012)', () => {
    const seguidorDe = (tipo: string, habilidad: string) =>
      ({ id: `${tipo}_1`, tipo, nombre: 'X', ataque: 1, resistencia: 8, resistenciaMaxima: 8, habilidades: [habilidad] });

    it('navegante y cartógrafo dan +1 cada uno: con los dos, +2', () => {
      const base = jugadorCon('el_fuerte');
      expect(calcularModificador(base, 'rocas')).toBe(0);
      expect(calcularModificador({ ...base, seguidores: [seguidorDe('navegante', 'navegacion')] }, 'rocas')).toBe(1);
      expect(calcularModificador({ ...base, seguidores: [seguidorDe('cartografo', 'cartografia')] }, 'rocas')).toBe(1);
      expect(calcularModificador({ ...base, seguidores: [seguidorDe('navegante', 'navegacion'), seguidorDe('cartografo', 'cartografia')] }, 'rocas')).toBe(2);
    });

    it('el sobrenombre "el navegante" también da +1', () => {
      expect(calcularModificador(jugadorCon('el_navegante'), 'rocas')).toBe(1);
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

  describe('objetos que lleva', () => {
    it('el amuleto kalinago da +1 al buscar información y al pedir audiencia en aldeas', () => {
      const jugador = { ...jugadorCon('el_fuerte'), inventario: [{ id: 'amuleto_kalinago' }] };

      expect(calcularModificador(jugador, 'buscar_info_aldea')).toBe(1);
      expect(calcularModificador(jugador, 'audiencia_aldea')).toBe(1);
      expect(calcularModificador(jugador, 'buscar_info_puerto')).toBe(0);
    });

    it('se suma al sobrenombre: el nativo con el amuleto kalinago tiene +2 en aldeas', () => {
      const jugador = { ...jugadorCon('el_nativo'), inventario: [{ id: 'amuleto_kalinago' }] };

      expect(calcularModificador(jugador, 'buscar_info_aldea')).toBe(2);
    });

    it('un objeto sin bonificadores no suma nada', () => {
      const jugador = { ...jugadorCon('el_fuerte'), inventario: [{ id: 'mano_de_mono', usosRestantes: 2 }] };

      expect(calcularModificador(jugador, 'buscar_info_aldea')).toBe(0);
    });

    it('lanza un error si lleva un objeto que no está en el catálogo', () => {
      const jugador = { ...jugadorCon('el_fuerte'), inventario: [{ id: 'objeto_inventado' }] };

      expect(() => calcularModificador(jugador, 'pesca')).toThrow(/objeto_inventado/);
    });
  });

  describe('condiciones que tiene', () => {
    // El catálogo real todavía no tiene condiciones con bonificadores,
    // así que en estos tests le pasamos un catálogo de prueba.
    const condicionesDePrueba: Condicion[] = [
      { id: 'mareo', nombre: 'Mareo', descripcion: 'Todo da vueltas.', categoria: 'enfermedad', modificadores: { pesca: -2 } },
      { id: 'buena_estrella', nombre: 'Buena estrella', descripcion: 'La suerte te sonríe.', categoria: 'bendicion', modificadores: { pesca: 1 } },
    ];
    const catalogos = { objetos: OBJETOS, condiciones: condicionesDePrueba };

    it('una condición resta o suma su bonificador', () => {
      const mareado = { ...jugadorCon('el_fuerte'), condiciones: [{ id: 'mareo', turnosRestantes: 2 }] };

      expect(calcularModificador(mareado, 'pesca', catalogos)).toBe(-2);
      expect(calcularModificador(mareado, 'caza', catalogos)).toBe(0);
    });

    it('varias condiciones se suman entre sí', () => {
      const jugador = { ...jugadorCon('el_fuerte'), condiciones: [{ id: 'mareo' }, { id: 'buena_estrella' }] };

      expect(calcularModificador(jugador, 'pesca', catalogos)).toBe(-1);
    });

    it('lanza un error si tiene una condición que no está en el catálogo', () => {
      const jugador = { ...jugadorCon('el_fuerte'), condiciones: [{ id: 'condicion_inventada' }] };

      expect(() => calcularModificador(jugador, 'pesca')).toThrow(/condicion_inventada/);
    });
  });

  describe('por cada X de fama (capitán pirata: +1 por cada 2)', () => {
    it('sin fama no suma nada', () => {
      expect(calcularModificador(jugadorCon('el_fuerte'), 'audiencia_guarida')).toBe(0);
    });

    it('con 5 de fama suma +2 (se redondea hacia abajo)', () => {
      const famoso = { ...jugadorCon('el_fuerte'), fama: 5 };
      expect(calcularModificador(famoso, 'audiencia_guarida')).toBe(2);
    });

    it('solo cuenta en las tiradas que lo tienen', () => {
      const famoso = { ...jugadorCon('el_fuerte'), fama: 6 };
      expect(calcularModificador(famoso, 'audiencia_puerto')).toBe(0);
    });

    it('se suma a todo lo demás: el influyente con 4 de fama tiene +3 con el capitán pirata', () => {
      const jugador = { ...jugadorCon('el_influyente'), fama: 4 };
      expect(calcularModificador(jugador, 'audiencia_guarida')).toBe(3);
    });
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
