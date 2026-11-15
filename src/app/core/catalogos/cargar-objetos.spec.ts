import { OBJETOS, obtenerObjeto } from './cargar-objetos';
import { validarObjetos } from './validar-objeto';

describe('cargar objetos', () => {
  it('devuelve la ficha de un objeto por su id', () => {
    const mano = obtenerObjeto('mano_de_mono');

    expect(mano.nombre).toBe('Mano de mono');
    expect(mano.tipo).toBe('activo');
    expect(mano.usosMaximos).toBe(2);
  });

  it('avisa si pides un objeto que no existe, diciendo cuáles hay', () => {
    expect(() => obtenerObjeto('mano_de_mona')).toThrow(/No existe el objeto "mano_de_mona".*mano_de_mono/);
  });

  // Red de seguridad: revisa TODO el catálogo, también los objetos que añadas en el futuro.
  // Si alguno tiene un error, el test falla y enseña el mensaje exacto.
  it('el catálogo de objetos no tiene errores', () => {
    expect(validarObjetos([...OBJETOS])).toEqual([]);
  });

  it('el catálogo no está vacío', () => {
    expect(OBJETOS.length).toBeGreaterThan(0);
  });
});
