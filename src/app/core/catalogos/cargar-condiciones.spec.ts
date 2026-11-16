import { CONDICIONES, obtenerCondicion } from './cargar-condiciones';
import { validarCondiciones } from './validar-condicion';

describe('cargar condiciones', () => {
  it('devuelve la ficha de una condición por su id', () => {
    const tormenta = obtenerCondicion('tormenta');

    expect(tormenta.nombre).toBe('Tormenta');
    expect(tormenta.categoria).toBe('clima');
  });

  it('la tormenta prohíbe viajar', () => {
    expect(obtenerCondicion('tormenta').prohibe).toEqual(['viajar']);
  });

  it('el mal está a bordo quita 1 de tripulación cada turno y tira en su tabla', () => {
    expect(obtenerCondicion('el_mal').cadaTurno).toEqual({
      efectos: [{ tipo: 'tripulacion', cantidad: -1 }],
      tabla: 'el_mal',
    });
  });

  it('el escorbuto tira en su tabla cada turno y se quita al tocar tierra', () => {
    expect(obtenerCondicion('escorbuto').cadaTurno).toEqual({ tabla: 'escorbuto' });
    expect(obtenerCondicion('escorbuto').alLlegar).toEqual({ lugar: 'tierra' });
  });

  it('las pistas sobre la criatura dan +1 en la tabla de el mal', () => {
    expect(obtenerCondicion('pistas_criatura').modificadores).toEqual({ el_mal: 1 });
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
