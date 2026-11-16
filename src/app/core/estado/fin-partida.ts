// Cómo y por qué ha terminado la partida. Lo apunta aplicarEfectos.
//   vida / tripulacion: llegaron a 0 (derrota).
//   seguidor: ha muerto un seguidor "vital" (el de "el hermano"): derrota.
//   evento: un efecto "ganar_partida" o "perder_partida" (la isla misteriosa, "mueres"...).
// La victoria normal (fama y puertos) llegará con el mapa (Sprint 9).
export interface FinPartida {
  resultado: 'victoria' | 'derrota';
  motivo: 'vida' | 'tripulacion' | 'seguidor' | 'evento';
}
