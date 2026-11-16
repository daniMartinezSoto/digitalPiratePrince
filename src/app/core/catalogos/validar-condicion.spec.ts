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

  it('acepta una condición que prohíbe cosas y cambia reglas', () => {
    expect(erroresDe({ ...escorbuto(), prohibe: ['viajar', 'solicitar_audiencia'] })).toBe('');
    expect(erroresDe({ ...escorbuto(), ajustes: { famaObjetivo: 2, comidaPorDia: 1 } })).toBe('');
  });

  it('detecta una prohibición que no existe', () => {
    expect(erroresDe({ ...escorbuto(), prohibe: ['viajarr'] })).toMatch(
      /Condición "escorbuto": la prohibición "viajarr" no existe/,
    );
  });

  it('detecta una prohibición repetida', () => {
    expect(erroresDe({ ...escorbuto(), prohibe: ['viajar', 'viajar'] })).toMatch(/"viajar" está repetida/);
  });

  it('detecta un "prohibe" que no es una lista o que está vacío', () => {
    expect(erroresDe({ ...escorbuto(), prohibe: 'viajar' })).toMatch(/"prohibe" debe ser una lista/);
    expect(erroresDe({ ...escorbuto(), prohibe: [] })).toMatch(/"prohibe" debe ser una lista/);
  });

  it('detecta un ajuste que no existe', () => {
    expect(erroresDe({ ...escorbuto(), ajustes: { famaObjetibo: 2 } })).toMatch(
      /Condición "escorbuto": el ajuste "famaObjetibo" no existe/,
    );
  });

  it('detecta un ajuste que no es un número entero, o que vale 0', () => {
    expect(erroresDe({ ...escorbuto(), ajustes: { famaObjetivo: 'dos' } })).toMatch(/número entero distinto de 0/);
    expect(erroresDe({ ...escorbuto(), ajustes: { famaObjetivo: 1.5 } })).toMatch(/número entero distinto de 0/);
    expect(erroresDe({ ...escorbuto(), ajustes: { comidaPorDia: 0 } })).toMatch(/número entero distinto de 0/);
  });

  it('detecta unos "ajustes" que no son una lista de reglas', () => {
    expect(erroresDe({ ...escorbuto(), ajustes: ['famaObjetivo'] })).toMatch(/"ajustes" debe ser una lista de reglas/);
  });

  it('acepta una condición con algo que pasa cada turno (efectos, tabla o las dos cosas)', () => {
    const efectos = [{ tipo: 'tripulacion', cantidad: -1 }];
    expect(erroresDe({ ...escorbuto(), cadaTurno: { efectos } })).toBe('');
    expect(erroresDe({ ...escorbuto(), cadaTurno: { tabla: 'pesca' } })).toBe('');
    expect(erroresDe({ ...escorbuto(), cadaTurno: { efectos, tabla: 'pesca' } })).toBe('');
  });

  it('detecta un "cadaTurno" vacío o con campos que sobran', () => {
    expect(erroresDe({ ...escorbuto(), cadaTurno: {} })).toMatch(/cadaTurno: está vacío/);
    expect(erroresDe({ ...escorbuto(), cadaTurno: { tabla: 'pesca', tablas: 'caza' } })).toMatch(/cadaTurno: sobra "tablas"/);
    expect(erroresDe({ ...escorbuto(), cadaTurno: 'pesca' })).toMatch(/"cadaTurno" debe llevar/);
  });

  it('detecta una tabla de "cadaTurno" que no existe', () => {
    expect(erroresDe({ ...escorbuto(), cadaTurno: { tabla: 'pezca' } })).toMatch(
      /Condición "escorbuto", cadaTurno: la tabla "pezca" no existe/,
    );
  });

  it('revisa los efectos de "cadaTurno" igual que los de una tabla', () => {
    expect(erroresDe({ ...escorbuto(), cadaTurno: { efectos: [{ tipo: 'tripulasion', cantidad: -1 }] } })).toMatch(
      /cadaTurno: el tipo de efecto "tripulasion" no existe/,
    );
    expect(erroresDe({ ...escorbuto(), cadaTurno: { efectos: [] } })).toMatch(/"efectos" debe ser una lista con al menos un efecto/);
  });

  it('acepta una condición que se quita al llegar a un lugar, sola o con efectos o evento', () => {
    expect(erroresDe({ ...escorbuto(), alLlegar: { lugar: 'tierra' } })).toBe('');
    expect(erroresDe({ ...escorbuto(), alLlegar: { lugar: 'puerto', efectos: [{ tipo: 'oro', cantidad: 100 }] } })).toBe('');
    expect(erroresDe({ ...escorbuto(), alLlegar: { lugar: 'puerto', evento: 'audiencia_hija_gobernador' } })).toBe('');
  });

  it('detecta un lugar de llegada que no existe o que falta', () => {
    expect(erroresDe({ ...escorbuto(), alLlegar: { lugar: 'taberna' } })).toMatch(/alLlegar: el lugar "taberna" no existe/);
    expect(erroresDe({ ...escorbuto(), alLlegar: {} })).toMatch(/alLlegar: el lugar "undefined" no existe/);
  });

  it('detecta un evento de llegada mal escrito y efectos mal escritos', () => {
    expect(erroresDe({ ...escorbuto(), alLlegar: { lugar: 'puerto', evento: 'Audiencia Hija' } })).toMatch(/minúsculas/);
    expect(erroresDe({ ...escorbuto(), alLlegar: { lugar: 'puerto', efectos: [{ tipo: 'oro' }] } })).toMatch(
      /alLlegar: la cantidad de "oro" no es válida/,
    );
  });

  it('enseña todos los errores a la vez, no solo el primero', () => {
    expect(validarCondiciones([{ ...escorbuto(), nombre: '', categoria: 'rara' } as unknown as Condicion])).toHaveLength(2);
  });
});
