import type { Barco } from './barco';
import { validarBarcos } from './validar-barco';

// Barco correcto que vamos estropeando en cada test.
function fragata(): Barco {
  return {
    id: 'fragata_de_la_marina',
    nombre: 'Fragata de la marina',
    dano: 4,
    resistencia: 4,
    abordaje: [{ enemigo: 'agente_de_la_marina', resistencia: 8 }, { enemigo: 'guardia_de_la_marina', cantidad: 2 }],
    recompensa: [{ tipo: 'fama', cantidad: 1 }, { tipo: 'oro', cantidad: '2d6x10' }],
    eventosAlGanar: ['cofre'],
    botinAbordaje: { efectos: [{ tipo: 'oro', cantidad: '1d6x10' }], probabilidadTesoro: 25 },
    libro: 'E008',
  };
}

// Atajo: valida un catálogo de un solo barco y junta los errores en un texto.
function erroresDe(barco: unknown): string {
  return validarBarcos([barco as Barco]).join(' | ');
}

describe('validarBarcos', () => {
  it('un barco bien escrito no da errores', () => {
    expect(erroresDe(fragata())).toBe('');
  });

  it('vale con lo mínimo: id, nombre, daño, resistencia y abordaje', () => {
    expect(erroresDe({ id: 'chalupa', nombre: 'Chalupa', dano: 0, resistencia: 1, abordaje: [{ enemigo: 'pescador' }] })).toBe('');
  });

  it('avisa de un id repetido', () => {
    expect(validarBarcos([fragata(), fragata()]).join(' | ')).toContain('El id "fragata_de_la_marina" está repetido');
  });

  it('avisa de un id mal escrito o de que falta el nombre', () => {
    expect(erroresDe({ ...fragata(), id: 'Fragata Real' })).toContain('minúsculas y con guiones bajos');
    expect(erroresDe({ ...fragata(), nombre: ' ' })).toContain('le falta el nombre');
  });

  it('avisa si la descripción o la imagen no son un texto', () => {
    expect(erroresDe({ ...fragata(), descripcion: 3 })).toContain('la descripción debe ser un texto');
    expect(erroresDe({ ...fragata(), imagen: true })).toContain('la imagen debe ser la ruta');
  });

  it('el daño puede ser 0 o dados, pero no negativo ni dados mal escritos', () => {
    expect(erroresDe({ ...fragata(), dano: 0 })).toBe('');
    expect(erroresDe({ ...fragata(), dano: '1d6' })).toBe('');
    expect(erroresDe({ ...fragata(), dano: -1 })).toContain('el daño debe ser un número entero de 0 o más, o dados');
    expect(erroresDe({ ...fragata(), dano: 'mucho' })).toContain('el daño debe ser');
    expect(erroresDe({ ...fragata(), dano: '1d0' })).toContain('el daño debe ser');
    expect(erroresDe({ ...fragata(), dano: '-1d6' })).toContain('el daño debe ser');
  });

  it('avisa de una resistencia de 0 (ya estaría hundido) o que no es un número entero', () => {
    expect(erroresDe({ ...fragata(), resistencia: 0 })).toContain('la resistencia debe ser un número entero de 1 o más');
    expect(erroresDe({ ...fragata(), resistencia: 2.5 })).toContain('la resistencia debe ser un número entero de 1 o más');
  });

  it('avisa si falta el abordaje o está vacío', () => {
    expect(erroresDe({ ...fragata(), abordaje: undefined })).toContain('le falta el abordaje');
    expect(erroresDe({ ...fragata(), abordaje: [] })).toContain('le falta el abordaje');
  });

  it('los enemigos del abordaje tienen que existir en el bestiario', () => {
    expect(erroresDe({ ...fragata(), abordaje: [{ enemigo: 'marinero_zombi' }] })).toContain('abordaje 1: el enemigo "marinero_zombi" no existe en el bestiario');
  });

  it('la cantidad del abordaje es un entero de 1 o más, o dados que saquen al menos 1', () => {
    expect(erroresDe({ ...fragata(), abordaje: [{ enemigo: 'pirata', cantidad: '1d3+1' }] })).toBe('');
    expect(erroresDe({ ...fragata(), abordaje: [{ enemigo: 'pirata', cantidad: 0 }] })).toContain('la cantidad debe ser');
    expect(erroresDe({ ...fragata(), abordaje: [{ enemigo: 'pirata', cantidad: '0d6' }] })).toContain('la cantidad debe ser');
  });

  it('el ataque y la resistencia cambiados en el abordaje tienen que ser enteros de 1 o más', () => {
    expect(erroresDe({ ...fragata(), abordaje: [{ enemigo: 'pirata', ataque: 0 }] })).toContain('abordaje 1: el ataque debe ser');
    expect(erroresDe({ ...fragata(), abordaje: [{ enemigo: 'pirata', resistencia: -3 }] })).toContain('abordaje 1: la resistencia debe ser');
  });

  it('avisa de un campo que sobra en el abordaje', () => {
    expect(erroresDe({ ...fragata(), abordaje: [{ enemigo: 'pirata', cantdad: 2 }] })).toContain('abordaje 1: el campo "cantdad" no existe');
  });

  it('revisa los efectos de la recompensa con el revisor de siempre', () => {
    expect(erroresDe({ ...fragata(), recompensa: [{ tipo: 'diamantes', cantidad: 3 }] })).toContain('recompensa, efecto 1: el tipo de efecto "diamantes" no existe');
    expect(erroresDe({ ...fragata(), recompensa: [] })).toContain('recompensa: debe ser una lista de efectos');
  });

  it('los eventos al ganar son ids bien escritos (pueden repetirse: dos cofres)', () => {
    expect(erroresDe({ ...fragata(), eventosAlGanar: ['cofre', 'cofre'] })).toBe('');
    expect(erroresDe({ ...fragata(), eventosAlGanar: ['Cofre Grande'] })).toContain('el evento "Cofre Grande" debe ir en minúsculas');
    expect(erroresDe({ ...fragata(), eventosAlGanar: [] })).toContain('"eventosAlGanar" debe ser una lista');
  });

  it('el botín de abordaje: efectos válidos y probabilidad de tesoro entre 1 y 100', () => {
    expect(erroresDe({ ...fragata(), botinAbordaje: { probabilidadTesoro: 50 } })).toBe('');
    expect(erroresDe({ ...fragata(), botinAbordaje: { probabilidadTesoro: 120 } })).toContain('"probabilidadTesoro" debe ser un número entero entre 1 y 100');
    expect(erroresDe({ ...fragata(), botinAbordaje: { probabilidadTesoro: 0 } })).toContain('"probabilidadTesoro"');
    expect(erroresDe({ ...fragata(), botinAbordaje: { efectos: [{ tipo: 'oro' }] } })).toContain('botín de abordaje, efecto 1');
    expect(erroresDe({ ...fragata(), botinAbordaje: {} })).toContain('botín de abordaje: está vacío');
    expect(erroresDe({ ...fragata(), botinAbordaje: { tesoro: 25 } })).toContain('el campo "tesoro" no existe');
  });

  it('avisa de una referencia al libro mal escrita', () => {
    expect(erroresDe({ ...fragata(), libro: '8' })).toContain('"libro" debe ser el código del libro de papel');
  });

  it('avisa de un campo que no existe (una errata)', () => {
    expect(erroresDe({ ...fragata(), resistecia: 4 })).toContain('el campo "resistecia" no existe');
  });

  it('junta todos los errores a la vez', () => {
    const errores = validarBarcos([{ id: 'MAL', nombre: '', dano: -1, resistencia: 0 } as unknown as Barco]);

    expect(errores.length).toBe(5);
  });
});
