import type { Mundo } from '../estado/mundo';

// LOS PUERTOS PRINCIPALES (decidido por el autor el 20-nov): para ganar hay que haber visitado los 4,
// uno en cada esquina del mapa, y llegar después a un puerto con la fama objetivo.
// PROVISIONAL: cuando exista el mapa (Sprint 9), cada mapa declarará los suyos (data/mapas/<id>.json);
// hasta entonces, estos cuatro. La interfaz enseñará el logo de cada uno.
export interface PuertoPrincipal {
  id: string;
  nombre: string;
}

export const PUERTOS_PRINCIPALES: readonly PuertoPrincipal[] = [
  { id: 'tortuga', nombre: 'Tortuga' },
  { id: 'port_royal', nombre: 'Port Royal' },
  { id: 'la_habana', nombre: 'La Habana' },
  { id: 'nassau', nombre: 'Nassau' },
];

export function esPuertoPrincipal(id: string, puertos: readonly PuertoPrincipal[] = PUERTOS_PRINCIPALES): boolean {
  return puertos.some(p => p.id === id);
}

/** Solo consulta: cada puerto principal y si ya se ha visitado (para "Puertos 1/4"). */
export function progresoDePuertos(
  mundo: Mundo,
  puertos: readonly PuertoPrincipal[] = PUERTOS_PRINCIPALES,
): { puertos: (PuertoPrincipal & { visitado: boolean })[]; visitados: number; total: number } {
  const lista = puertos.map(p => ({ ...p, visitado: mundo.puertosVisitados.includes(p.id) }));
  return { puertos: lista, visitados: lista.filter(p => p.visitado).length, total: lista.length };
}

/** ¿Ha visitado ya todos los puertos principales? */
export function todosLosPuertosVisitados(mundo: Mundo, puertos: readonly PuertoPrincipal[] = PUERTOS_PRINCIPALES): boolean {
  return puertos.every(p => mundo.puertosVisitados.includes(p.id));
}
