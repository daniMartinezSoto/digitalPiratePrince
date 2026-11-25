import { Dados } from '../dados/dados';
import { Jugador } from '../estado/jugador';
import type { Retrato } from './retrato';
import type { Seguidor } from '../estado/seguidor';
import { TIPOS_SEGUIDOR } from '../catalogos/cargar-seguidores';
import { crearSeguidor } from '../seguidores/crear-seguidor';
import { OBJETOS } from '../catalogos/cargar-objetos';
import type { ObjetoLlevado } from '../estado/objeto-llevado';
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

/** El objeto con el que empieza el sobrenombre, si tiene lista (gasta un número del generador). */
function objetoInicial(sobrenombre: { objetoInicialEntre?: string[] }, dados: Dados): ObjetoLlevado[] {
  const lista = sobrenombre.objetoInicialEntre;
  if (!lista || lista.length === 0) {
    return [];
  }
  const id = lista[dados.entero(0, lista.length - 1)];
  const ficha = OBJETOS.find(o => o.id === id);
  if (!ficha) {
    throw new Error(`crearPersonaje: no existe el objeto inicial "${id}" en el catálogo`);
  }
  return [ficha.usosMaximos === undefined ? { id } : { id, usosRestantes: ficha.usosMaximos }];
}

export function crearPersonaje(
  nombre: string,
  dados: Dados,
  retrato: Retrato = 'hombre'
): Jugador {

  // Seleccionar sobrenombre aleatorio.
  const tiradaSobrenombre = dados.tirar('1d11');
  const sobrenombre = sobrenombres[tiradaSobrenombre.total - 1];

  // Seleccionar perfil de características aleatorio.
  const tiradaCaracteristicas = dados.tirar('1d3');
  const perfil = caracteristicas[tiradaCaracteristicas.total - 1];

  // "El hermano" empieza acompañado (ver seguidorDelHermano). Los demás, solos.
  const seguidores = sobrenombre.id === SOBRENOMBRE_HERMANO ? [seguidorDelHermano(dados)] : [];

  // "El heredero" empieza con un objeto mágico al azar de su lista ("objetoInicialEntre" en
  // sobrenombres.json: los del tesoro mágico menos el ídolo antediluviano, el amuleto maldito, el
  // anillo de los deseos y la lira, decidido por el autor el 25-nov). Sin el +1 de fama: se empieza con 0.
  const inventario = objetoInicial(sobrenombre, dados);

  // Construir el jugador con sus valores iniciales.
  const jugador: Jugador = {
    nombre,
    sobrenombre: sobrenombre.id,
    retrato,

    vida: 18,
    vidaMax: 18,
    fuerza: perfil.fuerza + (sobrenombre.ajustes.fuerza ?? 0),
    ingenio: perfil.ingenio,

    oro: 50,
    tripulacion: 40,
    tripulacionMax: 40,
    comida: 5,
    fama: 0,
    famaObjetivo: 10 + (sobrenombre.ajustes.famaObjetivo ?? 0),

    diasSinComer: 0,

    inventario,
    capacidadInventario: 6 + (sobrenombre.ajustes.capacidadInventario ?? 0),

    seguidores,

    condiciones: [],
    fasesAccionPerdidas: 0
  };

  return jugador;
}