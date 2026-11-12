import { Dados } from '../dados/dados';
import { Estado } from '../estado/estado';
import { crearPersonaje } from '../personaje/crear-personaje';

// Versión actual de la estructura del estado. Se sube cuando cambie su formato.
export const VERSION_ESTADO = 1;

export interface Partida {
  estado: Estado;
  dados: Dados;
}

export function crearPartida(semilla: number, nombre: string): Partida {
  const dados = new Dados(semilla);
  const jugador = crearPersonaje(nombre, dados);

  const estado: Estado = {
    version: VERSION_ESTADO,
    jugador,
    mundo: {
      mapaId: null,
      posicion: null,
      dia: 1,
      banderas: {},
      marcas: [],
      pilaEventos: [],
      puertosVisitados: [],
      estadoDados: dados.obtenerEstado(), // DESPUÉS de crear el personaje
    },
  };

  return { estado, dados };
}