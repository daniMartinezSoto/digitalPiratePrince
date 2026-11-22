import { Dados } from '../dados/dados';
import { dadosTrucados } from '../dados/dados-trucados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import { guardarPartida } from '../guardado/guardar-partida';
import { leerPartida } from '../guardado/leer-partida';
import { crearPartida } from '../partida/crear-partida';
import type { Evento } from './evento';
import {
  cerrarCombateDelEvento,
  continuarEvento,
  elegirOpcion,
  empezarCombateDelEvento,
  evitarEvento,
  eventoYaOcurrido,
  hacerChequeo,
  hayEventoEnCurso,
  lanzarEventos,
  seguirConElEvento,
  tirarDadosDelEvento,
  vistaDelEvento,
  type ResultadoMotor,
} from './motor';
import { validarEventos } from './validar-evento';

// Tests del motor de eventos (Sprint 10, paso 2), con eventos de prueba hechos a medida.

const EVENTOS_DE_PRUEBA = [
  { id: 'sencillo', titulo: 'Sencillo', pasos: { inicio: { texto: 'Hola', efectos: [{ tipo: 'oro', cantidad: 10 }] } } },
  {
    id: 'elegir',
    titulo: 'Elegir',
    pasos: {
      inicio: {
        texto: '¿Qué haces?',
        opciones: [
          { texto: 'Coger oro', efectos: [{ tipo: 'oro', cantidad: 5 }] },
          { texto: 'Seguir el camino', paso: 'final' },
          { texto: 'No hacer nada' },
          { texto: 'Pedir el ídolo', requiere: { sinObjeto: 'idolo_antediluviano' }, efectos: [{ tipo: 'ganar_objeto', objeto: 'idolo_antediluviano' }] },
          { texto: 'Algo que no existe', evento: 'no_existe' },
        ],
      },
      final: { texto: 'Fin del camino' },
    },
  },
  {
    id: 'tirada',
    titulo: 'Tirada',
    pasos: {
      inicio: {
        texto: 'Tira el dado',
        tirada: {
          dado: '1d6',
          filas: [
            { min: 1, max: 1, texto: 'Un tentáculo', efectos: [{ tipo: 'tripulacion', cantidad: -1 }], volverATirar: true },
            { min: 2, max: 3, texto: 'No pasa nada' },
            { min: 4, max: 6, texto: 'Te llaman', llamar: 'sencillo', paso: 'vuelta' },
          ],
        },
      },
      vuelta: { texto: 'De vuelta' },
    },
  },
  {
    id: 'chequeo',
    titulo: 'Chequeo',
    pasos: { inicio: { chequeo: { caracteristica: 'fuerza', exito: { texto: 'Lo consigues' }, fallo: { efectos: [{ tipo: 'vida', cantidad: -2 }] } } } },
  },
  { id: 'salto', titulo: 'Salto', pasos: { inicio: { texto: 'Antes', evento: 'sencillo' } } },
  {
    id: 'pelea',
    titulo: 'Pelea',
    pasos: {
      inicio: {
        texto: '¡Pelea!',
        combate: {
          enemigos: [{ enemigo: 'pirata' }],
          victoria: { texto: 'Has ganado', efectos: [{ tipo: 'fama', cantidad: 1 }] },
          huida: { texto: 'Has huido' },
        },
      },
    },
  },
  { id: 'naval', titulo: 'Naval', pasos: { inicio: { texto: '¡Un barco!', combateNaval: { barco: 'barco_fantasma', victoria: { texto: 'Hundido' } } } } },
  { id: 'una_vez', titulo: 'Una vez', unaVez: true, pasos: { inicio: { texto: 'Solo una vez' } } },
  { id: 'hacia_una_vez', titulo: 'Hacia una vez', pasos: { inicio: { opciones: [{ texto: 'Ir', evento: 'una_vez' }, { texto: 'No' }] } } },
  {
    id: 'tirada_una_vez',
    titulo: 'Tirada una vez',
    pasos: {
      inicio: {
        tirada: {
          dado: '1d6',
          filas: [
            { min: 1, max: 3, evento: 'una_vez' },
            { min: 4, max: 6, texto: 'Otra cosa' },
          ],
        },
      },
    },
  },
  { id: 'muerte', titulo: 'Muerte', pasos: { inicio: { texto: 'Mueres', efectos: [{ tipo: 'perder_partida' }] } } },
  { id: 'bucle_a', titulo: 'A', pasos: { inicio: { llamar: 'bucle_b' } } },
  { id: 'bucle_b', titulo: 'B', pasos: { inicio: { llamar: 'bucle_a' } } },
] as unknown as Evento[];

