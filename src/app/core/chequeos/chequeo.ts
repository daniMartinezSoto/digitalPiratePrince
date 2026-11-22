import { fuerzaActual, ingenioActual } from '../condiciones/consultas';
import type { Dados } from '../dados/dados';
import type { Jugador } from '../estado/jugador';

// CHEQUEO DE FUERZA O INGENIO: se tira 1d6 y hay que sacar la característica O MENOS.
// Se usa la característica ACTUAL (con las bendiciones del amuleto: fuerzaActual, ingenioActual).
// Un modificador se suma AL DADO: −1 lo hace más fácil (contra un borracho) y +1 más difícil
// (contra el campeón de pulsos). Gasta un número del generador.
// UN 6 EN EL DADO SIEMPRE FALLA (decidido por el autor el 22-nov: un chequeo siempre se puede fallar),
// aunque con el modificador el total quedara por debajo de la característica.

export type Caracteristica = 'fuerza' | 'ingenio';

/** El número del dado con el que un chequeo falla siempre. */
export const DADO_QUE_SIEMPRE_FALLA = 6;

export interface ResultadoChequeo {
  caracteristica: Caracteristica;
  valor: number;       // la característica actual del jugador
  dado: number;        // lo que ha salido en el 1d6
  modificador: number; // lo que se suma al dado
  total: number;       // dado + modificador
  superado: boolean;   // total ≤ valor, y el dado no es un 6
}

/** dadoFijo = SOLO para la trampa de prueba "fijar la próxima tirada": el dado saca eso y no se gasta ningún número. */
export function chequeo(jugador: Jugador, caracteristica: Caracteristica, modificador: number, dados: Dados, dadoFijo?: number): ResultadoChequeo {
  const valor = caracteristica === 'fuerza' ? fuerzaActual(jugador) : ingenioActual(jugador);
  const dado = dadoFijo ?? dados.tirar('1d6').total;
  const total = dado + modificador;
  return { caracteristica, valor, dado, modificador, total, superado: dado !== DADO_QUE_SIEMPRE_FALLA && total <= valor };
}
