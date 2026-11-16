import type { Habilidad } from './habilidad';
import { validarHabilidades } from './validar-habilidad';

// Habilidad correcta que vamos estropeando en cada test.
function cirujano(): Habilidad {
  return {
    id: 'cirujano',
    nombre: 'Cirujano',
    descripcion: '+1 al solicitar audiencia.',
    tipo: 'pasiva',
    modificadores: { audiencia_puerto: 1 },
  };
}

// Atajo: valida un catálogo de una sola habilidad y junta los errores en un texto.
function erroresDe(habilidad: unknown): string {
  return validarHabilidades([habilidad as Habilidad]).join(' | ');
}

describe('validarHabilidades', () => {
  it('una habilidad bien escrita no da errores', () => {
    expect(validarHabilidades([cirujano()])).toEqual([]);
  });

  it('una habilidad activa y sin bonificadores también vale (mendigar)', () => {
    const mendigar = { id: 'mendigar', nombre: 'Mendigar', descripcion: 'x', tipo: 'activa' };

    expect(erroresDe(mendigar)).toBe('');
  });

  it('avisa de un id repetido', () => {
    expect(validarHabilidades([cirujano(), cirujano()]).join(' | ')).toContain('El id "cirujano" está repetido');
  });

  it('avisa de un id mal escrito', () => {
    expect(erroresDe({ ...cirujano(), id: 'Cirujano Jefe' })).toContain('minúsculas y con guiones bajos');
  });

  it('avisa si falta el nombre', () => {
    expect(erroresDe({ ...cirujano(), nombre: ' ' })).toContain('le falta el nombre');
  });

  it('avisa si falta la descripción', () => {
    expect(erroresDe({ ...cirujano(), descripcion: undefined })).toContain('le falta la descripción');
  });

  it('avisa si la imagen no es un texto', () => {
    expect(erroresDe({ ...cirujano(), imagen: 5 })).toContain('la imagen debe ser la ruta');
  });

  it('avisa de un tipo que no existe', () => {
    expect(erroresDe({ ...cirujano(), tipo: 'pasivo' })).toContain('el tipo "pasivo" no existe (válidos: pasiva, activa)');
  });

  it('avisa de un bonificador sobre una tirada que no existe', () => {
    expect(erroresDe({ ...cirujano(), modificadores: { audiencia_puerta: 1 } })).toContain(
      'la tirada "audiencia_puerta", que no existe',
    );
  });

  it('avisa de un bonificador que no es un número entero', () => {
    expect(erroresDe({ ...cirujano(), modificadores: { audiencia_puerto: 'uno' } })).toContain(
      'debe ser un número entero',
    );
  });

  it('enseña todos los errores a la vez', () => {
    const errores = validarHabilidades([{ id: 'x', tipo: 'rara' } as unknown as Habilidad]);

    expect(errores.length).toBe(3); // nombre, descripción y tipo
  });
});
