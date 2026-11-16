import type { FinPartida } from '../estado/fin-partida';
import type { TipoRecurso } from '../tablas/efecto';

// Por qué cambia un recurso, cuando no es por el efecto en sí:
//   contable:       el contable gana 2d6 de oro más cada vez que gana oro.
//   objeto_magico:  +1 de fama al conseguir un objeto mágico.
//   odio_al_dinero: con esa maldición, cada vez que gana oro gana 1d6 menos.
export type MotivoDeRecurso = 'contable' | 'objeto_magico' | 'odio_al_dinero';

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
  // Un seguidor se va por su cuenta (hambre, dormir en la calle). No es lo mismo que morir.
  | { tipo: 'seguidor_se_marcha'; seguidor: string }
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
  // partes: las condiciones que lleva dentro (las dos mitades del amuleto maldito).
  | { tipo: 'condicion_puesta'; condicion: string; turnos?: number; partes?: string[] }
  | { tipo: 'condicion_quitada'; condicion: string }
  | { tipo: 'turnos_perdidos'; cantidad: number }
  | { tipo: 'bandera'; bandera: string }
  | { tipo: 'fin_partida'; fin: FinPartida };
