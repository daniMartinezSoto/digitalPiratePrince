import type { Retrato } from '../personaje/retrato';
import { recibirAmuletoMaldito } from '../amuleto-maldito/recibir-amuleto-maldito';
import { Dados } from '../dados/dados';
import { Estado } from '../estado/estado';
import { obtenerMapa } from '../mapa/cargar-mapas';
import { casillaInicialDelBarco } from '../mapa/donde-estas';
import { crearPersonaje } from '../personaje/crear-personaje';

// Versión actual de la estructura del estado. Se sube cuando cambie su formato (y se escribe su
// adaptador en core/guardado/adaptadores.ts).
//   1 → 2 (Sprint 9): mapaId, posicion y posicionBarco siempre rellenos.
export const VERSION_ESTADO = 3;

/**
 * El mapa con el que empiezan las partidas. Hoy solo hay uno; cuando haya 2 o 3 se elegirá (con un
 * menú o al azar). Elegirlo al azar NO debe gastar dados de la partida sin pensarlo: cambiaría lo
 * que sale con cada semilla.
 */
export const MAPA_POR_DEFECTO = 'primer-mapa-prueba';

const SOBRENOMBRE_MALDITO = 'el_maldito';

export interface Partida {
  estado: Estado;
  dados: Dados;

  // Eventos que hay que lanzar nada más empezar. Hoy solo puede salir el "deseo" del amuleto
  // de "el maldito". Hasta el motor de eventos (Sprint 10) quedan pendientes.
  eventos: string[];
}

export function crearPartida(semilla: number, nombre: string, retrato: Retrato = 'hombre', mapaId: string = MAPA_POR_DEFECTO): Partida {
  const dados = new Dados(semilla);
  const jugador = crearPersonaje(nombre, dados, retrato);
  // Empiezas a pie en la casilla de inicio; el barco te espera junto al puerto principal más cercano.
  const mapa = obtenerMapa(mapaId);
  const posicionBarco = casillaInicialDelBarco(mapa);
  if (!posicionBarco) throw new Error(`crearPartida: el mapa "${mapaId}" no tiene sitio para el barco al empezar`);

  let estado: Estado = {
    version: VERSION_ESTADO,
    jugador,
    mundo: {
      mapaId: mapa.id,
      posicion: { ...mapa.inicio },
      posicionBarco,
      dia: 1,
      fase: 'inicio',
      banderas: {},
      marcas: [],
      pilaEventos: [],
      puertosVisitados: [],
      semilla,
      estadoDados: 0, // se apunta al final
      finPartida: null,
      accionEnCurso: null,
      combate: null,
      combateNaval: null,
      nochePagada: false,
      comidaGratis: false,
      ultimaBusquedaInformacion: null,
    },
  };

  // "El maldito" empieza con su amuleto: se tiran ya los dos dados (bendición y maldición).
  // Se hace aquí y no en crearPersonaje porque recibir el amuleto pasa por aplicarEfectos,
  // que trabaja con el estado completo. Solo con ese sobrenombre se gastan esos dados.
  let eventos: string[] = [];
  if (jugador.sobrenombre === SOBRENOMBRE_MALDITO) {
    const amuleto = recibirAmuletoMaldito(estado, dados);
    estado = amuleto.estado;
    eventos = amuleto.eventos;
  }

  // El número interno de los dados, DESPUÉS de crear el personaje (y su amuleto, si lo tiene).
  estado = { ...estado, mundo: { ...estado.mundo, estadoDados: dados.obtenerEstado() } };

  return { estado, dados, eventos };
}
