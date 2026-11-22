import type { Encuentro } from './encuentro';
import { ENCUENTROS, obtenerEncuentro } from './cargar-encuentros';
import { validarEncuentro, validarEncuentros } from './validar-encuentro';

// Encuentros (Sprint 10, paso 7): el revisor, el cargador y el de los piratas hostiles (E003).

function encuentro(cambios: Record<string, unknown>): Encuentro {
  return {
    id: 'prueba',
    dado: '1d6',
    filas: [
      { min: 1, max: 3, texto: 'Uno', enemigos: [{ enemigo: 'pirata' }] },
      { min: 4, max: 6, texto: 'Dos', enemigos: [{ enemigo: 'pirata', cantidad: 2 }] },
    ],
    ...cambios,
  } as unknown as Encuentro;
}

describe('encuentros', () => {
  it('ninguno de data/encuentros.json tiene errores', () => {
    expect(validarEncuentros(ENCUENTROS)).toEqual([]);
  });

  it('obtenerEncuentro: por su id, o error con la lista', () => {
    expect(obtenerEncuentro('piratas_hostiles').libro).toBe('E003');
    expect(() => obtenerEncuentro('piratas')).toThrow(/No existe el encuentro "piratas".*piratas_hostiles/);
  });

  it('los piratas hostiles son los cuatro del libro, con 1d6×2 de oro por cada uno', () => {
    const piratas = obtenerEncuentro('piratas_hostiles');
    expect(piratas.filas.map(f => f.enemigos)).toEqual([
      [{ enemigo: 'pirata', cantidad: 2 }],
      [{ enemigo: 'pirata_fornido' }],
      [{ enemigo: 'pirata_desarmado' }],
      [{ enemigo: 'pirata_anciano_loco' }],
    ]);
    expect(piratas.recompensaPorEnemigo).toEqual([{ tipo: 'oro', cantidad: '1d6x2' }]);
  });

  describe('el revisor', () => {
    it('vale uno bien hecho', () => {
      expect(validarEncuentro(encuentro({}))).toEqual([]);
    });

    it('id, dado, campos que sobran y recompensa', () => {
      const errores = validarEncuentro(encuentro({ id: 'Mal', dado: '1d', color: 'rojo', recompensaPorEnemigo: [{ tipo: 'gemas', cantidad: 1 }] })).join('\n');
      expect(errores).toContain('el id debe ir en minúsculas');
      expect(errores).toContain('el dado "1d" no es válido');
      expect(errores).toContain('el campo "color" no existe');
      expect(errores).toContain('recompensa 1');
    });

    it('filas: huecos, solapes y lo que saca el dado', () => {
      const filas = (a: number, b: number, c: number, d: number) => [
        { min: a, max: b, texto: 'x', enemigos: [{ enemigo: 'pirata' }] },
        { min: c, max: d, texto: 'y', enemigos: [{ enemigo: 'pirata' }] },
      ];
      expect(validarEncuentro(encuentro({ filas: filas(1, 2, 4, 6) })).join('\n')).toContain('hay un hueco entre 2 y 4');
      expect(validarEncuentro(encuentro({ filas: filas(1, 4, 3, 6) })).join('\n')).toContain('se pisan');
      expect(validarEncuentro(encuentro({ filas: filas(1, 2, 3, 5) })).join('\n')).toContain('saca como máximo 6');
    });

    it('cada fila necesita texto y enemigos que existan en el bestiario', () => {
      const errores = validarEncuentro(
        encuentro({ filas: [{ min: 1, max: 3, enemigos: [{ enemigo: 'dragon' }] }, { min: 4, max: 6, texto: 'Nada', enemigos: [] }] }),
      ).join('\n');
      expect(errores).toContain('le falta el texto');
      expect(errores).toContain('el enemigo "dragon" no existe');
      expect(errores).toContain('le faltan los enemigos');
    });

    it('avisa de encuentros repetidos', () => {
      expect(validarEncuentros([encuentro({}), encuentro({})]).join('\n')).toContain('está repetido');
    });
  });
});