function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return {
    ...estado,
    jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', fuerza: 3, ingenio: 3, oro: 50, inventario: [], seguidores: [], condiciones: [], ...cambios },
    mundo: { ...estado.mundo, fase: 'accion' },
  };
}

const lanzar = (estado: Estado, ids: string[], dados = new Dados(1)) => lanzarEventos(estado, ids, dados, EVENTOS_DE_PRUEBA);
const continuar = (r: ResultadoMotor, dados = new Dados(1)) => continuarEvento(r.estado, dados, EVENTOS_DE_PRUEBA);
const vista = (r: ResultadoMotor) => vistaDelEvento(r.estado, EVENTOS_DE_PRUEBA);
const elegir = (r: ResultadoMotor, i: number, dados = new Dados(1)) => elegirOpcion(r.estado, i, dados, EVENTOS_DE_PRUEBA);
const tirar = (r: ResultadoMotor, dados: Dados, opciones = {}) => tirarDadosDelEvento(r.estado, dados, opciones, EVENTOS_DE_PRUEBA);

function congelarTodo<T>(valor: T): T {
  if (typeof valor === 'object' && valor !== null) {
    Object.values(valor).forEach(congelarTodo);
    Object.freeze(valor);
  }
  return valor;
}

describe('motor de eventos', () => {
  it('los eventos de prueba están bien escritos', () => {
    expect(validarEventos(EVENTOS_DE_PRUEBA)).toEqual([]);
  });

  describe('lanzar y continuar', () => {
    it('un evento sencillo: aplica sus efectos, enseña el texto y espera a "Continuar"', () => {
      const r = lanzar(estadoCon(), ['sencillo']);

      expect(r.estado.jugador.oro).toBe(60);
      expect(r.terminado).toBe(false);
      expect(hayEventoEnCurso(r.estado)).toBe(true);
      expect(vista(r)).toMatchObject({ modo: 'continuar', titulo: 'Sencillo', texto: 'Hola', miga: ['Sencillo'] });
      expect(vista(r)!.lectura!.cambios).toEqual([{ tipo: 'recurso', recurso: 'oro', antes: 50, despues: 60 }]);
      expect(r.cambios).toEqual(vista(r)!.lectura!.cambios);
    });

    it('al continuar, el evento termina y la pila queda vacía', () => {
      const r = continuar(lanzar(estadoCon(), ['sencillo']));

      expect(r.terminado).toBe(true);
      expect(r.estado.mundo.pilaEventos).toEqual([]);
      expect(vista(r)).toBeNull();
    });

    it('un evento que no existe no rompe nada: sale en "pendientes"', () => {
      const r = lanzar(estadoCon(), ['no_existe']);

      expect(r.pendientes).toEqual(['no_existe']);
      expect(r.terminado).toBe(true);
    });

    it('varios eventos a la vez se juegan en orden, uno detrás de otro', () => {
      let r = lanzar(estadoCon(), ['salto', 'chequeo']);
      expect(vista(r)).toMatchObject({ titulo: 'Salto', miga: ['Salto'] });

      r = continuar(r); // "Antes" → salta a Sencillo
      expect(vista(r)).toMatchObject({ titulo: 'Sencillo', texto: 'Hola' });

      r = continuar(r); // Sencillo termina → empieza Chequeo
      expect(vista(r)).toMatchObject({ titulo: 'Chequeo', modo: 'chequeo' });
    });

    it('apunta por dónde van los dados', () => {
      const dados = new Dados(7);
      const r = lanzar(estadoCon(), ['sencillo'], dados);
      expect(r.estado.mundo.estadoDados).toBe(dados.obtenerEstado());
    });
  });

  describe('opciones', () => {
    it('enseña las opciones; la que no se puede, desactivada con su motivo', () => {
      const r = lanzar(estadoCon({ inventario: [{ id: 'idolo_antediluviano' }] }), ['elegir']);

      expect(vista(r)!.modo).toBe('opciones');
      expect(vista(r)!.texto).toBe('¿Qué haces?');
      expect(vista(r)!.opciones![0]).toEqual({ texto: 'Coger oro', disponible: true });
      expect(vista(r)!.opciones![3]).toEqual({ texto: 'Pedir el ídolo', disponible: false, motivo: 'ya_lo_tienes' });
    });

    it('elegir una opción aplica sus efectos y enseña lo que ha cambiado', () => {
      const r = elegir(lanzar(estadoCon(), ['elegir']), 0);

      expect(r.estado.jugador.oro).toBe(55);
      expect(vista(r)!.modo).toBe('continuar');
      expect(vista(r)!.lectura!.cambios).toHaveLength(1);
    });

    it('una opción puede llevar a otro paso', () => {
      const r = elegir(lanzar(estadoCon(), ['elegir']), 1);
      expect(vista(r)).toMatchObject({ modo: 'continuar', texto: 'Fin del camino' });
    });

    it('una opción sin nada termina el evento en el acto (no hay nada que leer)', () => {
      expect(elegir(lanzar(estadoCon(), ['elegir']), 2).terminado).toBe(true);
    });

    it('una opción que lleva a un evento sin programar: termina y lo apunta como pendiente', () => {
      const r = elegir(lanzar(estadoCon(), ['elegir']), 4);
      expect(r.pendientes).toEqual(['no_existe']);
      expect(r.terminado).toBe(true);
    });

    it('no deja elegir una opción desactivada ni una que no existe', () => {
      const r = lanzar(estadoCon({ inventario: [{ id: 'idolo_antediluviano' }] }), ['elegir']);
      expect(() => elegir(r, 3)).toThrow(/no se puede elegir/);
      expect(() => elegir(r, 9)).toThrow(/no hay opción 9/);
    });
  });

  describe('tiradas', () => {
    it('enseña el botón de tirar con el dado', () => {
      const r = lanzar(estadoCon(), ['tirada']);
      expect(vista(r)).toMatchObject({ modo: 'tirada', texto: 'Tira el dado', tirada: { dado: '1d6', modificador: 0, minimo: 1, maximo: 6, puedeElegir: false } });
    });

    it('la fila que sale manda: texto, efectos y los dados en la lectura', () => {
      const r = tirar(lanzar(estadoCon(), ['tirada']), dadosTrucados([2]));
      expect(vista(r)).toMatchObject({ modo: 'continuar', texto: 'No pasa nada' });
      expect(vista(r)!.lectura!.tirada).toEqual({ dados: [2], modificador: 0, total: 2 });
    });

    it('"vuelve a tirar": tras leerla, la misma tirada otra vez (sin repetir los efectos del paso)', () => {
      const antes = estadoCon().jugador.tripulacion;
      let r = tirar(lanzar(estadoCon(), ['tirada']), dadosTrucados([1]));
      expect(r.estado.jugador.tripulacion).toBe(antes - 1);
      expect(vista(r)!.texto).toBe('Un tentáculo');

      r = continuar(r);
      expect(vista(r)!.modo).toBe('tirada');
      expect(vista(r)!.lectura).toBeNull();
    });

    it('llamar y volver: se juega el otro evento y luego se sigue en el paso indicado', () => {
      let r = tirar(lanzar(estadoCon(), ['tirada']), dadosTrucados([5]));
      expect(vista(r)!.texto).toBe('Te llaman');

      r = continuar(r);
      expect(vista(r)).toMatchObject({ titulo: 'Sencillo', texto: 'Hola', miga: ['Tirada', 'Sencillo'] });

      r = continuar(r);
      expect(vista(r)).toMatchObject({ titulo: 'Tirada', texto: 'De vuelta', miga: ['Tirada'] });

      r = continuar(r);
      expect(r.terminado).toBe(true);
    });

    it('si la fila lleva a un evento de una sola vez que ya ocurrió, se vuelve a tirar', () => {
      const yaOcurrio = estadoCon();
      yaOcurrio.mundo.banderas = { evento_ocurrido_una_vez: true };
      const dados = dadosTrucados([2, 5]);

      const r = tirar(lanzar(yaOcurrio, ['tirada_una_vez']), dados);

      expect(vista(r)!.texto).toBe('Otra cosa');
      expect(dados.restantes()).toBe(0);
    });
  });

  describe('amuleto del destino', () => {
    const conAmuleto = () => estadoCon({ inventario: [{ id: 'amuleto_del_destino', usosRestantes: 1 }] });

    it('con el amuleto se puede elegir el resultado; el amuleto se gasta', () => {
      let r = lanzar(conAmuleto(), ['tirada']);
      expect(vista(r)!.tirada!.puedeElegir).toBe(true);

      r = tirar(r, dadosTrucados([]), { resultadoElegido: 3 });

      expect(vista(r)!.texto).toBe('No pasa nada');
      expect(vista(r)!.lectura!.tirada).toEqual({ dados: [3], modificador: 0, total: 3, elegida: true });
      expect(r.estado.jugador.inventario).toEqual([]);
    });

    it('solo se puede elegir lo que puede sacar el dado, y hace falta llevar el amuleto', () => {
      expect(() => tirar(lanzar(conAmuleto(), ['tirada']), dadosTrucados([]), { resultadoElegido: 7 })).toThrow(/del 1 al 6/);
      expect(() => tirar(lanzar(estadoCon(), ['tirada']), dadosTrucados([]), { resultadoElegido: 3 })).toThrow(/no llevas "amuleto_del_destino"/);
    });
  });

  describe('chequeos', () => {
    it('superado: su rama de éxito', () => {
      const r = hacerChequeo(lanzar(estadoCon(), ['chequeo']).estado, dadosTrucados([2]), EVENTOS_DE_PRUEBA);
      expect(vista(r)).toMatchObject({ modo: 'continuar', texto: 'Lo consigues' });
      expect(vista(r)!.lectura!.chequeo).toMatchObject({ caracteristica: 'fuerza', dado: 2, superado: true });
    });

    it('fallado: su rama de fallo', () => {
      const r = hacerChequeo(lanzar(estadoCon(), ['chequeo']).estado, dadosTrucados([6]), EVENTOS_DE_PRUEBA);
      expect(vista(r)!.lectura!.chequeo!.superado).toBe(false);
      expect(r.estado.jugador.vida).toBe(estadoCon().jugador.vida - 2);
    });
  });

  describe('saltar a otro evento sin volver', () => {
    it('el evento se sustituye por el nuevo: la pila no crece', () => {
      const r = continuar(lanzar(estadoCon(), ['salto']));
      expect(vista(r)).toMatchObject({ titulo: 'Sencillo', miga: ['Sencillo'] });
      expect(r.estado.mundo.pilaEventos).toHaveLength(1);
    });
  });

  describe('combates', () => {
    function terminarCombateCon(estado: Estado, resultado: 'victoria' | 'huida'): Estado {
      return { ...estado, mundo: { ...estado.mundo, combate: { ...estado.mundo.combate!, resultado } } };
    }

    it('"Luchar" empieza el combate y la ventana se aparta', () => {
      let r = lanzar(estadoCon(), ['pelea']);
      expect(vista(r)).toMatchObject({ modo: 'combate', texto: '¡Pelea!', combate: { enemigos: [{ enemigo: 'pirata' }] } });

      r = empezarCombateDelEvento(r.estado, new Dados(1), EVENTOS_DE_PRUEBA);
      expect(r.estado.mundo.combate).not.toBeNull();
      expect(vista(r)!.modo).toBe('en_combate');
    });

    it('al terminar el combate se sigue por la salida que toque (victoria)', () => {
      const enCombate = empezarCombateDelEvento(lanzar(estadoCon(), ['pelea']).estado, new Dados(1), EVENTOS_DE_PRUEBA).estado;
      const r = cerrarCombateDelEvento(terminarCombateCon(enCombate, 'victoria'), new Dados(1), EVENTOS_DE_PRUEBA);

      expect(r.estado.mundo.combate).toBeNull();
      expect(vista(r)).toMatchObject({ modo: 'continuar', texto: 'Has ganado' });
      expect(vista(r)!.lectura!.combate).toBe('victoria');
      expect(r.estado.jugador.fama).toBe(1);
    });

    it('huida: su propia salida', () => {
      const enCombate = empezarCombateDelEvento(lanzar(estadoCon(), ['pelea']).estado, new Dados(1), EVENTOS_DE_PRUEBA).estado;
      const r = cerrarCombateDelEvento(terminarCombateCon(enCombate, 'huida'), new Dados(1), EVENTOS_DE_PRUEBA);
      expect(vista(r)!.texto).toBe('Has huido');
    });

    it('no se puede cerrar el combate si el evento no espera ninguno', () => {
      expect(() => cerrarCombateDelEvento(lanzar(estadoCon(), ['sencillo']).estado, new Dados(1), EVENTOS_DE_PRUEBA)).toThrow(/no está esperando/);
    });

    it('combate naval: al ganar, la recompensa del barco y sus eventos (pendientes) tras leer el resultado', () => {
      const enCombate = empezarCombateDelEvento(lanzar(estadoCon(), ['naval']).estado, new Dados(1), EVENTOS_DE_PRUEBA).estado;
      expect(enCombate.mundo.combateNaval).not.toBeNull();
      const terminado = { ...enCombate, mundo: { ...enCombate.mundo, combateNaval: { ...enCombate.mundo.combateNaval!, resultado: 'victoria' as const } } };

      let r = cerrarCombateDelEvento(terminado, new Dados(1), EVENTOS_DE_PRUEBA);
      expect(vista(r)!.texto).toBe('Hundido');
      expect(r.estado.jugador.fama).toBe(1);

      r = continuar(r);
      expect(r.pendientes).toEqual(['amuleto_fantasmal']);
      expect(r.terminado).toBe(true);
    });

    it('combate naval: al huir salta el daño en la bodega', () => {
      const enCombate = empezarCombateDelEvento(lanzar(estadoCon(), ['naval']).estado, new Dados(1), EVENTOS_DE_PRUEBA).estado;
      const huida = { ...enCombate, mundo: { ...enCombate.mundo, combateNaval: { ...enCombate.mundo.combateNaval!, resultado: 'huida' as const } } };

      let r = cerrarCombateDelEvento(huida, new Dados(1), EVENTOS_DE_PRUEBA);
      // Primero se lee cómo acabó; el daño en la bodega llega al continuar.
      expect(vista(r)!.lectura!.combate).toBe('huida');
      expect(r.pendientes).toEqual([]);

      r = continuar(r);
      expect(r.pendientes).toEqual(['dano_en_la_bodega']);
    });
  });

  describe('eventos de una sola vez', () => {
    it('la primera vez sale y queda apuntado; la segunda ya no sale', () => {
      const r1 = continuar(lanzar(estadoCon(), ['una_vez']));
      expect(eventoYaOcurrido(r1.estado, 'una_vez', EVENTOS_DE_PRUEBA)).toBe(true);

      const r2 = lanzar(r1.estado, ['una_vez']);
      expect(r2.terminado).toBe(true);
      expect(r2.pendientes).toEqual([]);
    });

    it('una opción que lleva a él sale desactivada cuando ya ocurrió', () => {
      const r1 = continuar(lanzar(estadoCon(), ['una_vez']));
      const r2 = lanzar(r1.estado, ['hacia_una_vez']);
      expect(vista(r2)!.opciones![0]).toEqual({ texto: 'Ir', disponible: false, motivo: 'ya_ocurrio' });
    });

    it('los eventos normales sí se repiten', () => {
      const r1 = continuar(lanzar(estadoCon(), ['sencillo']));
      expect(lanzar(r1.estado, ['sencillo']).terminado).toBe(false);
    });
  });

  describe('mano de mono', () => {
    const conMano = () => estadoCon({ inventario: [{ id: 'mano_de_mono', usosRestantes: 2 }] });

    it('el evento lanzado por el juego espera: se ve su texto, pero aún no pasa nada', () => {
      const r = lanzar(conMano(), ['sencillo']);
      expect(vista(r)).toMatchObject({ modo: 'empezar', texto: 'Hola', manoDeMono: 2 });
      expect(r.estado.jugador.oro).toBe(50);
    });

    it('evitarlo gasta un uso y el evento no ocurre', () => {
      const r = evitarEvento(lanzar(conMano(), ['sencillo']).estado, new Dados(1), EVENTOS_DE_PRUEBA);
      expect(r.terminado).toBe(true);
      expect(r.estado.jugador.oro).toBe(50);
      expect(r.estado.jugador.inventario).toEqual([{ id: 'mano_de_mono', usosRestantes: 1 }]);
    });

    it('si decides seguir, el evento pasa normal', () => {
      const r = seguirConElEvento(lanzar(conMano(), ['sencillo']).estado, new Dados(1), EVENTOS_DE_PRUEBA);
      expect(r.estado.jugador.oro).toBe(60);
      expect(vista(r)!.modo).toBe('continuar');
    });

    it('los eventos encadenados ya no se pueden evitar (decidido por el autor)', () => {
      let r = seguirConElEvento(lanzar(conMano(), ['salto']).estado, new Dados(1), EVENTOS_DE_PRUEBA);
      r = continuar(r);
      expect(vista(r)).toMatchObject({ modo: 'continuar', titulo: 'Sencillo' });
    });

    it('sin la mano de mono no se puede evitar nada', () => {
      expect(() => evitarEvento(lanzar(estadoCon(), ['elegir']).estado, new Dados(1), EVENTOS_DE_PRUEBA)).toThrow(/no hay ningún evento esperando a empezar/);
    });
  });

  describe('seguridad', () => {
    it('si la partida termina, la pila se vacía', () => {
      const r = lanzar(estadoCon(), ['muerte', 'sencillo']);
      expect(r.estado.mundo.finPartida).toMatchObject({ resultado: 'derrota' });
      expect(r.estado.mundo.pilaEventos).toEqual([]);
      expect(r.terminado).toBe(true);
      expect(() => lanzar(r.estado, ['sencillo'])).toThrow(/ya ha terminado/);
    });

    it('un bucle entre eventos se detecta (más de 20 encadenados)', () => {
      expect(() => lanzar(estadoCon(), ['bucle_a'])).toThrow(/más de 20 eventos encadenados/);
    });

    it('los botones fuera de su momento dan error', () => {
      const conOpciones = lanzar(estadoCon(), ['elegir']);
      expect(() => continuar(conOpciones)).toThrow(/no hay nada que continuar/);
      expect(() => tirar(conOpciones, new Dados(1))).toThrow(/no tiene tirada/);

      const leyendo = lanzar(estadoCon(), ['sencillo']);
      expect(() => elegir(leyendo, 0)).toThrow(/no espera eso/);
    });

    it('nunca toca el estado que recibe', () => {
      const estado = congelarTodo(lanzar(estadoCon(), ['tirada']).estado);
      expect(() => tirar({ estado, cambios: [], pendientes: [], terminado: false }, dadosTrucados([5]))).not.toThrow();
    });

    it('se puede guardar a mitad de un evento y seguir exactamente donde estaba', () => {
      const r = tirar(lanzar(estadoCon(), ['tirada']), dadosTrucados([5]));
      const leido = leerPartida(guardarPartida(r.estado));
      if (!leido.ok) throw new Error('no se pudo leer');

      expect(vistaDelEvento(leido.estado, EVENTOS_DE_PRUEBA)).toEqual(vista(r));
      const despues = continuarEvento(leido.estado, new Dados(1), EVENTOS_DE_PRUEBA);
      expect(vistaDelEvento(despues.estado, EVENTOS_DE_PRUEBA)!.titulo).toBe('Sencillo');
    });
  });
});
