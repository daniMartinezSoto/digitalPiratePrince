import { AJUSTES } from '../ajustes/ajustes';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import { crearSeguidor } from '../seguidores/crear-seguidor';
import { obtenerListaEventos } from '../tablas/listas-eventos/cargar-listas-eventos';
import { comer } from '../turno/comer';
import { descansar } from '../turno/descansar';
import { iniciarTurno } from '../turno/iniciar-turno';
import type { Sitio } from './accion';
import { accionesDisponibles, sePuedeCazar, sePuedePescar } from './acciones-disponibles';
import { cazar } from './cazar';
import { pescar } from './pescar';
import { curaAlReposar, listaDeEventosAlReposar, reposar } from './reposar';

// Una partida en la fase de acción, con los valores del jugador que queramos.
function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return {
    ...estado,
    jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', vida: 10, vidaMax: 15, comida: 0, ...cambios },
    mundo: { ...estado.mundo, fase: 'accion' },
  };
}

const A_BORDO: Sitio = { lugar: 'barco' };
const EN_LA_JUNGLA: Sitio = { lugar: 'intemperie' };
const EN_LA_PLAYA: Sitio = { lugar: 'intemperie', juntoAlAgua: true };
const EN_UN_PUERTO: Sitio = { lugar: 'puerto', juntoAlAgua: true };

// Primera semilla con la que el primer 1d6 saca ese número (para elegir la fila de la tabla).
function semillaQueSaca(numero: number): number {
  for (let semilla = 1; semilla <= 1000; semilla++) {
    if (new Dados(semilla).tirar('1d6').total === numero) {
      return semilla;
    }
  }
  throw new Error(`Ninguna semilla saca un ${numero}`);
}

// Seguidores de verdad, del catálogo del juego.
function grupo(...tipos: string[]): Seguidor[] {
  const seguidores: Seguidor[] = [];
  for (const tipo of tipos) {
    seguidores.push(crearSeguidor(tipo, seguidores, new Dados(1)));
  }
  return seguidores;
}

describe('dónde se puede cada acción', () => {
  it('pescar: a bordo siempre; en tierra, solo junto al agua', () => {
    expect(sePuedePescar(A_BORDO)).toBe(true);
    expect(sePuedePescar(EN_LA_PLAYA)).toBe(true);
    expect(sePuedePescar(EN_UN_PUERTO)).toBe(true);
    expect(sePuedePescar(EN_LA_JUNGLA)).toBe(false);
  });

  it('cazar: solo en tierra salvaje', () => {
    expect(sePuedeCazar(EN_LA_JUNGLA)).toBe(true);
    expect(sePuedeCazar(EN_LA_PLAYA)).toBe(true);
    expect(sePuedeCazar(A_BORDO)).toBe(false);
    expect(sePuedeCazar(EN_UN_PUERTO)).toBe(false);
    expect(sePuedeCazar({ lugar: 'aldea' })).toBe(false);
    expect(sePuedeCazar({ lugar: 'monasterio' })).toBe(false);
  });

  it('accionesDisponibles: a bordo se puede pescar y reposar; cazar sale desactivada con su motivo', () => {
    expect(accionesDisponibles(estadoCon(), A_BORDO)).toEqual([
      { accion: 'pescar', disponible: true },
      { accion: 'cazar', disponible: false, motivo: 'solo_salvaje' },
      { accion: 'reposar', disponible: true },
      { accion: 'ir_al_mercado', disponible: false, motivo: 'solo_puerto' },
      { accion: 'dar_discurso', disponible: false, motivo: 'solo_puerto' },
      { accion: 'contratar_marineros', disponible: false, motivo: 'solo_puerto' },
      { accion: 'buscar_seguidor', disponible: false, motivo: 'solo_puerto' },
      { accion: 'rezar', disponible: false, motivo: 'solo_monasterio' },
      { accion: 'descansar_en_monasterio', disponible: false, motivo: 'solo_monasterio' },
      { accion: 'enterrar_tesoro', disponible: false, motivo: 'solo_salvaje' },
      { accion: 'buscar_informacion', disponible: false, motivo: 'solo_puerto_o_aldea' },
      { accion: 'solicitar_audiencia', disponible: false, motivo: 'solo_puerto_aldea_o_guarida' },
      { accion: 'jugar_a_los_dados', disponible: false, motivo: 'solo_guarida' },
      { accion: 'echar_un_pulso', disponible: false, motivo: 'solo_guarida' },
    ]);
  });

  it('accionesDisponibles: en la jungla, lejos del agua, se puede cazar pero no pescar', () => {
    expect(accionesDisponibles(estadoCon(), EN_LA_JUNGLA)).toEqual([
      { accion: 'pescar', disponible: false, motivo: 'sin_agua' },
      { accion: 'cazar', disponible: true },
      { accion: 'reposar', disponible: true },
      { accion: 'ir_al_mercado', disponible: false, motivo: 'solo_puerto' },
      { accion: 'dar_discurso', disponible: false, motivo: 'solo_puerto' },
      { accion: 'contratar_marineros', disponible: false, motivo: 'solo_puerto' },
      { accion: 'buscar_seguidor', disponible: false, motivo: 'solo_puerto' },
      { accion: 'rezar', disponible: false, motivo: 'solo_monasterio' },
      { accion: 'descansar_en_monasterio', disponible: false, motivo: 'solo_monasterio' },
      { accion: 'enterrar_tesoro', disponible: false, motivo: 'sin_oro' }, // en la jungla sí, pero tiene 50 de oro
      { accion: 'buscar_informacion', disponible: false, motivo: 'solo_puerto_o_aldea' },
      { accion: 'solicitar_audiencia', disponible: false, motivo: 'solo_puerto_aldea_o_guarida' },
      { accion: 'jugar_a_los_dados', disponible: false, motivo: 'solo_guarida' },
      { accion: 'echar_un_pulso', disponible: false, motivo: 'solo_guarida' },
    ]);
  });

  it('accionesDisponibles: en la playa se pueden pescar, cazar y reposar (el mercado, no)', () => {
    const disponibles = accionesDisponibles(estadoCon(), EN_LA_PLAYA).filter(a => a.disponible).map(a => a.accion);
    expect(disponibles).toEqual(['pescar', 'cazar', 'reposar']);
  });
});

