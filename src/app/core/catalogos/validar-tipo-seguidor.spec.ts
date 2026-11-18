import type { Habilidad } from './habilidad';
import type { TipoSeguidor } from './tipo-seguidor';
import { validarTiposSeguidor } from './validar-tipo-seguidor';

// Catálogo de habilidades de prueba.
const HABILIDADES: Habilidad[] = [
  { id: 'manos_largas', nombre: 'Manos largas', descripcion: 'x', tipo: 'pasiva' },
  { id: 'cirujano', nombre: 'Cirujano', descripcion: 'x', tipo: 'pasiva' },
];

// Ids de las listas de nombres de prueba.
const LISTAS = ['hombres', 'mujeres', 'nativos'];

// Seguidor correcto que vamos estropeando en cada test.
function mono(): TipoSeguidor {
  return {
    id: 'mono',
    nombre: 'Mono amaestrado',
    descripcion: 'Tiene las manos muy largas.',
    ataque: 0,
    resistencia: 3,
    habilidades: ['manos_largas'],
    precio: 40,
  };
}

// Atajo: valida un catálogo de un solo seguidor y junta los errores en un texto.
function erroresDe(tipo: unknown): string {
  return validarTiposSeguidor([tipo as TipoSeguidor], HABILIDADES, LISTAS).join(' | ');
}

describe('validarTiposSeguidor', () => {
  it('un seguidor bien escrito no da errores', () => {
    expect(erroresDe(mono())).toBe('');
  });

  it('vale con lo mínimo: ataque y resistencia, sin precio y sin habilidades', () => {
    const grumete = { id: 'grumete', nombre: 'Grumete', descripcion: 'x', ataque: 2, resistencia: 10, habilidades: [] };

    expect(erroresDe(grumete)).toBe('');
  });

  it('el ataque y la resistencia son obligatorios: todos los seguidores combaten salvo que se diga lo contrario', () => {
    const errores = erroresDe({ id: 'grumete', nombre: 'Grumete', descripcion: 'x', habilidades: [] });

    expect(errores).toContain('el ataque debe ser un número entero de 0 o más');
    expect(errores).toContain('la resistencia debe ser un número entero de 1 o más');
  });

  it('gratis (precio 0) es válido', () => {
    expect(erroresDe({ ...mono(), precio: 0 })).toBe('');
  });

  it('avisa de un id repetido', () => {
    expect(validarTiposSeguidor([mono(), mono()], HABILIDADES).join(' | ')).toContain('El id "mono" está repetido');
  });

  it('avisa de un id mal escrito', () => {
    expect(erroresDe({ ...mono(), id: 'Mono-Amaestrado' })).toContain('minúsculas y con guiones bajos');
  });

  it('avisa si falta el nombre', () => {
    expect(erroresDe({ ...mono(), nombre: '' })).toContain('le falta el nombre');
  });

  it('avisa si falta la descripción', () => {
    expect(erroresDe({ ...mono(), descripcion: undefined })).toContain('le falta la descripción');
  });

  it('avisa si la imagen no es un texto', () => {
    expect(erroresDe({ ...mono(), imagen: true })).toContain('la imagen debe ser la ruta');
  });

  it('avisa de un ataque negativo o con decimales', () => {
    expect(erroresDe({ ...mono(), ataque: -1 })).toContain('el ataque debe ser un número entero de 0 o más');
    expect(erroresDe({ ...mono(), ataque: 1.5 })).toContain('el ataque debe ser un número entero de 0 o más');
  });

  it('avisa de una resistencia de 0: nacería muerto', () => {
    expect(erroresDe({ ...mono(), resistencia: 0 })).toContain('la resistencia debe ser un número entero de 1 o más');
  });

  it('avisa de un precio negativo o que no es un número', () => {
    expect(erroresDe({ ...mono(), precio: -5 })).toContain('el precio debe ser un número entero de 0 o más');
    expect(erroresDe({ ...mono(), precio: 'caro' })).toContain('el precio debe ser un número entero de 0 o más');
  });

  it('avisa si falta la lista de habilidades', () => {
    expect(erroresDe({ ...mono(), habilidades: undefined })).toContain('"habilidades" debe ser una lista');
  });

  it('avisa de una habilidad que no está en el catálogo', () => {
    expect(erroresDe({ ...mono(), habilidades: ['manos_cortas'] })).toContain(
      'la habilidad "manos_cortas" no existe en el catálogo de habilidades',
    );
  });

  it('avisa de una habilidad repetida', () => {
    expect(erroresDe({ ...mono(), habilidades: ['manos_largas', 'manos_largas'] })).toContain(
      'la habilidad "manos_largas" está repetida',
    );
  });

  it('acepta que pida sus propias listas de nombres', () => {
    expect(erroresDe({ ...mono(), nombres: ['nativos'] })).toBe('');
    expect(erroresDe({ ...mono(), nombres: ['mujeres', 'nativos'] })).toBe('');
  });

  it('avisa de una lista de nombres que no existe', () => {
    expect(erroresDe({ ...mono(), nombres: ['natibos'] })).toContain(
      'la lista de nombres "natibos" no existe (válidas: hombres, mujeres, nativos)',
    );
  });

  it('avisa si "nombres" está vacío o no es una lista', () => {
    expect(erroresDe({ ...mono(), nombres: [] })).toContain('"nombres" debe ser una lista con al menos una');
    expect(erroresDe({ ...mono(), nombres: 'nativos' })).toContain('"nombres" debe ser una lista con al menos una');
  });

  it('enseña todos los errores a la vez', () => {
    const errores = validarTiposSeguidor([{ id: 'x', ataque: -1 } as unknown as TipoSeguidor], HABILIDADES);

    expect(errores.length).toBe(5); // nombre, descripción, ataque, resistencia y habilidades
  });
});
