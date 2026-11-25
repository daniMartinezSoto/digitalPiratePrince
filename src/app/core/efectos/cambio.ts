import type { FinPartida } from '../estado/fin-partida';
import type { TipoRecurso } from '../tablas/efecto';

// Por qué cambia un recurso, cuando no es por el efecto en sí:
//   contable:       el contable gana 1d6 de oro más cada vez que gana oro.
//   objeto_magico:  +1 de fama al conseguir un objeto mágico.
//   objeto_famoso:  la fama de un objeto que la da mientras lo llevas (el loro): se gana y se pierde con él.
export type MotivoDeRecurso = 'contable' | 'objeto_magico' | 'objeto_famoso';

/**
 * Un cambio REAL que ha hecho aplicarEfectos: el "chivato" para avisar al jugador.
 * Son datos, no mensajes: la interfaz decide cómo contarlo ("+2 tripulación", un icono...).
 * Cuentan lo que pasó de verdad: si el efecto era +5 de tripulación pero solo cabían 2,
 * el cambio dice de 38 a 40.
 */
export type Cambio =
  // Un recurso o característica del jugador. motivo: por qué, si no es el efecto en sí.
  | { tipo: 'recurso'; recurso: TipoRecurso; antes: number; despues: number; motivo?: MotivoDeRecurso }
  // La resistencia (vida) de un seguidor.
  | { tipo: 'resistencia_seguidor'; seguidor: string; antes: number; despues: number }
  | { tipo: 'seguidor_muerto'; seguidor: string }
  // Un seguidor se va por su cuenta (hambre). No es lo mismo que morir.
  // motivo carisma_perdido: al perder el carisma (amuleto maldito) llevaba más seguidores de los
  // que puede, y uno al azar le abandona ("Al perder tu carisma, uno de tus seguidores te abandona").
  | { tipo: 'seguidor_se_marcha'; seguidor: string; motivo?: 'carisma_perdido' }
  // Un seguidor nuevo entra en el grupo (seguidor = su id en la partida, p. ej. "forzudo_1").
  | { tipo: 'seguidor_se_une'; seguidor: string }
  // Iba a unirse uno de ese tipo del catálogo, pero no ha entrado: el grupo está lleno
  // (y no se ha despedido a nadie) o una condición prohíbe nuevos seguidores.
  | { tipo: 'seguidor_no_se_une'; tipoSeguidor: string; motivo: 'grupo_lleno' | 'prohibido' }
  // El jugador despide a un seguidor para hacer sitio a otro.
  | { tipo: 'seguidor_despedido'; seguidor: string }
  | { tipo: 'objeto_ganado'; objeto: string }
  | { tipo: 'objeto_no_cabe'; objeto: string }
  | { tipo: 'objeto_perdido'; objeto: string }
  // El jugador lo ha tirado (porque quiere o para hacer sitio a otro).
  | { tipo: 'objeto_tirado'; objeto: string }
  // Ha usado un objeto: le quedan esos usos (0 = se ha agotado, y a continuación viene objeto_agotado).
  | { tipo: 'objeto_usado'; objeto: string; usosRestantes: number }
  // Se ha quedado sin usos y se tira solo.
  | { tipo: 'objeto_agotado'; objeto: string }
  // Lo ha vendido en el mercado (el oro que le dan viene en un cambio de recurso aparte).
  | { tipo: 'objeto_vendido'; objeto: string }
  // partes: las condiciones que lleva dentro (las dos mitades del amuleto maldito).
  | { tipo: 'condicion_puesta'; condicion: string; turnos?: number; partes?: string[] }
  | { tipo: 'condicion_quitada'; condicion: string }
  // No se ha puesto porque ya la tenía y la nueva traía cosas dentro que se pierden: un segundo
  // amuleto maldito no entra ("No puedes recibir otro amuleto maldito: ya llevas uno").
  // Una condición normal repetida (otra tormenta) no avisa: se queda la que dure más y no se pierde nada.
  | { tipo: 'condicion_no_puesta'; condicion: string; motivo: 'ya_la_tiene' }
  | { tipo: 'turnos_perdidos'; cantidad: number }
  | { tipo: 'bandera'; bandera: string }
  | { tipo: 'fin_partida'; fin: FinPartida };
