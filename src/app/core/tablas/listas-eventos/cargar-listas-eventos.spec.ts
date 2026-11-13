import { Dados } from '../../dados/dados';
import { elegirEvento } from './elegir-evento';
import { LISTAS_EVENTOS, obtenerListaEventos } from './cargar-listas-eventos';
import { validarListaEventos } from './validar-lista-eventos';

describe('cargar listas de eventos', () => {
  it('hay una lista por terreno y otra de eventos nocturnos', () => {
    const ids = LISTAS_EVENTOS.map(l => l.id).sort();
    expect(ids).toEqual(['alta_mar', 'costa', 'jungla', 'jungla_profunda', 'nocturnos', 'playa']);
  });

  it('devuelve una lista por su id', () => {
    expect(obtenerListaEventos('jungla').id).toBe('jungla');
  });

  it('avisa si pides una lista que no existe, diciendo cuáles hay', () => {
    expect(() => obtenerListaEventos('selva')).toThrow(/No existe la lista de eventos "selva".*jungla/);
  });

  // Red de seguridad: revisa TODAS las listas, también las que se cambien en el futuro.
  it.each(LISTAS_EVENTOS.map(l => [l.id, l] as const))('la lista "%s" no tiene errores', (_id, lista) => {
    expect(validarListaEventos(lista)).toEqual([]);
  });

  it('se puede elegir un evento de cada lista real', () => {
    const dados = new Dados(1);
    for (const lista of LISTAS_EVENTOS) {
      expect(typeof elegirEvento(lista, dados)).toBe('string');
    }
  });
});
