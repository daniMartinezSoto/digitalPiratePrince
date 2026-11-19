// Cómo y por qué ha terminado la partida. Lo apunta aplicarEfectos.
//   vida / tripulacion: llegaron a 0 (derrota).
//   seguidor: ha muerto un seguidor "vital" (el de "el hermano"): derrota.
//   evento: un efecto "ganar_partida" o "perder_partida" (la isla misteriosa, "mueres"...).
//   abandono: el jugador se ha rendido (botón "Abandonar"; Sprint 8): cuenta como derrota.
// La victoria normal (fama y puertos) llegará con el mapa (Sprint 9).
// Las listas sirven también para comprobar las fichas de la crónica (core/guardado/cronica.ts).
export const RESULTADOS_DE_PARTIDA = ['victoria', 'derrota'] as const;
export type ResultadoDePartida = (typeof RESULTADOS_DE_PARTIDA)[number];

export const MOTIVOS_DE_FIN = ['vida', 'tripulacion', 'seguidor', 'evento', 'abandono'] as const;
export type MotivoDeFin = (typeof MOTIVOS_DE_FIN)[number];

export interface FinPartida {
  resultado: ResultadoDePartida;
  motivo: MotivoDeFin;
}
