import { CONDICIONES } from '../catalogos/cargar-condiciones';
import { conCausaDeMuerte } from '../efectos/causa-de-muerte';
import { ENEMIGOS } from '../catalogos/cargar-enemigos';
import { OBJETOS } from '../catalogos/cargar-objetos';
import type { Enemigo, HabilidadDeEnemigo } from '../catalogos/enemigo';
import type { Objeto } from '../catalogos/objeto';
import { reduccionDanoActual } from '../condiciones/consultas';
import type { Dados } from '../dados/dados';
import { aplicarEfectos } from '../efectos/aplicar-efectos';
import type { Cambio } from '../efectos/cambio';
import type { CombateEnCurso, EnemigoEnCombate, ResultadoCombate, Sorpresa } from '../estado/combate';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import { calcularModificador } from '../modificadores/calcular-modificador';
import type { Efecto, EfectoDefinicion } from '../tablas/efecto';
import { resolverEfecto } from '../tablas/rangos/resolver-tabla';
import { ataqueBasico, ataqueDelJugador, castigoPorHambre, reducirDano, type TiradaDeAtaque } from './ataque';
import { emparejar, reemparejar } from './emparejamiento';

// EL COMBATE (Sprint 7). Reglas en la sección 3.12 del CLAUDE.md.
//
//   iniciarCombate:      copia los enemigos del bestiario, los numera y sortea quién ataca a quién.
//   atacar:              juega UNA ronda (el botón "Atacar"): todos tiran, el daño se aplica a la vez,
//                        los muertos salen (o reviven), alguno se cura, y quien se queda sin rival recibe otro.
//   huir:                intento de huida (después de cualquier ronda, nunca antes de la primera): 1d6, con 4+
//                        huye todo el grupo; si falla, en la próxima ronda los enemigos aciertan siempre.
//   usarObjetoEnCombate: un objeto de combate (ron, pistola, bomba de humo, poción). No gasta el ataque.
//   cerrarCombate:       recoge el resultado, cobra las recompensas y dice qué eventos saltan; quita el combate.
//   opcionesDeCombate:   qué botones están activos y, si no, por qué (para la interfaz).
//
// Mientras hay un combate (mundo.combate), no se puede hacer nada más.

/** Id del jugador dentro del combate (los seguidores usan su id de la partida; los enemigos, "enemigo_N"). */
export const ID_JUGADOR = 'jugador';

/** Bandera que apunta que "el afortunado" ya ha evitado su muerte (solo pasa una vez por partida). */
export const BANDERA_AFORTUNADO = 'afortunado_usado';

/** Lo que necesita un dado de huida para salir bien: 4 o más. */
export const DADO_PARA_HUIR = 4;

/** Evento que lanza el chamán si saca un 6 ("¡MALDITO!"). */
export const EVENTO_MALDICION = 'maldicion';

/** Cada cuántas rondas se cura un enemigo con "curarse", y cuánto. */
export const RONDAS_PARA_CURARSE = 2;
export const CURACION_DE_ENEMIGO = '1d6';

/** Veces que puede volver a levantarse un enemigo con "revivir_debilitado" (el pirata maldito). */
export const MAXIMO_REVIVIR_DEBILITADO = 3;

/** Con "revivir_una_vez", el dado que hay que sacar en 1d6 para volver. */
export const DADO_PARA_REVIVIR = 1;

/**
 * Lo que pide quien lanza el combate: "combate contra 3 piratas esqueleto".
 * ataque y resistencia cambian los números del bestiario SOLO en este combate
 * (el jaguar de E061 hace 3 en vez de 4 si superas el chequeo).
 */
export interface EnemigoPedido {
  enemigo: string;                    // id en el bestiario (data/enemigos.json)
  cantidad?: number | string;         // sin poner = 1. Puede ser con dados: "1d6" piratas
  ataque?: number;
  resistencia?: number;
  recompensa?: EfectoDefinicion[];    // por CADA uno derrotado: [{ "tipo": "oro", "cantidad": "2d6" }]
}

/** Opciones de un combate concreto. */
export interface OpcionesDeCombate {
  puedeHuir?: boolean;   // false = no se puede huir (combates dentro del barco, algunos eventos). Sin poner = sí
  noMortal?: boolean;    // true = si caes, te quedas con 1 PV y pierdes el combate, no la partida
  sorpresa?: Sorpresa;   // "nuestra" (emboscáis vosotros) o "suya" (¡emboscada!)
}

