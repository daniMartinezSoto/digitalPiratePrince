import type { FinPartida } from '../estado/fin-partida';
import type { TipoRecurso } from '../tablas/efecto';

/**
 * Un cambio REAL que ha hecho aplicarEfectos: el "chivato" para avisar al jugador.
 * Son datos, no mensajes: la interfaz decide cómo contarlo ("+2 tripulación", un icono...).
 * Cuentan lo que pasó de verdad: si el efecto era +5 de tripulación pero solo cabían 2,
 * el cambio dice de 38 a 40.
 */
export type Cambio =
  // Un recurso o característica del jugador. motivo: por qué, si no es el efecto en sí.
  | { tipo: 'recurso'; recurso: TipoRecurso; antes: number; despues: number; motivo?: 'contable' | 'objeto_magico' }
  // La resistencia (vida) de un seguidor.
  | { tipo: 'resistencia_seguidor'; seguidor: string; antes: number; despues: number }
  | { tipo: 'seguidor_muerto'; seguidor: string }
  // Un seguidor se va por su cuenta (hambre, dormir en la calle). No es lo mismo que morir.
  | { tipo: 'seguidor_se_marcha'; seguidor: string }
  | { tipo: 'objeto_ganado'; objeto: string }
  | { tipo: 'objeto_no_cabe'; objeto: string }
  | { tipo: 'objeto_perdido'; objeto: string }
  | { tipo: 'condicion_puesta'; condicion: string; turnos?: number }
  | { tipo: 'condicion_quitada'; condicion: string }
  | { tipo: 'turnos_perdidos'; cantidad: number }
  | { tipo: 'bandera'; bandera: string }
  | { tipo: 'fin_partida'; fin: FinPartida };
