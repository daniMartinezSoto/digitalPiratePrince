import { validarCondiciones } from './validar-condicion';
import type { Condicion } from './condicion';

// Condiciones correctas que vamos estropeando en cada test.
function escorbuto(): Condicion {
  return {
    id: 'escorbuto',
    nombre: 'Escorbuto',
    descripcion: 'La tripulación enferma por falta de alimentos frescos.',
    categoria: 'enfermedad',
  };
}

function bendicionPrueba(): Condicion {
  return {
    id: 'buena_estrella',
    nombre: 'Buena estrella',
    descripcion: 'La suerte te sonríe.',
    categoria: 'bendicion',
    modificadores: { buscar_info_puerto: 1 },
  };
}

function erroresDe(condicion: unknown): string {
  return validarCondiciones([condicion as Condicion]).join(' | ');
}

describe('validarCondiciones', () => {
  it('un catálogo correcto no tiene errores', () => {
    expect(validarCondiciones([escorbuto(), bendicionPrueba()])).toEqual([]);
  });

  it('detecta un id repetido', () => {
    expect(validarCondiciones([escorbuto(), escorbuto()]).join()).toMatch(/"escorbuto" está repetido/);
  });

  it('detecta un id con mayúsculas o espacios', () => {
    expect(erroresDe({ ...escorbuto(), id: 'El Escorbuto' })).toMatch(/minúsculas/);
  });

  it('detecta que falta el nombre o la descripción', () => {
    expect(erroresDe({ ...escorbuto(), nombre: '' })).toMatch(/falta el nombre/);
    expect(erroresDe({ ...escorbuto(), descripcion: '' })).toMatch(/falta la descripción/);
  });

  it('acepta todas las categorías válidas', () => {
    for (const categoria of ['maldicion', 'bendicion', 'enfermedad', 'clima', 'otra']) {
      expect(erroresDe({ ...escorbuto(), categoria })).toBe('');
    }
  });

  it('detecta una categoría que no existe o que falta', () => {
    expect(erroresDe({ ...escorbuto(), categoria: 'maldición' })).toMatch(/categoría "maldición" no existe/);
    const sinCategoria = { ...escorbuto() } as Partial<Condicion>;
    delete sinCategoria.categoria;
    expect(erroresDe(sinCategoria)).toMatch(/categoría "undefined" no existe/);
  });

  it('detecta un bonificador sobre una tirada que no existe', () => {
    expect(erroresDe({ ...bendicionPrueba(), modificadores: { buscar_info: 1 } })).toMatch(
      /Condición "buena_estrella": el bonificador va sobre la tirada "buscar_info"/,
    );
  });

  it('enseña todos los errores a la vez, no solo el primero', () => {
    expect(validarCondiciones([{ ...escorbuto(), nombre: '', categoria: 'rara' } as unknown as Condicion])).toHaveLength(2);
  });
});
