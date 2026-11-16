import { AJUSTES } from '../ajustes/ajustes';
import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Estado } from '../estado/estado';
import { ajusteDeSeguidores } from '../seguidores/consultas';
import { obtenerListaEventos } from '../tablas/listas-eventos/cargar-listas-eventos';
import { eventoAleatorio } from '../tablas/listas-eventos/elegir-evento';
import type { ListaEventos } from '../tablas/listas-eventos/lista-eventos';
import type { Lugar } from '../turno/lugar';
import { cerrarFaseDeAccion, comprobarQueSePuedeActuar, type ResultadoAccion, type Sitio } from './accion';

// REPOSAR es una ACCIÓN: gastar el día en recuperarse. No confundir con descansar() de
// core/turno/descansar.ts, que es la FASE de descanso (dormir por la noche, todos los días).

/**
 * Qué puede pasar mientras reposas, según dónde estés:
 *   barco:      lista "descuido_a_bordo" (dejas el mando de lado: el barco deriva, se cuela un polizón...).
 *   intemperie: la lista de eventos nocturnos (te pillan desprevenido).
 *   puerto, aldea y monasterio: nada. Donde hay gente se reposa tranquilo.
 */
export function listaDeEventosAlReposar(lugar: Lugar): ListaEventos | null {
  if (lugar === 'barco') {
    return obtenerListaEventos('descuido_a_bordo');
  }
  if (lugar === 'intemperie') {
    return obtenerListaEventos('nocturnos');
  }
  return null;
}

/** PV que recupera el grupo con la acción: AJUSTES.curaAlReposar, +1 por cada barbero-cirujano. */
export function curaAlReposar(estado: Estado): number {
  return AJUSTES.curaAlReposar + ajusteDeSeguidores(estado.jugador, 'curaAlReposar');
}

/**
 * ACCIÓN: REPOSAR. Pasar el día recuperándose, en cualquier sitio.
 *   1. El jugador y todos sus seguidores recuperan PV (ver curaAlReposar), sin pasar de su máximo.
 *      Es aparte de lo que se cure (o no) durmiendo por la noche.
 *   2. En el barco o a la intemperie puede pasar algo (AJUSTES.probabilidadEventoAlReposar):
 *      se devuelve como evento pendiente. En puertos, aldeas y monasterios no hay riesgo.
 * Después, la partida pasa a la fase de comida.
 *
 * NO toca el estado que recibe: devuelve uno nuevo.
 * Dados: en el barco o a la intemperie, 1 número si no pasa nada y 2 si hay evento. En sitio seguro, ninguno.
 */
export function reposar(estado: Estado, sitio: Sitio, dados: Dados): ResultadoAccion {
  comprobarQueSePuedeActuar(estado, 'reposar');

  const resultado = aplicarEfectos(estado, [{ tipo: 'vida', cantidad: curaAlReposar(estado), destino: 'todos' }], dados);

  const eventos: string[] = [];
  const lista = listaDeEventosAlReposar(sitio.lugar);
  if (lista) {
    const evento = eventoAleatorio(lista, AJUSTES.probabilidadEventoAlReposar, dados);
    if (evento !== null) {
      eventos.push(evento);
    }
  }

  return { estado: cerrarFaseDeAccion(resultado.estado, dados), cambios: resultado.cambios, eventos };
}
