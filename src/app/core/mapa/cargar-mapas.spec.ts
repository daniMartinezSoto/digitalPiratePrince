import { MAPAS, obtenerMapa } from './cargar-mapas';
import { casillaEn } from './mapa';
import { validarMapa } from './validar-mapa';

describe('cargar mapas', () => {
  // Red de seguridad: revisa TODOS los mapas, también los que se añadan en el futuro.
  it('ningún mapa tiene errores', () => {
    for (const mapa of MAPAS) expect(validarMapa(mapa)).toEqual([]);
  });

  it('avisa si pides un mapa que no existe, diciendo cuáles hay', () => {
    expect(() => obtenerMapa('caribe')).toThrow(/No existe el mapa "caribe".*primer-mapa-prueba/);
  });

  describe('primer mapa de prueba (docs/ContextoMapa/primerMapaPrueba.wxx)', () => {
    const mapa = obtenerMapa('primer-mapa-prueba');

    it('mide 30 × 20', () => {
      expect([mapa.columnas, mapa.filas]).toEqual([30, 20]);
    });

    it('se empieza en 6,0, en tierra, cerca de La Habana', () => {
      expect(mapa.inicio).toEqual({ col: 6, fila: 0 });
    });

    // Decidido por el autor (20-nov): Port Royal es el de abajo a la derecha.
    it('los puertos principales: La Habana, Nassau, Tortuga y Port Royal (abajo a la derecha)', () => {
      expect(mapa.puertosPrincipales.map(p => `${p.nombre} ${p.col},${p.fila}`)).toEqual([
        'La Habana 6,2',
        'Nassau 27,2',
        'Tortuga 2,18',
        'Port Royal 23,18',
      ]);
    });

    it('los puertos normales tienen nombre; monasterios y guaridas no', () => {
      expect(casillaEn(mapa, 14, 11)?.nombre).toBe('Cala Ventura');
      expect(mapa.casillas.filter(c => c.rasgo === 'puerto').every(c => c.nombre)).toBe(true);
      expect(mapa.casillas.filter(c => c.rasgo && c.rasgo !== 'puerto').some(c => c.nombre)).toBe(false);
    });

    it('trae sus lugares y sus zonas de barcos', () => {
      const cuantos = (rasgo: string) => mapa.casillas.filter(c => c.rasgo === rasgo).length;

      expect(cuantos('puerto')).toBe(7);
      expect(cuantos('aldea')).toBe(13);
      expect(cuantos('guarida_pirata')).toBe(3);
      expect(mapa.casillas.filter(c => c.eventosDeBarco).length).toBe(15);
    });
  });
});
