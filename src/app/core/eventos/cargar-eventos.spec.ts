import { EVENTOS, existeEvento, obtenerEvento } from './cargar-eventos';
import { eventosQueFaltan, validarEventos } from './validar-evento';

describe('cargar eventos', () => {
  // Red de seguridad: revisa TODOS los eventos, también los que se añadan en el futuro.
  it('ningún evento tiene errores', () => {
    expect(validarEventos(EVENTOS)).toEqual([]);
  });

  it('cada archivo se llama como su id (data/eventos/<id>.json) y no se repite', () => {
    const ids = EVENTOS.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('devuelve un evento por su id y avisa si no existe', () => {
    expect(obtenerEvento('deseo').titulo).toBe('Deseo');
    expect(() => obtenerEvento('dese')).toThrow(/No existe el evento "dese".*deseo/);
  });

  it('existeEvento distingue los programados de los pendientes', () => {
    expect(existeEvento('deseo')).toBe(true);
    expect(existeEvento('tesoro_magico')).toBe(true);
    expect(existeEvento('mapa_misterioso')).toBe(false);
  });

  // No es un error (salen como "pendiente"), pero así se ve qué falta por escribir.
  it('los eventos a los que se salta y aún no existen son los esperados', () => {
    expect(eventosQueFaltan(EVENTOS)).toEqual(['arrestado', 'mapa_misterioso']);
  });

  describe('el deseo (E041)', () => {
    const deseo = obtenerEvento('deseo');
    const opciones = deseo.pasos['inicio'].opciones!;

    it('tiene sus 9 opciones', () => {
      expect(opciones).toHaveLength(9);
    });

    it('el ídolo antediluviano no se puede pedir si ya lo tienes', () => {
      expect(opciones[6].requiere).toEqual({ sinObjeto: 'idolo_antediluviano' });
    });

    it('la amistad da un seguidor al azar entre todos, que nunca te abandona (solo si puede entrar)', () => {
      expect(opciones[7].requiere).toEqual({ puedeGanarSeguidor: true });
      expect(opciones[7].efectos).toEqual([{ tipo: 'ganar_seguidor', seguidor: 'al_azar', inseparable: true }]);
    });

    it('la protección cura a todo el grupo (decidido por el autor)', () => {
      expect(opciones[8].efectos).toContainEqual({ tipo: 'vida', operacion: 'maximo', destino: 'todos' });
    });

    it('la vitalidad sube la vida máxima pero no cura (como el libro)', () => {
      expect(opciones[0].efectos).toEqual([{ tipo: 'vidaMax', cantidad: 4 }]);
    });
  });
});
