import type { CategoriaEnemigo, HabilidadDeEnemigo } from '../catalogos/enemigo';
import type { TiradaDeAtaque } from '../combate/ataque';
import type { SucesoDeCombate } from '../combate/combate';
import type { EfectoDefinicion } from '../tablas/efecto';

// EL COMBATE EN CURSO (Sprint 7): lo que se guarda en mundo.combate mientras se pelea.
// Solo datos, como todo el estado: si se guarda la partida a mitad, se sigue en la misma ronda.
//
// La vida del jugador y la resistencia de sus seguidores NO están aquí: son las de verdad
// (jugador.vida, seguidor.resistencia) y lo que se pierde peleando se queda perdido.
// Aquí solo está lo que existe mientras dura el combate: los enemigos, quién ataca a quién y
// lo que han hecho los objetos usados.

/** Quién ataca a quién: objetivos['jugador'] = 'enemigo_2'. Lo calcula core/combate/emparejamiento.ts. */
export type Objetivos = Record<string, string>;

/** Un enemigo dentro de un combate: una COPIA de su ficha del bestiario, que puede cambiar al pelear. */
export interface EnemigoEnCombate {
  // Id dentro de este combate: "enemigo_1", "enemigo_2"... (no el del bestiario: "nativo" es a la vez
  // un enemigo y un tipo de seguidor, y los ids se mezclarían).
  id: string;
  // Id de su ficha en el bestiario (data/enemigos.json): "pirata_esqueleto". De ahí saca la interfaz su dibujo.
  tipo: string;
  // Lo que ve el jugador: "Pirata esqueleto 2". El número solo aparece si hay varios del mismo tipo.
  nombre: string;
  categoria: CategoriaEnemigo;
  ataque: number;
  resistencia: number;         // la que le queda. 0 = muerto (se queda en la lista para enseñarlo)
  resistenciaMaxima: number;
  habilidades: HabilidadDeEnemigo[];
  // Veces que ha vuelto a levantarse (o lo ha intentado, con "revivir_una_vez"). Limita cuántas veces revive.
  vecesRevivido: number;
  // Lo que se gana por derrotarlo (lo pone quien lanza el combate: "2d6 de oro por cada pirata").
  // Se cobra al cerrar el combate, por cada enemigo que haya caído del todo, aunque se huya.
  recompensa?: EfectoDefinicion[];
}

/** Un ataque ya tirado en la ronda: quién, a quién, sus dados y los de la pistola (si los hay). */
export interface AtaqueDeLaRonda {
  atacante: string;
  objetivo: string;
  tirada: TiradaDeAtaque;
  dadosExtra?: number[];   // la pistola: solo suman si el ataque acierta
}

/**
 * LA RONDA EN PAUSA POR UN 6 (Sprint 11, decidido por el autor). Todos han tirado a la vez, pero el
 * jugador ha sacado un 6 y decide si se arriesga a tirar otra vez. Mientras decide, aquí están TODOS
 * los dados de la ronda y todavía no se ha aplicado ningún golpe (los golpes son simultáneos).
 * Se guarda en la partida: recargar no sirve para volver a tirar la ronda.
 */
export interface RondaEnPausa {
  ataques: AtaqueDeLaRonda[];      // todos los de la ronda; el del jugador, con los dados que lleva
  sucesos: SucesoDeCombate[];      // los del principio de la ronda (emboscada, ¡maldito!...)
  eventosAlTerminar: string[];     // los del combate más los que han salido en esta ronda
  castigo: number;                 // hambre y bonificador del jugador, para volver a calcular su ataque
  bonificador: number;
  dadoExtraDespues: string | null; // cómo queda la pistola después de la ronda
}

/** Cómo ha terminado un combate. */
export type ResultadoCombate = 'victoria' | 'huida' | 'derrota';

/** Quién embosca a quién: "nuestra" = en la primera ronda solo atacáis vosotros; "suya" = solo ellos. */
export type Sorpresa = 'nuestra' | 'suya';

export interface CombateEnCurso {
  enemigos: EnemigoEnCombate[];
  objetivos: Objetivos;
  // Rondas ya jugadas (0 = todavía no se ha atacado).
  ronda: number;
  // false = de este combate no se puede huir (p. ej. dentro del barco). Lo decide quien lo lanza.
  puedeHuir: boolean;
  // true = combate no mortal: si el jugador cae, se queda con 1 PV y el combate termina en derrota,
  // pero la partida sigue (la pelea con el guardia de la cárcel).
  noMortal: boolean;
  // Emboscada en la primera ronda (null = no hay). Se borra al jugar esa ronda.
  sorpresa: Sorpresa | null;
  // true = el jugador acaba de fallar una huida: en la próxima ronda los enemigos aciertan siempre
  // (un 1-2 cuenta como golpe normal). Vuelve a false al jugar esa ronda.
  noPuedenFallar: boolean;
  // Lo que suman al daño del jugador los objetos usados en este combate (el ron: +2).
  bonificador: number;
  // Dados que suma el próximo ataque del jugador si acierta (la pistola de chispa: "1d6"). null = ninguno.
  dadoExtra: string | null;
  // Objetos permanentes ya usados en este combate (solo se pueden usar una vez por combate).
  objetosUsados: string[];
  // Eventos que saltarán al terminar el combate, como termine (la maldición del chamán).
  eventosAlTerminar: string[];
  // Solo existe mientras la ronda está en pausa por un 6 del jugador (ver RondaEnPausa).
  rondaEnPausa?: RondaEnPausa;
  // null mientras se pelea. Cuando termina, se queda apuntado hasta que quien lanzó el combate lo
  // recoge con cerrarCombate (hoy los tests; en el Sprint 10, el motor de eventos).
  resultado: ResultadoCombate | null;
}
