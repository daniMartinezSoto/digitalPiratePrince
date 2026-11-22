import { AJUSTES } from '../ajustes/ajustes';
import { fuerzaActual, ingenioActual, vidaMaxActual } from '../condiciones/consultas';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import { guardarPartida } from '../guardado/guardar-partida';
import { leerPartida } from '../guardado/leer-partida';
import { crearPartida } from '../partida/crear-partida';
import { EVENTOS, existeEvento } from './cargar-eventos';
import {
  cerrarCombateDelEvento,
  continuarEvento,
  elegirOpcion,
  empezarCombateDelEvento,
  evitarEvento,
  hacerChequeo,
  lanzarEventos,
  seguirConElEvento,
  tirarDadosDelEvento,
  usarAmuletoDelDestino,
  vistaDelEvento,
  type ResultadoMotor,
} from './motor';

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// TODOS LOS EVENTOS, PROBADOS SOLOS (Sprint 10, paso 8; pedido por el autor el 23-nov).
//
// No hay que escribir nada por cada evento: este test coge la lista de eventos (cargar-eventos.ts) y
// juega cada uno muchas veces, eligiendo al azar en cada botón (cada opción, cada fila de cada tirada,
// éxito y fallo en cada chequeo, ganar / huir / perder en cada combate), en distintas situaciones
// (a bordo, en un puerto o en otro sitio; con mucho oro o sin nada; con la vida llena o con 1; con la
// mano de mono y el amuleto del destino o sin ellos). Siempre con las mismas semillas: si falla, falla
// siempre igual.
//
// En cada paso comprueba que:
//   - el evento siempre espera algo que se puede pulsar, y termina (nunca se atasca ni da vueltas);
//   - las opciones desactivadas de verdad no se pueden elegir;
//   - guardar y leer a mitad del evento deja la partida idéntica (y se sigue jugando con lo leído);
//   - vida, oro, comida, tripulación, fuerza e ingenio no se salen de sus topes;
//   - los eventos pendientes son solo los que aún no existen;
//   - al morir, siempre se sabe por qué.
// Y al final, que todos los pasos de todos los eventos se han jugado alguna vez (si no, o hay un paso al
// que no se llega, o hace falta otra situación aquí abajo).
//
// Lo que NO comprueba es que el evento haga lo que dice el libro (que el soborno sea 1d6×5): para eso
// están los tests escritos a mano de cada evento (deseo, guardia, borracho...).
// ═══════════════════════════════════════════════════════════════════════════════════════════════

type Donde = 'barco' | 'puerto' | 'otro';

interface Situacion {
  donde: Donde;
  oro: number;
  vidaUno: boolean;
  objetos: boolean; // la mano de mono y el amuleto del destino
}

const SITUACIONES: Situacion[] = (['barco', 'puerto', 'otro'] as Donde[]).flatMap(donde =>
  [0, 500].flatMap(oro => [false, true].flatMap(vidaUno => [false, true].map(objetos => ({ donde, oro, vidaUno, objetos })))),
);
const PARTIDAS_POR_SITUACION = 12;
const PASOS_MAXIMOS = 300;

function estadoEn(s: Situacion, semilla: number): Estado {
  const { estado } = crearPartida(semilla, 'Prueba');
  // La partida de prueba empieza en 6,0 (jungla); 6,2 es La Habana (puerto).
  const posicion = s.donde === 'barco' ? { ...estado.mundo.posicionBarco } : s.donde === 'puerto' ? { col: 6, fila: 2 } : estado.mundo.posicion;
  return {
    ...estado,
    jugador: {
      ...estado.jugador,
      oro: s.oro,
      vida: s.vidaUno ? 1 : estado.jugador.vida,
      inventario: s.objetos ? [{ id: 'mano_de_mono', usosRestantes: 3 }, { id: 'amuleto_del_destino', usosRestantes: 1 }] : [],
      seguidores: [],
    },
    mundo: { ...estado.mundo, fase: 'accion', posicion },
  };
}

