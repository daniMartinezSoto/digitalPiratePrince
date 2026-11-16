import { Dados } from '../dados/dados';
import { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { TIPOS_SEGUIDOR } from '../catalogos/cargar-seguidores';
import { crearSeguidor } from '../seguidores/crear-seguidor';
import sobrenombres from '../../data/personaje/sobrenombres.json';
import caracteristicas from '../../data/personaje/caracteristicas.json';

const SOBRENOMBRE_HERMANO = 'el_hermano';

/**
 * El seguidor con el que empieza "el hermano": de un tipo al azar entre TODOS los del catálogo
 * (se contraten en puertos o no), todos con la misma probabilidad. Es gratis.
 *   - inseparable: nunca se marcha por su cuenta ni se le puede despedir.
 *   - vital: si muere, el jugador pierde la partida.
 * Cuenta para el máximo de seguidores. Gasta dos números del generador: el tipo y el nombre.
 */
function seguidorDelHermano(dados: Dados): Seguidor {
  const tipo = TIPOS_SEGUIDOR[dados.entero(0, TIPOS_SEGUIDOR.length - 1)];
  return crearSeguidor(tipo.id, [], dados, { inseparable: true, vital: true });
}

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

  // "El hermano" empieza acompañado (ver seguidorDelHermano). Los demás, solos.
  const seguidores = sobrenombre.id === SOBRENOMBRE_HERMANO ? [seguidorDelHermano(dados)] : [];

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

    seguidores,

    condiciones: [],
    fasesAccionPerdidas: 0
  };

  return jugador;
}