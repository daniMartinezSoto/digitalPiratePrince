import type { Dados } from '../../dados/dados';
import type { ListaEventos } from './lista-eventos';

/** Elige un evento de la lista respetando los pesos. Gasta 1 número del generador. */
export function elegirEvento(lista: ListaEventos, dados: Dados): string {
  return dados.elegirPonderado(lista.eventos).evento;
}

/**
 * Primero decide si pasa algo (porcentaje de 0 a 100) y, si pasa, elige un evento de la lista.
 * Devuelve el id del evento, o null si no pasa nada.
 * Ejemplo: al viajar, eventoAleatorio(listaDelTerrenoDestino, 50, dados).
 * Gasta 1 número si no pasa nada y 2 si pasa algo.
 */
export function eventoAleatorio(lista: ListaEventos, porcentaje: number, dados: Dados): string | null {
  if (!dados.probabilidad(porcentaje / 100)) {
    return null;
  }
  return elegirEvento(lista, dados);
}