describe('el molde de las acciones', () => {
  const acciones = [
    { nombre: 'pescar', hacer: (estado: Estado, dados: Dados) => pescar(estado, EN_LA_PLAYA, dados) },
    { nombre: 'cazar', hacer: (estado: Estado, dados: Dados) => cazar(estado, EN_LA_PLAYA, dados) },
    { nombre: 'reposar', hacer: (estado: Estado, dados: Dados) => reposar(estado, EN_LA_PLAYA, dados) },
  ];

  for (const { nombre, hacer } of acciones) {
    it(`${nombre}: deja la partida en la fase de comida`, () => {
      expect(hacer(estadoCon(), new Dados(1)).estado.mundo.fase).toBe('comida');
    });

    it(`${nombre}: no cambia el día`, () => {
      expect(hacer(estadoCon(), new Dados(1)).estado.mundo.dia).toBe(estadoCon().mundo.dia);
    });

    it(`${nombre}: no modifica el estado que recibe`, () => {
      const estado = estadoCon();
      const copia = structuredClone(estado);
      hacer(estado, new Dados(1));
      expect(estado).toEqual(copia);
    });

    it(`${nombre}: apunta en el estado por dónde van los dados`, () => {
      const dados = new Dados(7);
      expect(hacer(estadoCon(), dados).estado.mundo.estadoDados).toBe(dados.obtenerEstado());
    });

    it(`${nombre}: solo se puede en la fase de acción`, () => {
      const enComida: Estado = { ...estadoCon(), mundo: { ...estadoCon().mundo, fase: 'comida' } };
      expect(() => hacer(enComida, new Dados(1))).toThrow(/solo se puede hacer en la fase "accion".*"comida"/);
    });

    it(`${nombre}: no se puede con la partida terminada`, () => {
      const terminada: Estado = { ...estadoCon(), mundo: { ...estadoCon().mundo, finPartida: { resultado: 'derrota', motivo: 'vida' } } };
      expect(() => hacer(terminada, new Dados(1))).toThrow(/ya ha terminado/);
    });

    it(`${nombre}: con la misma semilla pasa lo mismo`, () => {
      expect(hacer(estadoCon(), new Dados(42))).toEqual(hacer(estadoCon(), new Dados(42)));
    });
  }
});

