import { Dados } from '../../dados/dados';
import { obtenerTabla, TABLAS } from './cargar-tablas';
import { resolverTabla } from './resolver-tabla';
import { validarTabla } from './validar-tabla';

describe('cargar tablas', () => {
  it('devuelve una tabla por su id', () => {
    expect(obtenerTabla('pesca').id).toBe('pesca');
    expect(obtenerTabla('buscar_informacion').dado).toBe('3d6');
  });

  it('avisa si pides una tabla que no existe, diciendo cuáles hay', () => {
    expect(() => obtenerTabla('pezca')).toThrow(/No existe la tabla "pezca".*pesca/);
  });

  it('no hay dos tablas con el mismo id', () => {
    const ids = TABLAS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Red de seguridad: revisa TODAS las tablas del juego, también las que añadas en el futuro.
  // Si alguna tiene un error, el test falla y enseña el mensaje exacto.
  it.each(TABLAS.map(t => [t.id, t] as const))('la tabla "%s" no tiene errores', (_id, tabla) => {
    expect(validarTabla(tabla)).toEqual([]);
  });

  it('las tablas reales se pueden tirar con resolverTabla', () => {
    for (const tabla of TABLAS) {
      for (let semilla = 1; semilla <= 20; semilla++) {
        expect(() => resolverTabla(tabla, 0, new Dados(semilla))).not.toThrow();
      }
    }
  });
});
