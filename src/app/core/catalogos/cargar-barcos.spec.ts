import { BARCOS, obtenerBarco } from './cargar-barcos';
import { validarBarcos } from './validar-barco';

describe('cargar barcos (combate naval)', () => {
  it('devuelve la ficha de un barco por su id', () => {
    const fragata = obtenerBarco('fragata_de_la_marina');

    expect(fragata.nombre).toBe('Fragata de la marina');
    expect(fragata.dano).toBe(4);
    expect(fragata.resistencia).toBe(4);
  });

  it('avisa si pides un barco que no existe, diciendo cuáles hay', () => {
    expect(() => obtenerBarco('fragata')).toThrow(/No existe el barco "fragata".*fragata_de_la_marina/);
  });

  // Decidido por el autor: a Pit y a Bob no se les puede atacar.
  it('no están ni el barco-taberna de Pit ni el emporio de Bob', () => {
    const ids = BARCOS.map(b => b.id).join(' ');

    expect(ids).not.toMatch(/pit|bob/);
  });

  // Red de seguridad: revisa TODOS los barcos, también los que se añadan en el futuro.
  it('el catálogo de barcos no tiene errores', () => {
    expect(validarBarcos([...BARCOS])).toEqual([]);
  });

  it('el catálogo no está vacío', () => {
    expect(BARCOS.length).toBeGreaterThan(0);
  });
});
