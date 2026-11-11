import { Dados } from '../dados/dados';
import { Jugador } from '../estado/jugador';
import sobrenombres from '../../data/personaje/sobrenombres.json';
import caracteristicas from '../../data/personaje/caracteristicas.json';

export function crearPersonaje(
  nombre: string,
  dados: Dados
): Jugador {

  // Seleccionar sobrenombre aleatorio.
  const tiradaSobrenombre = dados.tirar('1d11');
  const sobrenombre = sobrenombres[tiradaSobrenombre.total - 1];

  // Seleccionar perfil de características aleatorio.
  const tiradaCaracteristicas = dados.tirar('1d3');
  const perfil = caracteristicas[tiradaCaracteristicas.total - 1];

  // Construir el jugador con sus valores iniciales.
  const jugador: Jugador = {
    nombre,
    sobrenombre: sobrenombre.id,

    vida: 15,
    vidaMax: 15,
    fuerza: perfil.fuerza + (sobrenombre.ajustes.fuerza ?? 0),
    ingenio: perfil.ingenio,

    oro: 50,
    tripulacion: 40,
    tripulacionMax: 40,
    comida: 5,
    fama: 0,
    famaObjetivo: 10 + (sobrenombre.ajustes.famaObjetivo ?? 0),

    diasSinComer: 0,

    inventario: [],
    capacidadInventario: 5 + (sobrenombre.ajustes.capacidadInventario ?? 0),

    seguidores: []
  };

  return jugador;
}