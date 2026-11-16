import { HABILIDADES, obtenerHabilidad } from './cargar-habilidades';
import { validarHabilidades } from './validar-habilidad';

describe('cargar habilidades', () => {
  it('devuelve la ficha de una habilidad por su id', () => {
    const cirujano = obtenerHabilidad('cirujano');

    expect(cirujano.nombre).toBe('Cirujano');
    expect(cirujano.tipo).toBe('pasiva');
    expect(cirujano.modificadores).toEqual({ audiencia_puerto: 1, audiencia_aldea: 1, audiencia_guarida: 1 });
  });

  it('avisa si pides una habilidad que no existe, diciendo cuáles hay', () => {
    expect(() => obtenerHabilidad('cirujana')).toThrow(/No existe la habilidad "cirujana".*cirujano/);
  });

  // Red de seguridad: revisa TODO el catálogo, también las habilidades que añadas en el futuro.
  it('el catálogo de habilidades no tiene errores', () => {
    expect(validarHabilidades([...HABILIDADES])).toEqual([]);
  });

  it('el catálogo no está vacío', () => {
    expect(HABILIDADES.length).toBeGreaterThan(0);
  });
});