/**
 * Lo que va pasando, EN ORDEN, para que la interfaz lo enseñe de uno en uno
 * ("tiras 6 + 2", "−3 por hambre", "−1 piel de piedra", "pierdes 3 PV", "Pirata 3 muere"...).
 * Son datos, no mensajes. Los luchadores van por su id (jugador, forzudo_1, enemigo_2).
 *   emboscada:          la primera ronda solo atacáis vosotros ("nuestra") o solo ellos ("suya").
 *   enemigos_no_fallan: al empezar la ronda, si el jugador acaba de fallar una huida.
 *   ataque:             un ataque, con sus dados (tirada) y lo que recibe de verdad el objetivo (dano).
 *                       pielDePiedra = lo que ha quitado la piel de piedra de quien lo recibe (0 si nada).
 *                       dadosExtra = los dados de la pistola, si se sumaron.
 *   maldicion_pendiente: el chamán ha sacado un 6: al terminar el combate, ¡MALDITO!
 *   golpe_de_gracia:    el jugador iba a caer, pero ha matado a su rival esta ronda: se queda con 1 PV.
 *   afortunado:         el jugador iba a caer y "el afortunado" le salva (una vez por partida): 1 PV.
 *   derrota_no_mortal:  el jugador iba a caer en un combate no mortal: se queda con 1 PV y pierde el combate.
 *   herido:             la vida (jugador) o la resistencia (seguidores, enemigos) de alguien ha bajado.
 *   muerte:             alguien ha caído (nombre, porque un seguidor muerto ya no está en el grupo).
 *   revive:             un enemigo caído vuelve a levantarse (dado: el 1d6 del esqueleto).
 *   no_revive:          el esqueleto lo ha intentado y no le ha salido (dado).
 *   se_cura:            un enemigo con "curarse" recupera resistencia.
 *   nuevo_objetivo:     alguien se ha quedado sin rival y ahora ataca a otro.
 *   huida:              un intento de huida, con su dado y si ha salido bien.
 *   objeto_usado:       el jugador ha usado un objeto de combate.
 *   fin:                el combate ha terminado.
 */
export type SucesoDeCombate =
  | { tipo: 'emboscada'; quien: Sorpresa }
  | { tipo: 'enemigos_no_fallan' }
  | { tipo: 'ataque'; atacante: string; objetivo: string; tirada: TiradaDeAtaque; pielDePiedra: number; dano: number; dadosExtra?: number[] }
  | { tipo: 'maldicion_pendiente'; luchador: string }
  | { tipo: 'golpe_de_gracia' }
  | { tipo: 'afortunado' }
  | { tipo: 'derrota_no_mortal' }
  | { tipo: 'herido'; luchador: string; antes: number; despues: number }
  | { tipo: 'muerte'; luchador: string; nombre: string }
  | { tipo: 'revive'; luchador: string; ataque: number; resistencia: number; dado?: number }
  | { tipo: 'no_revive'; luchador: string; dado: number }
  | { tipo: 'se_cura'; luchador: string; dado: number; antes: number; despues: number }
  | { tipo: 'nuevo_objetivo'; luchador: string; objetivo: string }
  | { tipo: 'huida'; dado: number; exito: boolean }
  | { tipo: 'objeto_usado'; objeto: string }
  | { tipo: 'fin'; resultado: ResultadoCombate };

