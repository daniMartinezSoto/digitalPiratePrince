import type { Modificadores } from '../modificadores/id-tirada';

// Reglas con número que una habilidad CAMBIA mientras el seguidor te acompaña. Se suman a la regla
// normal (y entre sí: con dos barberos-cirujanos, +2).
//   curaAlReposar:  PV de más que recupera el grupo con la acción "Reposar" (el barbero-cirujano: 1).
//   reservasAlPescar: reservas de más cada vez que CONSIGUES pescar algo (el pescador: 1).
export const AJUSTES_DE_HABILIDAD = ['curaAlReposar', 'reservasAlPescar'] as const;
export type AjusteDeHabilidad = (typeof AJUSTES_DE_HABILIDAD)[number];
export type AjustesDeHabilidad = Partial<Record<AjusteDeHabilidad, number>>;

// Ficha de catálogo de una habilidad de seguidor (p. ej. la del barbero-cirujano).
// El seguidor solo guarda el id; el resto se busca aquí.
export interface Habilidad {
  // Identificador único, p. ej. "cirujano".
  id: string;

  nombre: string;
  descripcion: string;

  // Ruta del dibujo. Opcional.
  imagen?: string;

  // Las pasivas se aplican solas.
  // Las activas las usa el jugador (p. ej. "Mendigar" del artista). Sin tiempos de espera.
  tipo: 'pasiva' | 'activa';

  // Bonificadores a tiradas mientras el seguidor está en el grupo (barbero-cirujano: +1 en audiencias).
  modificadores?: Modificadores;

  // Reglas que cambian mientras el seguidor te acompaña, p. ej. { "curaAlReposar": 1 }.
  ajustes?: AjustesDeHabilidad;

  // Condiciones que tienes MIENTRAS te acompaña un seguidor con esta habilidad
  // (el guía nativo: ["vinculo_nativo"]). No se guardan en la partida: se calculan.
  otorga?: string[];
}
