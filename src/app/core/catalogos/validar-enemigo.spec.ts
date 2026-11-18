import type { Enemigo } from './enemigo';
import { validarEnemigos } from './validar-enemigo';

// Enemigo correcto que vamos estropeando en cada test.
function jaguar(): Enemigo {
  return { id: 'jaguar', nombre: 'Jaguar', descripcion: 'Te sigue entre la maleza.', categoria: 'animal', ataque: 4, resistencia: 6, libro: 'E061' };
}

// Atajo: valida un bestiario de un solo enemigo y junta los errores en un texto.
function erroresDe(enemigo: unknown): string {
  return validarEnemigos([enemigo as Enemigo]).join(' | ');
}

describe('validarEnemigos', () => {
  it('un enemigo bien escrito no da errores', () => {
    expect(erroresDe(jaguar())).toBe('');
  });

  it('vale con lo mínimo: id, nombre, categoría, ataque y resistencia', () => {
    expect(erroresDe({ id: 'pirata', nombre: 'Pirata', categoria: 'humano', ataque: 1, resistencia: 5 })).toBe('');
  });

  it('avisa de un id repetido', () => {
    expect(validarEnemigos([jaguar(), jaguar()]).join(' | ')).toContain('El id "jaguar" está repetido');
  });

  it('avisa de un id mal escrito', () => {
    expect(erroresDe({ ...jaguar(), id: 'Jaguar Negro' })).toContain('minúsculas y con guiones bajos');
  });

  it('avisa si falta el nombre', () => {
    expect(erroresDe({ ...jaguar(), nombre: '  ' })).toContain('le falta el nombre');
  });

  it('avisa si la descripción o la imagen no son un texto', () => {
    expect(erroresDe({ ...jaguar(), descripcion: 3 })).toContain('la descripción debe ser un texto');
    expect(erroresDe({ ...jaguar(), imagen: true })).toContain('la imagen debe ser la ruta');
  });

  it('avisa de un ataque que falta, es 0, negativo o con decimales', () => {
    expect(erroresDe({ id: 'jaguar', nombre: 'Jaguar', categoria: 'animal', resistencia: 6 })).toContain('el ataque debe ser un número entero de 1 o más');
    expect(erroresDe({ ...jaguar(), ataque: 0 })).toContain('el ataque debe ser un número entero de 1 o más');
    expect(erroresDe({ ...jaguar(), ataque: -2 })).toContain('el ataque debe ser un número entero de 1 o más');
    expect(erroresDe({ ...jaguar(), ataque: 2.5 })).toContain('el ataque debe ser un número entero de 1 o más');
  });

  it('avisa de una resistencia de 0 (nacería muerto) o que no es un número', () => {
    expect(erroresDe({ ...jaguar(), resistencia: 0 })).toContain('la resistencia debe ser un número entero de 1 o más');
    expect(erroresDe({ ...jaguar(), resistencia: '6' })).toContain('la resistencia debe ser un número entero de 1 o más');
  });

  it('avisa de una referencia al libro mal escrita', () => {
    expect(erroresDe({ ...jaguar(), libro: '61' })).toContain('"libro" debe ser el código del libro de papel');
  });

  it('avisa si falta la categoría o no existe', () => {
    expect(erroresDe({ ...jaguar(), categoria: undefined })).toContain('le falta la categoría');
    expect(erroresDe({ ...jaguar(), categoria: 'pez' })).toContain('le falta la categoría o no existe');
  });

  it('las habilidades tienen que existir y no repetirse', () => {
    expect(erroresDe({ ...jaguar(), habilidades: ['ataca_dos_veces'] })).toBe('');
    expect(erroresDe({ ...jaguar(), habilidades: ['volar'] })).toContain('la habilidad "volar" no existe');
    expect(erroresDe({ ...jaguar(), habilidades: ['curarse', 'curarse'] })).toContain('la habilidad "curarse" está repetida');
    expect(erroresDe({ ...jaguar(), habilidades: 'curarse' })).toContain('"habilidades" debe ser una lista');
  });

  it('avisa de un campo que no existe (una errata)', () => {
    expect(erroresDe({ ...jaguar(), resistecia: 6 })).toContain('el campo "resistecia" no existe');
  });

  it('junta todos los errores a la vez', () => {
    const errores = validarEnemigos([{ id: 'MAL', nombre: '', ataque: 0, resistencia: 0 } as Enemigo]);

    expect(errores.length).toBe(5);
  });
});