/** Lo que devuelve una ronda (o una huida, o usar un objeto): el estado nuevo, los sucesos y los cambios reales. */
export interface ResultadoRonda {
  estado: Estado;
  sucesos: SucesoDeCombate[];
  cambios: Cambio[];
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Quiénes luchan en nuestro bando: el jugador y los seguidores que atacan (el mono, con ataque 0, no). */
export function aliadosQueLuchan(jugador: Jugador): string[] {
  return [ID_JUGADOR, ...jugador.seguidores.filter(s => s.ataque > 0).map(s => s.id)];
}

/** Los enemigos que siguen vivos. */
export function enemigosVivos(combate: CombateEnCurso): EnemigoEnCombate[] {
  return combate.enemigos.filter(e => e.resistencia > 0);
}

function tiene(enemigo: EnemigoEnCombate, habilidad: HabilidadDeEnemigo): boolean {
  return enemigo.habilidades.includes(habilidad);
}

// ---------------------------------------------------------------------------
// Empezar
// ---------------------------------------------------------------------------

/**
 * Empieza un combate. Gasta primero los números de las cantidades al azar ("1d6" piratas),
 * en el orden de los pedidos, y después los del sorteo de parejas.
 */
export function iniciarCombate(
  estado: Estado,
  pedidos: readonly EnemigoPedido[],
  dados: Dados,
  opciones: OpcionesDeCombate = {},
  bestiario: readonly Enemigo[] = ENEMIGOS,
): Estado {
  if (estado.mundo.finPartida) {
    throw new Error('iniciarCombate: la partida ya ha terminado');
  }
  if (estado.mundo.combate) {
    throw new Error('iniciarCombate: ya hay un combate en curso');
  }
  if (pedidos.length === 0) {
    throw new Error('iniciarCombate: hace falta al menos un enemigo');
  }

  const enemigos = crearEnemigos(pedidos, bestiario, dados);
  const objetivos = emparejar(aliadosQueLuchan(estado.jugador), enemigos.map(e => e.id), dados);
  const combate: CombateEnCurso = {
    enemigos,
    objetivos,
    ronda: 0,
    puedeHuir: opciones.puedeHuir ?? true,
    noMortal: opciones.noMortal ?? false,
    sorpresa: opciones.sorpresa ?? null,
    noPuedenFallar: false,
    bonificador: 0,
    dadoExtra: null,
    objetosUsados: [],
    eventosAlTerminar: [],
    resultado: null,
  };

  return { ...estado, mundo: { ...estado.mundo, combate, estadoDados: dados.obtenerEstado() } };
}

function crearEnemigos(pedidos: readonly EnemigoPedido[], bestiario: readonly Enemigo[], dados: Dados): EnemigoEnCombate[] {
  const fichas: { ficha: Enemigo; ataque: number; resistencia: number; recompensa?: EfectoDefinicion[] }[] = [];
  for (const pedido of pedidos) {
    const ficha = bestiario.find(e => e.id === pedido.enemigo);
    if (!ficha) {
      throw new Error(`iniciarCombate: no existe el enemigo "${pedido.enemigo}" en el bestiario`);
    }
    const cantidad = typeof pedido.cantidad === 'string' ? dados.tirar(pedido.cantidad).total : (pedido.cantidad ?? 1);
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      throw new Error(`iniciarCombate: la cantidad de "${pedido.enemigo}" debe ser un número entero de 1 o más`);
    }
    const ataque = pedido.ataque ?? ficha.ataque;
    const resistencia = pedido.resistencia ?? ficha.resistencia;
    if (!Number.isInteger(ataque) || ataque < 1 || !Number.isInteger(resistencia) || resistencia < 1) {
      throw new Error(`iniciarCombate: el ataque y la resistencia de "${pedido.enemigo}" deben ser números enteros de 1 o más`);
    }
    for (let i = 0; i < cantidad; i++) {
      fichas.push({ ficha, ataque, resistencia, recompensa: pedido.recompensa });
    }
  }

  // El número en el nombre solo aparece si hay varios del mismo tipo ("Pirata esqueleto 2").
  const totalPorTipo = new Map<string, number>();
  for (const { ficha } of fichas) {
    totalPorTipo.set(ficha.id, (totalPorTipo.get(ficha.id) ?? 0) + 1);
  }
  const vistosPorTipo = new Map<string, number>();
  return fichas.map(({ ficha, ataque, resistencia, recompensa }, i) => {
    const numero = (vistosPorTipo.get(ficha.id) ?? 0) + 1;
    vistosPorTipo.set(ficha.id, numero);
    const nombre = totalPorTipo.get(ficha.id)! > 1 ? `${ficha.nombre} ${numero}` : ficha.nombre;
    const enemigo: EnemigoEnCombate = {
      id: `enemigo_${i + 1}`,
      tipo: ficha.id,
      nombre,
      categoria: ficha.categoria,
      ataque,
      resistencia,
      resistenciaMaxima: resistencia,
      habilidades: [...(ficha.habilidades ?? [])],
      vecesRevivido: 0,
    };
    return recompensa ? { ...enemigo, recompensa } : enemigo;
  });
}

// ---------------------------------------------------------------------------
// Una ronda
// ---------------------------------------------------------------------------

/**
 * Juega una ronda. Orden fijo de los dados: el jugador (y los de la pistola, si los hay), sus seguidores
 * (en el orden del grupo) y los enemigos vivos (en su orden; el velociraptor, sus dos ataques seguidos);
 * después, los esqueletos que intentan revivir, los que se curan y el nuevo emparejamiento.
 */
