import { ENEMIGOS, obtenerEnemigo } from './cargar-enemigos';
import { validarEnemigos } from './validar-enemigo';

describe('cargar enemigos (bestiario)', () => {
  it('devuelve la ficha de un enemigo por su id', () => {
    const jaguar = obtenerEnemigo('jaguar');

    expect(jaguar.nombre).toBe('Jaguar');
    expect(jaguar.ataque).toBe(4);
    expect(jaguar.resistencia).toBe(6);
  });

  it('avisa si pides un enemigo que no existe, diciendo cuáles hay', () => {
    expect(() => obtenerEnemigo('jaguarr')).toThrow(/No existe el enemigo "jaguarr".*jaguar/);
  });

  // Red de seguridad: revisa TODO el bestiario, también los enemigos que añadas en el futuro.
  it('el bestiario no tiene errores', () => {
    expect(validarEnemigos([...ENEMIGOS])).toEqual([]);
  });

  it('el bestiario no está vacío', () => {
    expect(ENEMIGOS.length).toBeGreaterThan(0);
  });
});