describe('pescar', () => {
  it('con un 1 no pesca nada', () => {
    const r = pescar(estadoCon(), A_BORDO, new Dados(semillaQueSaca(1)));

    expect(r.estado.jugador.comida).toBe(0);
    expect(r.cambios).toEqual([]);
    expect(r.tirada).toEqual({ dados: [1], modificador: 0, total: 1, texto: 'No pescas nada.' });
  });

  it('con 2-3 pesca 3 reservas; con 4-5, 5; con 6, 7', () => {
    const reservas = [2, 3, 4, 5, 6].map(n => pescar(estadoCon(), A_BORDO, new Dados(semillaQueSaca(n))).estado.jugador.comida);

    expect(reservas).toEqual([3, 3, 5, 5, 7]);
  });

  it('el chivato cuenta la comida ganada', () => {
    const r = pescar(estadoCon({ comida: 1 }), A_BORDO, new Dados(semillaQueSaca(4)));

    expect(r.cambios).toEqual([{ tipo: 'recurso', recurso: 'comida', antes: 1, despues: 6 }]);
  });

  it('la comida no pasa del máximo', () => {
    const r = pescar(estadoCon({ comida: AJUSTES.comidaMaxima - 1 }), A_BORDO, new Dados(semillaQueSaca(6)));

    expect(r.estado.jugador.comida).toBe(AJUSTES.comidaMaxima);
  });

  it('se puede pescar desde la orilla', () => {
    expect(pescar(estadoCon(), EN_LA_PLAYA, new Dados(semillaQueSaca(6))).estado.jugador.comida).toBe(7);
  });

  it('lejos del agua no se puede: es un error', () => {
    expect(() => pescar(estadoCon(), EN_LA_JUNGLA, new Dados(1))).toThrow(/aquí no se puede pescar/);
  });

  it('gasta un solo dado', () => {
    const dados = new Dados(5);
    const testigo = new Dados(5);
    pescar(estadoCon(), A_BORDO, dados);
    testigo.tirar('1d6');
    expect(dados.obtenerEstado()).toBe(testigo.obtenerEstado());
  });

  describe('con un pescador en el grupo', () => {
    const conPescador = () => estadoCon({ seguidores: grupo('pescador') });

    it('si pesca algo, 1 reserva más', () => {
      const reservas = [2, 4, 6].map(n => pescar(conPescador(), A_BORDO, new Dados(semillaQueSaca(n))).estado.jugador.comida);

      expect(reservas).toEqual([4, 6, 8]);
    });

    it('si no pesca nada, el pescador no da nada', () => {
      expect(pescar(conPescador(), A_BORDO, new Dados(semillaQueSaca(1))).estado.jugador.comida).toBe(0);
    });

    it('sale como un solo cambio (no dos)', () => {
      const r = pescar(conPescador(), A_BORDO, new Dados(semillaQueSaca(2)));

      expect(r.cambios).toEqual([{ tipo: 'recurso', recurso: 'comida', antes: 0, despues: 4 }]);
    });

    it('dos pescadores dan 2 reservas más (todo suma)', () => {
      const r = pescar(estadoCon({ seguidores: grupo('pescador', 'pescador') }), A_BORDO, new Dados(semillaQueSaca(2)));

      expect(r.estado.jugador.comida).toBe(5);
    });

    it('otro seguidor (un forzudo) no ayuda a pescar', () => {
      const r = pescar(estadoCon({ seguidores: grupo('forzudo') }), A_BORDO, new Dados(semillaQueSaca(2)));

      expect(r.estado.jugador.comida).toBe(3);
    });
  });
});

