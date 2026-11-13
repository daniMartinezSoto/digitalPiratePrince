import type { ListaEventos } from './lista-eventos';
import { validarListaEventos } from './validar-lista-eventos';

function listaBuena(): ListaEventos {
  return {
    id: 'jungla',
    eventos: [
      { evento: 'cabana', peso: 3, libro: 'E058' },
      { evento: 'cueva', peso: 1 },
    ],
  };
}

describe('validarListaEventos', () => {
  it('una lista correcta no tiene errores', () => {
    expect(validarListaEventos(listaBuena())).toEqual([]);
  });

  it('detecta una lista sin eventos', () => {
    expect(validarListaEventos({ id: 'vacia', eventos: [] }).join()).toMatch(/no tiene eventos/);
  });

  it('detecta un peso 0, negativo o con decimales', () => {
    const lista = listaBuena();
    lista.eventos[0].peso = 0;
    lista.eventos[1].peso = 1.5;
    const errores = validarListaEventos(lista);
    expect(errores).toHaveLength(2);
    expect(errores.join()).toMatch(/peso debe ser un número entero mayor que 0/);
  });

  it('detecta el mismo evento escrito dos veces', () => {
    const lista = listaBuena();
    lista.eventos.push({ evento: 'cueva', peso: 1 });
    expect(validarListaEventos(lista).join()).toMatch(/"cueva": aparece más de una vez/);
  });

  it('detecta un nombre de evento con mayúsculas o espacios', () => {
    const lista = listaBuena();
    lista.eventos[1].evento = 'La Cueva';
    expect(validarListaEventos(lista).join()).toMatch(/minúsculas/);
  });

  it('detecta un código del libro mal escrito', () => {
    const lista = listaBuena();
    lista.eventos[0].libro = 'E58';
    expect(validarListaEventos(lista).join()).toMatch(/formato E000/);
  });
});
