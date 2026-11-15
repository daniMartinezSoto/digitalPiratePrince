import { CONDICIONES, obtenerCondicion } from './cargar-condiciones';
import { validarCondiciones } from './validar-condicion';

describe('cargar condiciones', () => {
  it('devuelve la ficha de una condición por su id', () => {
    const tormenta = obtenerCondicion('tormenta');

    expect(tormenta.nombre).toBe('Tormenta');
    expect(tormenta.categoria).toBe('clima');
  });

  it('avisa si pides una condición que no existe, diciendo cuáles hay', () => {
    expect(() => obtenerCondicion('tormentaa')).toThrow(/No existe la condición "tormentaa".*tormenta/);
  });

  // Red de seguridad: revisa TODO el catálogo, también las condiciones que añadas en el futuro.
  it('el catálogo de condiciones no tiene errores', () => {
    expect(validarCondiciones([...CONDICIONES])).toEqual([]);
  });

  it('el catálogo no está vacío', () => {
    expect(CONDICIONES.length).toBeGreaterThan(0);
  });
});