export function atacar(estado: Estado, dados: Dados): ResultadoRonda {
  const combate = comprobarCombateAbierto(estado, 'atacar');
  const jugador = estado.jugador;
  const castigo = castigoPorHambre(jugador.diasSinComer);
  const sucesos: SucesoDeCombate[] = [];
  const eventosAlTerminar = [...combate.eventosAlTerminar];
  let dadoExtra = combate.dadoExtra;

  const atacanAliados = combate.ronda > 0 || combate.sorpresa !== 'suya';
  const atacanEnemigos = combate.ronda > 0 || combate.sorpresa !== 'nuestra';
  if (combate.ronda === 0 && combate.sorpresa) {
    sucesos.push({ tipo: 'emboscada', quien: combate.sorpresa });
  }
  if (combate.noPuedenFallar) {
    sucesos.push({ tipo: 'enemigos_no_fallan' });
  }

  // 1. Todos tiran.
  type Ataque = { atacante: string; objetivo: string; tirada: TiradaDeAtaque; dadosExtra?: number[] };
  const ataques: Ataque[] = [];
  if (atacanAliados) {
    for (const id of aliadosQueLuchan(jugador)) {
      const objetivo = combate.objetivos[id];
      if (objetivo === undefined) continue;
      if (id === ID_JUGADOR) {
        ataques.push(ataqueDelJugadorEnCombate(jugador, combate, objetivo, castigo, dadoExtra, dados));
        dadoExtra = null; // la pistola se gasta en este ataque, acierte o no
      } else {
        const seguidor = jugador.seguidores.find(s => s.id === id)!;
        ataques.push({ atacante: id, objetivo, tirada: ataqueBasico(seguidor.ataque, castigo, dados) });
      }
    }
  }
  if (atacanEnemigos) {
    for (const enemigo of enemigosVivos(combate)) {
      const objetivo = combate.objetivos[enemigo.id];
      if (objetivo === undefined) continue;
      const aciertaCon = tiene(enemigo, 'acierta_con_5') ? 5 : 3;
      const primero = ataqueBasico(enemigo.ataque, 0, dados, combate.noPuedenFallar, aciertaCon);
      const tiradas = [primero];
      if (tiene(enemigo, 'ataca_dos_veces') && primero.dados[0] !== 1) {
        tiradas.push(ataqueBasico(enemigo.ataque, 0, dados, combate.noPuedenFallar, aciertaCon));
      }
      for (const tirada of tiradas) {
        ataques.push({ atacante: enemigo.id, objetivo, tirada });
        if (tiene(enemigo, 'maldice_con_6') && tirada.dados[0] === 6 && !eventosAlTerminar.includes(EVENTO_MALDICION)) {
          eventosAlTerminar.push(EVENTO_MALDICION);
          sucesos.push({ tipo: 'maldicion_pendiente', luchador: enemigo.id });
        }
      }
    }
  }

  // 2. Lo que recibe cada uno (piel de piedra, golpe a golpe). El daño que sobra se pierde.
  const reduccionJugador = reduccionDanoActual(jugador);
  const danoRecibido = new Map<string, number>();
  for (const { atacante, objetivo, tirada, dadosExtra } of ataques) {
    const golpe = tirada.dano + (dadosExtra ?? []).reduce((suma, d) => suma + d, 0);
    const reduccion = objetivo === ID_JUGADOR ? reduccionJugador : tieneEnemigo(combate, objetivo, 'piel_de_piedra') ? 1 : 0;
    const dano = reducirDano(golpe, reduccion);
    const suceso: SucesoDeCombate = { tipo: 'ataque', atacante, objetivo, tirada, pielDePiedra: golpe - dano, dano };
    sucesos.push(dadosExtra ? { ...suceso, dadosExtra } : suceso);
    danoRecibido.set(objetivo, (danoRecibido.get(objetivo) ?? 0) + dano);
  }

  // 3. Los enemigos reciben su daño (todo a la vez).
  const enemigos = combate.enemigos.map(e => ({ ...e }));
  const heridosEnemigos: SucesoDeCombate[] = [];
  const caidos: EnemigoEnCombate[] = [];
  for (const enemigo of enemigos) {
    const dano = danoRecibido.get(enemigo.id) ?? 0;
    if (enemigo.resistencia <= 0 || dano <= 0) continue;
    const antes = enemigo.resistencia;
    enemigo.resistencia = Math.max(0, antes - dano);
    heridosEnemigos.push({ tipo: 'herido', luchador: enemigo.id, antes, despues: enemigo.resistencia });
    if (enemigo.resistencia === 0) {
      caidos.push(enemigo);
    }
  }
  const quedanEnemigos = enemigos.some(e => e.resistencia > 0);

  // 4. El jugador, si iba a caer: golpe de gracia, combate no mortal o el afortunado (en ese orden).
  let danoJugador = danoRecibido.get(ID_JUGADOR) ?? 0;
  let afortunado = false;
  let derrotaNoMortal = false;
  if (danoJugador > 0 && danoJugador >= jugador.vida) {
    const ataqueDelJugadorEnRonda = ataques.find(a => a.atacante === ID_JUGADOR);
    const rival = caidos.find(e => e.id === combate.objetivos[ID_JUGADOR]);
    if (ataqueDelJugadorEnRonda?.tirada.acierta && rival) {
      danoJugador = jugador.vida - 1;
      sucesos.push({ tipo: 'golpe_de_gracia' });
    } else if (combate.noMortal) {
      danoJugador = jugador.vida - 1;
      derrotaNoMortal = quedanEnemigos;
      if (derrotaNoMortal) sucesos.push({ tipo: 'derrota_no_mortal' });
    } else if (jugador.sobrenombre === 'el_afortunado' && !estado.mundo.banderas[BANDERA_AFORTUNADO]) {
      danoJugador = jugador.vida - 1;
      afortunado = true;
      sucesos.push({ tipo: 'afortunado' });
    }
  }

  // 5. El daño del jugador y de sus seguidores pasa por aplicarEfectos (muertes, seguidor vital, fin de partida).
  const efectos: Efecto[] = [];
  if (danoJugador > 0) {
    efectos.push({ tipo: 'vida', cantidad: -danoJugador });
  }
  for (const seguidor of jugador.seguidores) {
    const dano = danoRecibido.get(seguidor.id) ?? 0;
    if (dano > 0) {
      efectos.push({ tipo: 'herir_seguidor', seguidor: seguidor.id, cantidad: dano });
    }
  }
  if (afortunado) {
    efectos.push({ tipo: 'bandera', bandera: BANDERA_AFORTUNADO });
  }
  const aplicado = aplicarEfectos(estado, efectos, dados);
  aplicado.estado = conCausaDeMuerte(aplicado.estado, { tipo: 'combate', enemigos: [...new Set(combate.enemigos.map(e => e.tipo))] });
  const despues = aplicado.estado.jugador;
  const partidaPerdida = aplicado.estado.mundo.finPartida !== null;

  // 6. Heridas y muertes, en orden: el jugador, sus seguidores y los enemigos.
  const muertos: SucesoDeCombate[] = [];
  if (despues.vida !== jugador.vida) {
    sucesos.push({ tipo: 'herido', luchador: ID_JUGADOR, antes: jugador.vida, despues: despues.vida });
    if (despues.vida <= 0) {
      muertos.push({ tipo: 'muerte', luchador: ID_JUGADOR, nombre: jugador.nombre });
    }
  }
  for (const seguidor of jugador.seguidores) {
    const ahora = despues.seguidores.find(s => s.id === seguidor.id);
    const murio = aplicado.cambios.some(c => c.tipo === 'seguidor_muerto' && c.seguidor === seguidor.id);
    const resistencia = ahora ? ahora.resistencia : murio ? 0 : seguidor.resistencia;
    if (resistencia !== seguidor.resistencia) {
      sucesos.push({ tipo: 'herido', luchador: seguidor.id, antes: seguidor.resistencia, despues: resistencia });
      if (resistencia <= 0) {
        muertos.push({ tipo: 'muerte', luchador: seguidor.id, nombre: seguidor.nombre });
      }
    }
  }
  sucesos.push(...heridosEnemigos, ...muertos);

  // 7. Los enemigos caídos: mueren, o vuelven a levantarse (si la partida sigue).
  for (const caido of caidos) {
    sucesos.push({ tipo: 'muerte', luchador: caido.id, nombre: caido.nombre });
    if (partidaPerdida) continue;
    if (tiene(caido, 'revivir_debilitado') && caido.vecesRevivido < MAXIMO_REVIVIR_DEBILITADO && caido.resistenciaMaxima > 1) {
      caido.vecesRevivido += 1;
      caido.resistenciaMaxima -= 1;
      caido.resistencia = caido.resistenciaMaxima;
      caido.ataque = Math.max(1, caido.ataque - 1);
      sucesos.push({ tipo: 'revive', luchador: caido.id, ataque: caido.ataque, resistencia: caido.resistencia });
    } else if (tiene(caido, 'revivir_una_vez') && caido.vecesRevivido === 0) {
      caido.vecesRevivido = 1;
      const dado = dados.tirar('1d6').total;
      if (dado === DADO_PARA_REVIVIR) {
        caido.resistencia = caido.resistenciaMaxima;
        sucesos.push({ tipo: 'revive', luchador: caido.id, ataque: caido.ataque, resistencia: caido.resistencia, dado });
      } else {
        sucesos.push({ tipo: 'no_revive', luchador: caido.id, dado });
      }
    }
  }

  // 8. Los que se curan al final de las rondas 2, 4, 6...
  const ronda = combate.ronda + 1;
  if (!partidaPerdida && ronda % RONDAS_PARA_CURARSE === 0) {
    for (const enemigo of enemigos) {
      if (enemigo.resistencia > 0 && enemigo.resistencia < enemigo.resistenciaMaxima && tiene(enemigo, 'curarse')) {
        const dado = dados.tirar(CURACION_DE_ENEMIGO).total;
        const antes = enemigo.resistencia;
        enemigo.resistencia = Math.min(enemigo.resistenciaMaxima, antes + dado);
        sucesos.push({ tipo: 'se_cura', luchador: enemigo.id, dado, antes, despues: enemigo.resistencia });
      }
    }
  }

  // 9. ¿Ha terminado? Si no, quien se ha quedado sin rival recibe otro.
  const vivos = enemigos.filter(e => e.resistencia > 0).map(e => e.id);
  let resultado: ResultadoCombate | null = null;
  if (partidaPerdida) {
    resultado = 'derrota';
  } else if (vivos.length === 0) {
    resultado = 'victoria';
  } else if (derrotaNoMortal) {
    resultado = 'derrota';
  }

  let objetivos = combate.objetivos;
  if (resultado) {
    sucesos.push({ tipo: 'fin', resultado });
  } else {
    objetivos = reemparejar(combate.objetivos, aliadosQueLuchan(despues), vivos, dados);
    for (const [luchador, objetivo] of Object.entries(objetivos)) {
      if (combate.objetivos[luchador] !== objetivo) {
        sucesos.push({ tipo: 'nuevo_objetivo', luchador, objetivo });
      }
    }
  }

  const nuevoCombate: CombateEnCurso = {
    ...combate,
    enemigos,
    objetivos,
    ronda,
    sorpresa: null,
    noPuedenFallar: false,
    dadoExtra,
    eventosAlTerminar,
    resultado,
  };
  return { estado: conCombate(aplicado.estado, nuevoCombate, dados), sucesos, cambios: aplicado.cambios };
}

