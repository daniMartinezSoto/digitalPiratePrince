import ajustesJson from '../../data/ajustes.json';

// Números del juego que se pueden equilibrar sin tocar código. Se editan en data/ajustes.json.
export interface Ajustes {
  /** Porcentaje (0-100) de que pase un evento al viajar. En papel: 1d6 par = 50. */
  probabilidadEventoAlViajar: number;

  /** Reservas de comida que se pueden tener como máximo. Provisional: se ajusta jugando. */
  comidaMaxima: number;
}

export const AJUSTES: Ajustes = ajustesJson;
