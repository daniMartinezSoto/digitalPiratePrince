// EL COMBATE NAVAL EN CURSO (Sprint 7): lo que se guarda en mundo.combateNaval mientras dura.
// Solo datos, como todo el estado: si se guarda la partida a mitad, se sigue en la misma ronda.
//
// La tripulación del jugador NO está aquí: es la de verdad (jugador.tripulacion) y lo que se
// pierde se queda perdido. Aquí solo está lo que existe mientras dura el combate: el barco
// enemigo y lo que le queda.
//
// Va aparte de mundo.combate porque durante el abordaje (paso 3) existirán los dos a la vez:
// el naval espera mientras se pelea en la cubierta.

/** Cómo ha terminado un combate naval (el contrato de la sección 8). */
export type ResultadoCombateNaval = 'victoria' | 'huida' | 'derrota';

/**
 * Lo que se apunta al empezar el abordaje, para contar después en la pantalla de resultados
 * cuánto ha costado: la vida del jugador y los seguidores que subieron a la cubierta enemiga.
 */
export interface AbordajeEnCurso {
  vida: number;
  seguidores: { id: string; nombre: string }[];
}

export interface CombateNavalEnCurso {
  // Id de la ficha del barco (data/barcos.json). De ahí saca la interfaz su dibujo.
  barco: string;
  // Lo que ve el jugador: "Fragata de la marina".
  nombre: string;
  // Tripulación que pierdes por cada duelo perdido. Ya es un número: si la ficha dice "1d6"
  // (el barco pirata), se tiró al empezar el combate.
  dano: number;
  // La que le queda (duelos que aún tienes que ganarle). 0 = hundido.
  resistencia: number;
  resistenciaMaxima: number;
  // Rondas ya jugadas (0 = todavía no se ha disparado).
  ronda: number;
  // Toda la tripulación que has perdido en este combate (el contrato la devuelve).
  tripulacionPerdida: number;
  // true = acabas de fallar una huida: hay que disparar al menos otra ronda antes de volver a
  // intentarlo (decidido por el autor: fallar no tiene más consecuencias). Vuelve a false al disparar.
  acabasDeFallarLaHuida: boolean;
  // null = no se está abordando. Si no, el abordaje está en marcha (en mundo.combate): mientras
  // dura, el duelo de cañones espera y no se puede ni disparar ni huir.
  abordaje: AbordajeEnCurso | null;
  // null mientras se lucha. Cuando termina, se queda apuntado hasta que quien lanzó el combate
  // lo recoge con cerrarCombateNaval (hoy los tests; en el Sprint 10, el motor de eventos).
  resultado: ResultadoCombateNaval | null;
}
