import type { Estado } from '../estado/estado';
import { mapaDeLaPartida } from '../mapa/donde-estas';

// LOS PUERTOS PRINCIPALES (decidido por el autor el 20-nov): para ganar hay que haber visitado los 4,
// uno en cada esquina del mapa, y llegar después a un puerto con la fama objetivo.
// Desde el Sprint 9 los declara cada mapa (data/mapas/<id>.json; en Worldographer, el ancla roja).
// La interfaz enseñará el logo de cada uno.
export interface PuertoPrincipal {
  id: string;
  nombre: string;
}

/** Los puertos principales del mapa de la partida. */
export function puertosPrincipalesDe(estado: Estado): readonly PuertoPrincipal[] {
  return mapaDeLaPartida(estado).puertosPrincipales;
}

export function esPuertoPrincipal(id: string, puertos: readonly PuertoPrincipal[]): boolean {
  return puertos.some(p => p.id === id);
}

/** Solo consulta: cada puerto principal y si ya se ha visitado (para "Puertos 1/4"). */
export function progresoDePuertos(
  estado: Estado,
  puertos: readonly PuertoPrincipal[] = puertosPrincipalesDe(estado),
): { puertos: (PuertoPrincipal & { visitado: boolean })[]; visitados: number; total: number } {
  const lista = puertos.map(p => ({ id: p.id, nombre: p.nombre, visitado: estado.mundo.puertosVisitados.includes(p.id) }));
  return { puertos: lista, visitados: lista.filter(p => p.visitado).length, total: lista.length };
}

/** ¿Ha visitado ya todos los puertos principales? */
export function todosLosPuertosVisitados(estado: Estado, puertos: readonly PuertoPrincipal[] = puertosPrincipalesDe(estado)): boolean {
  return puertos.every(p => estado.mundo.puertosVisitados.includes(p.id));
}
