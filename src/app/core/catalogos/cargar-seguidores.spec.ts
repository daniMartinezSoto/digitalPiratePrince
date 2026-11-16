import { obtenerTipoSeguidor, TIPOS_SEGUIDOR } from './cargar-seguidores';
import { validarTiposSeguidor } from './validar-tipo-seguidor';

describe('cargar seguidores', () => {
  it('devuelve la ficha de un tipo de seguidor por su id', () => {
    const mono = obtenerTipoSeguidor('mono');

    expect(mono.nombre).toBe('Mono amaestrado');
    expect(mono.ataque).toBe(0);
    expect(mono.resistencia).toBe(3);
    expect(mono.habilidades).toEqual(['manos_largas']);
    expect(mono.precio).toBe(40);
  });

  it('avisa si pides un tipo que no existe, diciendo cuáles hay', () => {
    expect(() => obtenerTipoSeguidor('mona')).toThrow(/No existe el tipo de seguidor "mona".*mono/);
  });

  // Red de seguridad: revisa TODO el catálogo (con las habilidades de verdad),
  // también los seguidores que añadas en el futuro.
  it('el catálogo de seguidores no tiene errores', () => {
    expect(validarTiposSeguidor([...TIPOS_SEGUIDOR])).toEqual([]);
  });

  it('el catálogo no está vacío', () => {
    expect(TIPOS_SEGUIDOR.length).toBeGreaterThan(0);
  });

  it('la bruja vudú no tiene precio: no se contrata en puertos, solo llega por eventos', () => {
    expect(obtenerTipoSeguidor('bruja_vudu').precio).toBeUndefined();
  });

  it('el pirata anciano es gratis (precio 0), que no es lo mismo que no tener precio', () => {
    expect(obtenerTipoSeguidor('pirata_anciano').precio).toBe(0);
  });
});
