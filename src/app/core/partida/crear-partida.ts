import { recibirAmuletoMaldito } from '../amuleto-maldito/recibir-amuleto-maldito';
import { Dados } from '../dados/dados';
import { Estado } from '../estado/estado';
import { crearPersonaje } from '../personaje/crear-personaje';

// Versión actual de la estructura del estado. Se sube cuando cambie su formato.
export const VERSION_ESTADO = 1;

const SOBRENOMBRE_MALDITO = 'el_maldito';

export interface Partida {
  estado: Estado;
  dados: Dados;

  // Eventos que hay que lanzar nada más empezar. Hoy solo puede salir el "deseo" del amuleto
  // de "el maldito". Hasta el motor de eventos (Sprint 10) quedan pendientes.
  eventos: string[];
}

export function crearPartida(semilla: number, nombre: string): Partida {
  const dados = new Dados(semilla);
  const jugador = crearPersonaje(nombre, dados);

  let estado: Estado = {
    version: VERSION_ESTADO,
    jugador,
    mundo: {
      mapaId: null,
      posicion: null,
      dia: 1,
      fase: 'inicio',
      banderas: {},
      marcas: [],
      pilaEventos: [],
      puertosVisitados: [],
      estadoDados: 0, // se apunta al final
      finPartida: null,
      accionEnCurso: null,
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