/** El ataque del jugador con todo lo suyo: bonificadores (objetos, condiciones, ron, contra no humanos) y la pistola. */
function ataqueDelJugadorEnCombate(
  jugador: Jugador,
  combate: CombateEnCurso,
  objetivo: string,
  castigo: number,
  dadoExtra: string | null,
  dados: Dados,
) {
  const rival = combate.enemigos.find(e => e.id === objetivo);
  const contraNoHumano = rival !== undefined && rival.categoria !== 'humano' ? calcularModificador(jugador, 'ataque_no_humano') : 0;
  const bonificador = calcularModificador(jugador, 'ataque') + contraNoHumano + combate.bonificador;
  const tirada = ataqueDelJugador(castigo, dados, bonificador);
  if (dadoExtra && tirada.acierta) {
    return { atacante: ID_JUGADOR, objetivo, tirada, dadosExtra: dados.tirar(dadoExtra).dados };
  }
  return { atacante: ID_JUGADOR, objetivo, tirada };
}

function tieneEnemigo(combate: CombateEnCurso, id: string, habilidad: HabilidadDeEnemigo): boolean {
  const enemigo = combate.enemigos.find(e => e.id === id);
  return enemigo !== undefined && tiene(enemigo, habilidad);
}

// ---------------------------------------------------------------------------
// Huir
// ---------------------------------------------------------------------------

