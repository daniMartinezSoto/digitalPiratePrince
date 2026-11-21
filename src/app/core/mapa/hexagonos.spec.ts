import { Dados } from '../dados/dados';
import { dadosTrucados } from '../dados/dados-trucados';
import { esAgua } from '../turno/lugar';
import { obtenerMapa } from './cargar-mapas';
import {
  avanzar,
  dentroDelMapa,
  direccionDelLibro,
  DIRECCIONES,
  distancia,
  mismaCasilla,
  sonVecinas,
  vecinaAlAzar,
  vecinaEn,
  vecinas,
} from './hexagonos';
import type { Casilla, Mapa } from './mapa';

// Mapa de juguete de 5 × 4, todo playa salvo la columna 4 (costa).
function mapaDePrueba(): Mapa {
  const casillas: Casilla[] = [];
  for (let fila = 0; fila < 4; fila++) for (let col = 0; col < 5; col++) casillas.push({ col, fila, terreno: col === 4 ? 'costa' : 'playa' });
  return { id: 'juguete', nombre: 'Juguete', columnas: 5, filas: 4, inicio: { col: 0, fila: 0 }, puertosPrincipales: [], casillas };
}

const c = (col: number, fila: number) => ({ col, fila });

describe('cuentas de hexágonos', () => {
  describe('vecinas', () => {
    it('columna par: el NE y el NO suben una fila', () => {
      const vec = Object.fromEntries(DIRECCIONES.map(d => [d, vecinaEn(c(2, 2), d)]));

      expect(vec).toEqual({ N: c(2, 1), NE: c(3, 1), SE: c(3, 2), S: c(2, 3), SO: c(1, 2), NO: c(1, 1) });
    });

    it('columna impar: el SE y el SO bajan una fila', () => {
      const vec = Object.fromEntries(DIRECCIONES.map(d => [d, vecinaEn(c(3, 2), d)]));

      expect(vec).toEqual({ N: c(3, 1), NE: c(4, 2), SE: c(4, 3), S: c(3, 3), SO: c(2, 3), NO: c(2, 2) });
    });

    it('ir en una dirección y volver en la contraria deja en la misma casilla', () => {
      const contraria = { N: 'S', NE: 'SO', SE: 'NO', S: 'N', SO: 'NE', NO: 'SE' } as const;
      for (const desde of [c(2, 2), c(3, 2)]) {
        for (const d of DIRECCIONES) expect(vecinaEn(vecinaEn(desde, d), contraria[d])).toEqual(desde);
      }
    });

    it('en medio hay 6; en los bordes y esquinas, menos (las de fuera no cuentan)', () => {
      const mapa = mapaDePrueba();

      expect(vecinas(mapa, c(2, 2))).toHaveLength(6);
      expect(vecinas(mapa, c(0, 0))).toEqual([c(1, 0), c(0, 1)]); // SE y S
      expect(vecinas(mapa, c(4, 3))).toEqual([c(4, 2), c(3, 3), c(3, 2)]); // N, SO y NO
    });

    it('dentro y fuera del mapa', () => {
      const mapa = mapaDePrueba();

      expect(dentroDelMapa(mapa, c(4, 3))).toBe(true);
      expect(dentroDelMapa(mapa, c(5, 0))).toBe(false);
      expect(dentroDelMapa(mapa, c(0, -1))).toBe(false);
    });
  });

  describe('distancia', () => {
    it('0 a sí misma y 1 a cada vecina', () => {
      expect(distancia(c(3, 2), c(3, 2))).toBe(0);
      for (const d of DIRECCIONES) expect(distancia(c(3, 2), vecinaEn(c(3, 2), d))).toBe(1);
    });

    it('cuenta pasos de hexágono, no casillas en línea recta', () => {
      expect(distancia(c(0, 0), c(0, 3))).toBe(3); // en vertical, una por fila
      expect(distancia(c(0, 0), c(4, 0))).toBe(4); // en horizontal se avanza en zigzag
      expect(distancia(c(0, 0), c(4, 2))).toBe(4); // en diagonal bajas dos filas "gratis"
      expect(distancia(c(0, 0), c(4, 3))).toBe(5);
    });

    it('da lo mismo de ida que de vuelta', () => {
      expect(distancia(c(6, 2), c(23, 18))).toBe(distancia(c(23, 18), c(6, 2)));
    });

    it('sonVecinas y mismaCasilla', () => {
      expect(sonVecinas(c(6, 2), c(7, 2))).toBe(true);
      expect(sonVecinas(c(6, 2), c(8, 2))).toBe(false);
      expect(sonVecinas(c(6, 2), c(6, 2))).toBe(false);
      expect(mismaCasilla(c(6, 2), { col: 6, fila: 2 })).toBe(true);
    });
  });

  describe('direcciones del libro y avanzar', () => {
    it('1 SE · 2 S · 3 NE · 4 SO · 5 NO · 6 N', () => {
      expect([1, 2, 3, 4, 5, 6].map(direccionDelLibro)).toEqual(['SE', 'S', 'NE', 'SO', 'NO', 'N']);
      expect(() => direccionDelLibro(7)).toThrow(/el 7 no es una dirección/);
    });

    it('avanza en línea recta las casillas que diga', () => {
      expect(avanzar(mapaDePrueba(), c(0, 3), 'NE', 3)).toEqual(c(3, 1));
    });

    it('si se sale del mapa, se queda en la última casilla válida antes del borde', () => {
      expect(avanzar(mapaDePrueba(), c(2, 2), 'N', 5)).toEqual(c(2, 0));
      expect(avanzar(mapaDePrueba(), c(0, 0), 'NO', 2)).toEqual(c(0, 0));
    });
  });

  describe('vecina al azar', () => {
    it('elige con los dados entre las que cumplen la condición', () => {
      const mapa = mapaDePrueba();
      const tierra = (casilla: Casilla) => !esAgua(casilla.terreno);
      // Desde 3,2 (impar) las vecinas de tierra son N 3,1 · S 3,3 · SO 2,3 · NO 2,2 (el NE y el SE son costa)
      const dados = dadosTrucados([2]);

      expect(vecinaAlAzar(mapa, c(3, 2), dados, tierra)).toEqual(c(2, 3));
      expect(dados.restantes()).toBe(0);
    });

    it('si solo hay una opción no gasta dados; si no hay ninguna, null', () => {
      const mapa = mapaDePrueba();
      const agua = (casilla: Casilla) => esAgua(casilla.terreno);
      const dados = dadosTrucados([]);

      expect(vecinaAlAzar(mapa, c(4, 0), dados, casilla => agua(casilla))).toEqual(c(4, 1));
      expect(vecinaAlAzar(mapa, c(1, 1), dados, agua)).toBeNull();
    });

    it('con los mismos dados sale siempre la misma (partidas reproducibles)', () => {
      const mapa = obtenerMapa('primer-mapa-prueba');

      expect(vecinaAlAzar(mapa, c(6, 0), new Dados(42))).toEqual(vecinaAlAzar(mapa, c(6, 0), new Dados(42)));
    });
  });
});
