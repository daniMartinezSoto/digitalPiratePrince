import type { ListaEventos } from './lista-eventos';

import altaMar from '../../../data/eventos-terreno/alta-mar.json';
import costa from '../../../data/eventos-terreno/costa.json';
import jungla from '../../../data/eventos-terreno/jungla.json';
import junglaProfunda from '../../../data/eventos-terreno/jungla-profunda.json';
import playa from '../../../data/eventos-terreno/playa.json';
import nocturnos from '../../../data/eventos-terreno/nocturnos.json';

const comoLista = (json: unknown) => json as ListaEventos;

/**
 * Todas las listas de eventos: una por terreno y la de eventos nocturnos.
 * PARA AÑADIR UNA LISTA: crea su JSON en data/eventos-terreno/, impórtalo arriba y añádelo aquí.
 */
export const LISTAS_EVENTOS: readonly ListaEventos[] = [
  comoLista(altaMar),
  comoLista(costa),
  comoLista(jungla),
  comoLista(junglaProfunda),
  comoLista(playa),
  comoLista(nocturnos),
];

/** Devuelve la lista con ese id ("jungla", "nocturnos"...). Si no existe, avisa con las disponibles. */
export function obtenerListaEventos(id: string): ListaEventos {
  const lista = LISTAS_EVENTOS.find(l => l.id === id);
  if (!lista) {
    const disponibles = LISTAS_EVENTOS.map(l => l.id).join(', ');
    throw new Error(`No existe la lista de eventos "${id}". Listas disponibles: ${disponibles}`);
  }
  return lista;
}