/** Por qué no se puede huir ahora (para enseñar el botón desactivado con su motivo). */
export type MotivoNoHuir =
  | 'no_se_puede_huir'    // este combate no lo permite (dentro del barco...)
  | 'primera_ronda'       // hay que pelear al menos una ronda antes de intentarlo
  | 'acabas_de_fallar';   // ya lo intentaste tras esta ronda: toca pelear otra antes de volver a probar

/** Por qué no se puede usar un objeto de combate ahora. */
export type MotivoNoUsarObjeto =
  | 'ya_usado_en_este_combate'   // los permanentes (la pistola), una vez por combate
  | 'no_se_puede_huir';          // la bomba de humo, en un combate del que no se puede huir

/** Un objeto de combate del inventario, tal como lo enseña la interfaz (junto a "Atacar"). */
export interface ObjetoDeCombateDisponible {
  posicion: number;   // su posición en el inventario
  objeto: string;
  disponible: boolean;
  motivo?: MotivoNoUsarObjeto;
}

/** Lo que la interfaz necesita para pintar los botones del combate. */
export interface OpcionesDelCombate {
  atacar: boolean;
  huir: { disponible: boolean; motivo?: MotivoNoHuir };
  objetos: ObjetoDeCombateDisponible[];
}

/** Solo consulta: qué se puede hacer ahora en el combate. Sin combate o ya terminado, nada. */
export function opcionesDeCombate(estado: Estado, objetos: readonly Objeto[] = OBJETOS): OpcionesDelCombate {
  const combate = estado.mundo.combate;
  if (!combate || combate.resultado || estado.mundo.finPartida) {
    return { atacar: false, huir: { disponible: false }, objetos: [] };
  }
  const motivo = motivoParaNoHuir(combate);
  const deCombate: ObjetoDeCombateDisponible[] = [];
  estado.jugador.inventario.forEach((llevado, posicion) => {
    const ficha = objetos.find(o => o.id === llevado.id);
    if (ficha?.cuandoSeUsa !== 'combate') return;
    const noPuede = motivoParaNoUsar(combate, llevado.id, llevado.usosRestantes, ficha);
    deCombate.push(noPuede ? { posicion, objeto: llevado.id, disponible: false, motivo: noPuede } : { posicion, objeto: llevado.id, disponible: true });
  });
  return { atacar: true, huir: motivo ? { disponible: false, motivo } : { disponible: true }, objetos: deCombate };
}

