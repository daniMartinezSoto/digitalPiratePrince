import type { Modificadores } from '../modificadores/id-tirada';

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
}