/** Lo que tiene que cumplirse siempre, después de cada botón. */
function comprobar(estado: Estado, donde: string): Estado {
  const j = estado.jugador;
  const fallos: string[] = [];
  if (j.vida < 0 || j.vida > vidaMaxActual(j)) fallos.push(`vida ${j.vida} fuera de 0-${vidaMaxActual(j)}`);
  if (j.oro < 0) fallos.push(`oro ${j.oro}`);
  if (j.comida < 0 || j.comida > AJUSTES.comidaMaxima) fallos.push(`comida ${j.comida}`);
  if (j.tripulacion < 0) fallos.push(`tripulación ${j.tripulacion}`);
  if (fuerzaActual(j) > AJUSTES.caracteristicaMaxima) fallos.push(`fuerza ${fuerzaActual(j)}`);
  if (ingenioActual(j) > AJUSTES.caracteristicaMaxima) fallos.push(`ingenio ${ingenioActual(j)}`);
  if (fallos.length) throw new Error(`${donde}: ${fallos.join(', ')}`);

  // Guardar y leer a mitad del evento: idéntico. Se sigue con lo leído.
  const leido = leerPartida(guardarPartida(estado));
  if (!leido.ok) throw new Error(`${donde}: no se puede leer lo guardado (${leido.motivo})`);
  expect(leido.estado, `${donde}: guardar y leer cambia la partida`).toEqual(estado);
  return leido.estado;
}

/** Simula cómo acaba el combate en curso (el combate en sí se prueba en sus propios tests). */
function acabarCombate(estado: Estado, azar: Dados): Estado {
  const naval = estado.mundo.combateNaval;
  if (naval) {
    const resultado = azar.entero(0, 1) === 0 ? 'victoria' : 'huida';
    return { ...estado, mundo: { ...estado.mundo, combateNaval: { ...naval, resultado, resistencia: resultado === 'victoria' ? 0 : naval.resistencia } } };
  }
  const combate = estado.mundo.combate!;
  const posibles: ('victoria' | 'huida' | 'derrota')[] = ['victoria'];
  if (combate.puedeHuir) posibles.push('huida');
  if (combate.noMortal) posibles.push('derrota'); // perder sin morir: te quedas con 1 PV
  const resultado = posibles[azar.entero(0, posibles.length - 1)];
  return {
    ...estado,
    jugador: resultado === 'derrota' ? { ...estado.jugador, vida: 1 } : estado.jugador,
    mundo: {
      ...estado.mundo,
      combate: { ...combate, resultado, enemigos: resultado === 'victoria' ? combate.enemigos.map(e => ({ ...e, resistencia: 0 })) : combate.enemigos },
    },
  };
}

/** Pulsa un botón al azar de los que ofrece la ventana. */
function pulsarAlAzar(estado: Estado, dados: Dados, azar: Dados, donde: string): ResultadoMotor {
  const vista = vistaDelEvento(estado);
  if (!vista) throw new Error(`${donde}: hay un evento en la pila pero la ventana no enseña nada`);

  switch (vista.modo) {
    case 'empezar':
      return azar.entero(1, 4) === 1 ? evitarEvento(estado, dados) : seguirConElEvento(estado, dados);

    case 'opciones': {
      const opciones = vista.opciones!;
      opciones.forEach((o, i) => {
        if (!o.disponible) expect(() => elegirOpcion(estado, i, dados), `${donde}: la opción desactivada «${o.texto}» se puede elegir`).toThrow();
      });
      const disponibles = opciones.flatMap((o, i) => (o.disponible ? [i] : []));
      if (disponibles.length === 0) throw new Error(`${donde}: ninguna opción se puede elegir (el evento se atasca)`);
      return elegirOpcion(estado, disponibles[azar.entero(0, disponibles.length - 1)], dados);
    }

    case 'tirada': {
      const t = vista.tirada!;
      if (t.puedeElegir && azar.entero(1, 3) === 1) return usarAmuletoDelDestino(estado, dados);
      return tirarDadosDelEvento(estado, dados, { resultadoTrucado: azar.entero(t.minimo, t.maximo) });
    }

    case 'elegir_resultado': {
      const resultados = vista.resultados!;
      if (resultados.length === 0) throw new Error(`${donde}: el amuleto no ofrece ningún resultado`);
      return tirarDadosDelEvento(estado, dados, { resultadoElegido: resultados[azar.entero(0, resultados.length - 1)].numero });
    }

    case 'chequeo':
      return hacerChequeo(estado, dados, { dadoTrucado: azar.entero(1, 6) });

    case 'combate':
    case 'combate_naval': {
      const empezado = empezarCombateDelEvento(estado, dados);
      if (!empezado.estado.mundo.combate && !empezado.estado.mundo.combateNaval) throw new Error(`${donde}: «Luchar» no empieza ningún combate`);
      return cerrarCombateDelEvento(acabarCombate(empezado.estado, azar), dados);
    }

    case 'en_combate':
      return cerrarCombateDelEvento(acabarCombate(estado, azar), dados);

    case 'continuar':
      return continuarEvento(estado, dados);

    case 'muerte':
      throw new Error(`${donde}: la partida ya ha terminado`);
  }
}