function motivoParaNoHuir(combate: CombateEnCurso): MotivoNoHuir | undefined {
  if (!combate.puedeHuir) return 'no_se_puede_huir';
  if (combate.ronda === 0) return 'primera_ronda';
  if (combate.noPuedenFallar) return 'acabas_de_fallar';
  return undefined;
}

function motivoParaNoUsar(combate: CombateEnCurso, id: string, usosRestantes: number | undefined, ficha: Objeto): MotivoNoUsarObjeto | undefined {
  if (usosRestantes === undefined && combate.objetosUsados.includes(id)) return 'ya_usado_en_este_combate';
  if (ficha.enCombate?.efecto === 'huida' && !combate.puedeHuir) return 'no_se_puede_huir';
  return undefined;
}

/**
 * Intento de huida: 1d6, con 4 o más huye TODO el grupo y el combate termina ("huida").
 * Si falla, no pasa nada más ahora, pero en la próxima ronda los enemigos aciertan siempre.
 * Gasta un número del generador.
 */
export function huir(estado: Estado, dados: Dados): ResultadoRonda {
  const combate = comprobarCombateAbierto(estado, 'huir');
  const motivo = motivoParaNoHuir(combate);
  if (motivo) {
    throw new Error(`huir: ahora no se puede huir (${motivo})`);
  }

  const dado = dados.tirar('1d6').total;
  const exito = dado >= DADO_PARA_HUIR;
  const sucesos: SucesoDeCombate[] = [{ tipo: 'huida', dado, exito }];
  if (exito) {
    sucesos.push({ tipo: 'fin', resultado: 'huida' });
  }
  const nuevoCombate: CombateEnCurso = exito ? { ...combate, resultado: 'huida' } : { ...combate, noPuedenFallar: true };
  return { estado: conCombate(estado, nuevoCombate, dados), sucesos, cambios: [] };
}

// ---------------------------------------------------------------------------
// Objetos de combate
// ---------------------------------------------------------------------------

/**
 * Usa el objeto de combate de esa posición del inventario. No gasta el ataque: se puede usar
 * antes de "Atacar", incluso antes de la primera ronda. Los que tienen usos se gastan; los
 * permanentes (la pistola) se pueden usar una vez por combate.
 */
