// Cómo y por qué ha terminado la partida. Lo apunta aplicarEfectos.
//   vida / tripulacion: llegaron a 0 (derrota).
//   seguidor: ha muerto un seguidor "vital" (el de "el hermano"): derrota.
//   evento: un efecto "ganar_partida" o "perder_partida" (la isla misteriosa, "mueres"...).
//   abandono: el jugador se ha rendido (botón "Abandonar"; Sprint 8): cuenta como derrota.
//   fama_y_puertos: la victoria normal: llegar a un puerto con la fama objetivo y los 4 puertos
//                   principales ya visitados (core/viaje/llegar.ts; decidido por el autor el 20-nov).
// La victoria normal (fama y puertos) llegará con el mapa (Sprint 9).
// Las listas sirven también para comprobar las fichas de la crónica (core/guardado/cronica.ts).
export const RESULTADOS_DE_PARTIDA = ['victoria', 'derrota'] as const;
export type ResultadoDePartida = (typeof RESULTADOS_DE_PARTIDA)[number];

export const MOTIVOS_DE_FIN = ['vida', 'tripulacion', 'seguidor', 'evento', 'abandono', 'fama_y_puertos'] as const;
export type MotivoDeFin = (typeof MOTIVOS_DE_FIN)[number];

export interface FinPartida {
  resultado: ResultadoDePartida;
  motivo: MotivoDeFin;

  // POR QUÉ has muerto (pedido por el autor el 22-nov: al morir tiene que salir por qué). Lo apunta quien
  // hace el daño (el combate, el hambre, una condición, cazar, un evento...) con conCausaDeMuerte.
  // Sin causa, la pantalla dice solo el motivo ("te has quedado sin vida").
  causa?: CausaDeMuerte;
}

/**
 * Lo que te ha matado. La pantalla escribe el mensaje (ui/textos), salvo en los eventos, que pueden traer
 * el suyo escrito en el JSON ("texto": el de la rama o el del evento).
 */
export type CausaDeMuerte =
  | { tipo: 'combate'; enemigos: string[] }
  | { tipo: 'combate_naval'; barco: string }
  | { tipo: 'hambre' }
  | { tipo: 'condicion'; condicion: string }
  | { tipo: 'accion'; accion: string }
  | { tipo: 'evento'; evento: string; texto?: string };

export const TIPOS_DE_CAUSA_DE_MUERTE = ['combate', 'combate_naval', 'hambre', 'condicion', 'accion', 'evento'] as const;