/** Juega un evento entero al azar. Devuelve los pasos por los que ha pasado ("evento › paso"). */
function jugarUnaVez(id: string, situacion: Situacion, semilla: number): Set<string> {
  const donde = `${id} (${situacion.donde}, ${situacion.oro} de oro, vida ${situacion.vidaUno ? '1' : 'llena'}${situacion.objetos ? ', con objetos' : ''}, semilla ${semilla})`;
  const dados = new Dados(semilla);
  const azar = new Dados(semilla * 7919 + 1);
  const pasos = new Set<string>();
  const apuntar = (estado: Estado) => estado.mundo.pilaEventos.forEach(m => pasos.add(`${m.evento} › ${m.paso}`));

  let r = lanzarEventos(estadoEn(situacion, semilla), [id], dados);
  for (let paso = 0; ; paso++) {
    const estado = comprobar(r.estado, `${donde}, botón ${paso}`);
    apuntar(estado);
    for (const pendiente of r.pendientes) {
      if (existeEvento(pendiente)) throw new Error(`${donde}: "${pendiente}" sale como pendiente, pero ese evento ya existe`);
    }

    if (estado.mundo.finPartida) {
      expect(vistaDelEvento(estado)?.modo ?? 'muerte', `${donde}: al morir la ventana no enseña la muerte`).toBe('muerte');
      if (estado.mundo.finPartida.resultado === 'derrota') {
        expect(estado.mundo.finPartida.causa, `${donde}: has muerto y no se sabe por qué`).toBeDefined();
      }
      return pasos;
    }
    if (estado.mundo.pilaEventos.length === 0) {
      expect(r.terminado, `${donde}: la pila está vacía pero el motor no dice "terminado"`).toBe(true);
      return pasos;
    }
    expect(r.terminado, `${donde}: el motor dice "terminado" con eventos en la pila`).toBe(false);
    if (paso >= PASOS_MAXIMOS) throw new Error(`${donde}: tras ${PASOS_MAXIMOS} botones el evento no termina (¿un bucle?)`);

    r = pulsarAlAzar(estado, dados, azar, `${donde}, botón ${paso}`);
  }
}

describe('todos los eventos, probados solos', () => {
  const vistos = new Set<string>();

  for (const evento of EVENTOS) {
    it(`${evento.id} (${evento.titulo}): termina siempre, sin romper nada, en todas las situaciones`, () => {
      let semilla = 1;
      for (const situacion of SITUACIONES) {
        for (let i = 0; i < PARTIDAS_POR_SITUACION; i++) {
          jugarUnaVez(evento.id, situacion, semilla++).forEach(p => vistos.add(p));
        }
      }
    });
  }

  it('todos los pasos de todos los eventos se han jugado alguna vez', () => {
    const sinJugar = EVENTOS.flatMap(e => Object.keys(e.pasos).map(p => `${e.id} › ${p}`)).filter(p => !vistos.has(p));
    expect(sinJugar, 'pasos a los que nunca se ha llegado (¿inalcanzables, o falta una situación en este test?)').toEqual([]);
  });
});
