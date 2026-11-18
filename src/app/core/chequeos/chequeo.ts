import { fuerzaActual, ingenioActual } from '../condiciones/consultas';
import type { Dados } from '../dados/dados';
import type { Jugador } from '../estado/jugador';

// CHEQUEO DE FUERZA O INGENIO: se tira 1d6 y hay que sacar la característica O MENOS.
// Se usa la característica ACTUAL (con las bendiciones del amuleto: fuerzaActual, ingenioActual).
// Un modificador se suma AL DADO: −1 lo hace más fácil (contra un borracho) y +1 más difícil
// (contra el campeón de pulsos). Gasta un número del generador.

export type Caracteristica = 'fuerza' | 'ingenio';

export interface ResultadoChequeo {
  caracteristica: Caracteristica;
  valor: number;       // la característica actual del jugador
  dado: number;        // lo que ha salido en el 1d6
  modificador: number; // lo que se suma al dado
  total: number;       // dado + modificador
  superado: boolean;   // total ≤ valor
}

export function chequeo(jugador: Jugador, caracteristica: Caracteristica, modificador: number, dados: Dados): ResultadoChequeo {
  const valor = caracteristica === 'fuerza' ? fuerzaActual(jugador) : ingenioActual(jugador);
  const dado = dados.tirar('1d6').total;
  const total = dado + modificador;
  return { caracteristica, valor, dado, modificador, total, superado: total <= valor };
}