describe('cazar', () => {
  it('con un 1 no caza nada', () => {
    const r = cazar(estadoCon(), EN_LA_JUNGLA, new Dados(semillaQueSaca(1)));

    expect(r.estado.jugador.comida).toBe(0);
    expect(r.estado.jugador.vida).toBe(10);
    expect(r.cambios).toEqual([]);
  });

  it('con 2-3 caza 4 reservas pero se hiere: -1 PV', () => {
    for (const n of [2, 3]) {
      const r = cazar(estadoCon(), EN_LA_JUNGLA, new Dados(semillaQueSaca(n)));

      expect(r.estado.jugador.comida).toBe(4);
      expect(r.estado.jugador.vida).toBe(9);
    }
  });

  it('con 4-5 caza 5 reservas y con 6, 8, sin herirse', () => {
    const resultados = [4, 5, 6].map(n => cazar(estadoCon(), EN_LA_JUNGLA, new Dados(semillaQueSaca(n))).estado.jugador);

    expect(resultados.map(j => j.comida)).toEqual([5, 5, 8]);
    expect(resultados.map(j => j.vida)).toEqual([10, 10, 10]);
  });

  it('enseña la tirada', () => {
    const r = cazar(estadoCon(), EN_LA_JUNGLA, new Dados(semillaQueSaca(6)));

    expect(r.tirada).toEqual({ dados: [6], modificador: 0, total: 6, texto: '¡Gran pieza!' });
  });

  it('cazar con 1 PV puede costar la partida', () => {
    const r = cazar(estadoCon({ vida: 1 }), EN_LA_JUNGLA, new Dados(semillaQueSaca(2)));

    expect(r.estado.mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'vida' });
  });

  it('el pescador no ayuda a cazar', () => {
    const r = cazar(estadoCon({ seguidores: grupo('pescador') }), EN_LA_JUNGLA, new Dados(semillaQueSaca(4)));

    expect(r.estado.jugador.comida).toBe(5);
  });

  it('a bordo, en un puerto, en una aldea o en un monasterio no se puede: es un error', () => {
    for (const sitio of [A_BORDO, EN_UN_PUERTO, { lugar: 'aldea' }, { lugar: 'monasterio' }] as Sitio[]) {
      expect(() => cazar(estadoCon(), sitio, new Dados(1))).toThrow(/aquí no se puede cazar/);
    }
  });
});

