import ajustesJson from '../../data/ajustes.json';
import type { IdTirada } from '../modificadores/id-tirada';

// Números del juego que se pueden equilibrar sin tocar código. Se editan en data/ajustes.json.
export interface Ajustes {
  /** Porcentaje (0-100) de que pase un evento al viajar. En papel: 1d6 par = 50. */
  probabilidadEventoAlViajar: number;

  /** Reservas de comida que se pueden tener como máximo. Provisional: se ajusta jugando. */
  comidaMaxima: number;

  /**
   * Tiradas que dan +1 por cada X puntos de fama. { "audiencia_guarida": 2 } = +1 por cada 2 de fama
   * al pedir audiencia al capitán pirata (con 5 de fama, +2).
   */
  bonificadorPorFama: Partial<Record<IdTirada, number>>;
}

export const AJUSTES: Ajustes = ajustesJson;