export function usarObjetoEnCombate(estado: Estado, posicion: number, dados: Dados, objetos: readonly Objeto[] = OBJETOS): ResultadoRonda {
  const combate = comprobarCombateAbierto(estado, 'usarObjetoEnCombate');
  const llevado = estado.jugador.inventario[posicion];
  if (!llevado) {
    throw new Error(`usarObjetoEnCombate: no hay ningún objeto en la posición ${posicion} del inventario`);
  }
  const ficha = objetos.find(o => o.id === llevado.id);
  if (!ficha || ficha.cuandoSeUsa !== 'combate' || !ficha.enCombate) {
    throw new Error(`usarObjetoEnCombate: "${llevado.id}" no se usa en combate`);
  }
  const motivo = motivoParaNoUsar(combate, llevado.id, llevado.usosRestantes, ficha);
  if (motivo) {
    throw new Error(`usarObjetoEnCombate: ahora no se puede usar "${llevado.id}" (${motivo})`);
  }

  // Gastar el uso (si tiene) pasa por aplicarEfectos, como cualquier objeto.
  const gasto: Efecto[] = llevado.usosRestantes === undefined ? [] : [{ tipo: 'gastar_uso', posicion }];
  const aplicado = aplicarEfectos(estado, gasto, dados, { objetos, condiciones: CONDICIONES });

  const sucesos: SucesoDeCombate[] = [{ tipo: 'objeto_usado', objeto: llevado.id }];
  let nuevo: CombateEnCurso = {
    ...combate,
    objetosUsados: llevado.usosRestantes === undefined ? [...combate.objetosUsados, llevado.id] : combate.objetosUsados,
  };
  const enCombate = ficha.enCombate;
  switch (enCombate.efecto) {
    case 'bonificador':
      nuevo = { ...nuevo, bonificador: nuevo.bonificador + (enCombate.cantidad ?? 0) };
      break;
    case 'dado_extra':
      nuevo = { ...nuevo, dadoExtra: enCombate.dados ?? null };
      break;
    case 'huida':
      nuevo = { ...nuevo, resultado: 'huida' };
      sucesos.push({ tipo: 'fin', resultado: 'huida' });
      break;
    case 'derrota_a_todos': {
      const enemigos = nuevo.enemigos.map(e => ({ ...e }));
      const vivos = enemigos.filter(e => e.resistencia > 0);
      for (const enemigo of vivos) {
        sucesos.push({ tipo: 'herido', luchador: enemigo.id, antes: enemigo.resistencia, despues: 0 });
        enemigo.resistencia = 0;
      }
      for (const enemigo of vivos) {
        sucesos.push({ tipo: 'muerte', luchador: enemigo.id, nombre: enemigo.nombre });
      }
      nuevo = { ...nuevo, enemigos, objetivos: {}, resultado: 'victoria' };
      sucesos.push({ tipo: 'fin', resultado: 'victoria' });
      break;
    }
  }

  return { estado: conCombate(aplicado.estado, nuevo, dados), sucesos, cambios: aplicado.cambios };
}

// ---------------------------------------------------------------------------
// Terminar
// ---------------------------------------------------------------------------

/** Lo que devuelve cerrarCombate. eventos = los que saltan ahora (la maldición del chamán: ¡MALDITO!). */
export interface CierreDeCombate {
  estado: Estado;
  resultado: ResultadoCombate;
  cambios: Cambio[];
  eventos: string[];
}

/**
 * Recoge el resultado de un combate terminado y lo quita del estado (mundo.combate vuelve a null).
 * Si la partida sigue (victoria, huida o derrota no mortal):
 *   - cobra la recompensa de cada enemigo que haya caído del todo (aunque se huya);
 *   - devuelve los eventos que saltan al terminar (la maldición del chamán).
 * Si la partida se ha perdido, no hay ni recompensas ni eventos.
 */
export function cerrarCombate(estado: Estado, dados: Dados): CierreDeCombate {
  const combate = estado.mundo.combate;
  if (!combate) {
    throw new Error('cerrarCombate: no hay ningún combate');
  }
  if (!combate.resultado) {
    throw new Error('cerrarCombate: el combate todavía no ha terminado');
  }
  const sinCombate: Estado = { ...estado, mundo: { ...estado.mundo, combate: null } };
  if (estado.mundo.finPartida) {
    return { estado: sinCombate, resultado: combate.resultado, cambios: [], eventos: [] };
  }

  const efectos: Efecto[] = combate.enemigos
    .filter(e => e.resistencia <= 0 && e.recompensa)
    .flatMap(e => e.recompensa!.map(definicion => resolverEfecto(definicion, dados)));
  const aplicado = aplicarEfectos(sinCombate, efectos, dados);
  return {
    estado: { ...aplicado.estado, mundo: { ...aplicado.estado.mundo, estadoDados: dados.obtenerEstado() } },
    resultado: combate.resultado,
    cambios: aplicado.cambios,
    eventos: [...combate.eventosAlTerminar],
  };
}

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------

function comprobarCombateAbierto(estado: Estado, funcion: string): CombateEnCurso {
  const combate = estado.mundo.combate;
  if (!combate) {
    throw new Error(`${funcion}: no hay ningún combate en curso`);
  }
  if (combate.resultado || estado.mundo.finPartida) {
    throw new Error(`${funcion}: el combate ya ha terminado`);
  }
  return combate;
}

function conCombate(estado: Estado, combate: CombateEnCurso, dados: Dados): Estado {
  return { ...estado, mundo: { ...estado.mundo, combate, estadoDados: dados.obtenerEstado() } };
}