describe('reposar (la acción de pasar el día recuperándose)', () => {
  // Un seguidor herido (5 de 10).
  const herido = (id: string): Seguidor => ({ id, tipo: 'forzudo', nombre: id, ataque: 2, resistencia: 5, resistenciaMaxima: 10, habilidades: [] });

  describe('curación', () => {
    it(`cura ${AJUSTES.curaAlReposar} PV al jugador y a cada seguidor`, () => {
      const r = reposar(estadoCon({ seguidores: [herido('a'), herido('b')] }), EN_UN_PUERTO, new Dados(1));

      expect(r.estado.jugador.vida).toBe(10 + AJUSTES.curaAlReposar);
      expect(r.estado.jugador.seguidores.map(s => s.resistencia)).toEqual([5 + AJUSTES.curaAlReposar, 5 + AJUSTES.curaAlReposar]);
    });

    it('no cura por encima del máximo', () => {
      const r = reposar(estadoCon({ vida: 14 }), EN_UN_PUERTO, new Dados(1));

      expect(r.estado.jugador.vida).toBe(15);
    });

    it('si está sano, reposar no cambia nada (sirve para dejar pasar el día)', () => {
      const r = reposar(estadoCon({ vida: 15 }), EN_UN_PUERTO, new Dados(1));

      expect(r.cambios).toEqual([]);
      expect(r.estado.mundo.fase).toBe('comida');
    });

    it('con un barbero-cirujano, 1 PV más para todos', () => {
      const estado = estadoCon({ seguidores: [...grupo('barbero_cirujano'), herido('a')] });

      expect(curaAlReposar(estado)).toBe(AJUSTES.curaAlReposar + 1);
      const r = reposar(estado, EN_UN_PUERTO, new Dados(1));
      expect(r.estado.jugador.vida).toBe(10 + AJUSTES.curaAlReposar + 1);
      expect(r.estado.jugador.seguidores[1].resistencia).toBe(5 + AJUSTES.curaAlReposar + 1);
    });

    it('con dos barberos-cirujanos, 2 PV más (todo suma)', () => {
      expect(curaAlReposar(estadoCon({ seguidores: grupo('barbero_cirujano', 'barbero_cirujano') }))).toBe(AJUSTES.curaAlReposar + 2);
    });

    it('el barbero-cirujano NO da su punto extra durmiendo por la noche: solo con la acción', () => {
      const deNoche: Estado = { ...estadoCon({ seguidores: grupo('barbero_cirujano') }), mundo: { ...estadoCon().mundo, fase: 'descanso' } };

      for (let semilla = 1; semilla <= 50; semilla++) {
        expect(descansar(deNoche, 'a_bordo', 'barco', new Dados(semilla)).estado.jugador.vida).toBeLessThanOrEqual(11);
      }
    });
  });

  describe('el riesgo: puede pasar algo mientras reposas', () => {
    // Repite la acción con muchas semillas y devuelve los eventos que han saltado.
    function eventosEn(sitio: Sitio): string[] {
      const eventos: string[] = [];
      for (let semilla = 1; semilla <= 1000; semilla++) {
        eventos.push(...reposar(estadoCon(), sitio, new Dados(semilla)).eventos);
      }
      return eventos;
    }

    it('a bordo: salta un evento más o menos el porcentaje de AJUSTES.probabilidadEventoAlReposar', () => {
      const veces = eventosEn(A_BORDO).length;
      const esperadas = AJUSTES.probabilidadEventoAlReposar * 10;

      expect(veces).toBeGreaterThan(esperadas - 70);
      expect(veces).toBeLessThan(esperadas + 70);
    });

    it('a bordo: los eventos salen de la lista "descuido a bordo"', () => {
      const posibles = obtenerListaEventos('descuido_a_bordo').eventos.map(e => e.evento);

      for (const evento of eventosEn(A_BORDO)) {
        expect(posibles).toContain(evento);
      }
    });

    it('a la intemperie: los eventos salen de la lista de eventos nocturnos', () => {
      const posibles = obtenerListaEventos('nocturnos').eventos.map(e => e.evento);
      const eventos = eventosEn(EN_LA_JUNGLA);

      expect(eventos.length).toBeGreaterThan(0);
      for (const evento of eventos) {
        expect(posibles).toContain(evento);
      }
    });

    it('en un puerto, una aldea o un monasterio no pasa nada: se reposa tranquilo', () => {
      for (const lugar of ['puerto', 'aldea', 'monasterio'] as const) {
        expect(eventosEn({ lugar })).toEqual([]);
        expect(listaDeEventosAlReposar(lugar)).toBeNull();
      }
    });

    it('en un sitio seguro no se gasta ningún dado', () => {
      const dados = new Dados(3);
      const estadoInicial = dados.obtenerEstado();
      reposar(estadoCon(), EN_UN_PUERTO, dados);
      expect(dados.obtenerEstado()).toBe(estadoInicial);
    });

    it('aunque salte un evento, la curación se aplica igual', () => {
      for (let semilla = 1; semilla <= 200; semilla++) {
        expect(reposar(estadoCon(), A_BORDO, new Dados(semilla)).estado.jugador.vida).toBe(10 + AJUSTES.curaAlReposar);
      }
    });

    it('como mucho salta un evento cada vez que se reposa', () => {
      for (let semilla = 1; semilla <= 200; semilla++) {
        expect(reposar(estadoCon(), A_BORDO, new Dados(semilla)).eventos.length).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe('días completos, ya con la acción de verdad', () => {
  it('amanecer, pescar, comer y dormir: empieza el día siguiente', () => {
    const { estado: inicial, dados } = crearPartida(2024, 'Marta');

    const amanecer = iniciarTurno(inicial, dados);
    expect(amanecer.estado.mundo.fase).toBe('accion');

    const pesca = pescar(amanecer.estado, A_BORDO, dados);
    expect(pesca.estado.mundo.fase).toBe('comida');

    const comida = comer(pesca.estado, 'reservas', 'barco', dados);
    expect(comida.haComido).toBe(true);
    expect(comida.estado.mundo.fase).toBe('descanso');

    const noche = descansar(comida.estado, 'a_bordo', 'barco', dados);
    expect(noche.estado.mundo).toMatchObject({ dia: 2, fase: 'inicio' });
  });

  it('un mes en el mar viviendo de la pesca: se sobrevive, y el estado sigue siendo solo datos', () => {
    const { estado: inicial } = crearPartida(7, 'Marta');
    const dados = new Dados(inicial.mundo.estadoDados);
    let estado = inicial;
    let diasConHambre = 0;

    for (let dia = 1; dia <= 30 && !estado.mundo.finPartida; dia++) {
      estado = iniciarTurno(estado, dados).estado;
      if (estado.mundo.fase === 'accion') {
        // Pesca cuando le quedan 2 reservas o menos; si no, reposa.
        estado = (estado.jugador.comida <= 2 ? pescar(estado, A_BORDO, dados) : reposar(estado, A_BORDO, dados)).estado;
      }
      const comida = comer(estado, 'reservas', 'barco', dados);
      diasConHambre += comida.haComido ? 0 : 1;
      estado = comida.estado;
      if (!estado.mundo.finPartida) {
        estado = descansar(estado, 'a_bordo', 'barco', dados).estado;
      }
    }

    expect(estado.mundo.finPartida).toBeNull();
    expect(estado.mundo.dia).toBe(31);
    expect(estado.jugador.comida).toBeLessThanOrEqual(AJUSTES.comidaMaxima);
    expect(diasConHambre).toBeLessThan(10);
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
  });
});
