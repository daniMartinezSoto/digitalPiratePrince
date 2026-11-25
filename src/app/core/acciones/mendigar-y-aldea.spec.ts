import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import { comer } from '../turno/comer';
import { descansar, opcionesDeDescanso } from '../turno/descansar';
import type { Sitio } from './accion';
import { accionesDisponibles } from './acciones-disponibles';
import { mendigar } from './mendigar';

// DORMIR EN LA ALDEA (convencer a los nativos) y MENDIGAR (paso 13 del Sprint 6). Semillas comprobadas:
//   chequeo (1d6): 7 → 1 (lo supera con ingenio 3) · 1 → 4 (falla con ingenio 3).
//   mendigar (2d6): 7 → 2 · 12 → 3 · 27 → 4 · 3 → 6 · 30 → 12.
const ALDEA = { col: 10, fila: 10 };
const EN_PUERTO: Sitio = { lugar: 'puerto' };

function estadoCon(cambios: Partial<Jugador> = {}, fase: Estado['mundo']['fase'] = 'accion'): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado, jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', ingenio: 3, ...cambios }, mundo: { ...estado.mundo, fase } };
}

function artista(id: string): Seguidor {
  return { id, tipo: 'artista', nombre: id, ataque: 1, resistencia: 10, resistenciaMaxima: 10, habilidades: ['mendigar'] };
}

describe('dormir en la aldea: convencer a los nativos', () => {
  const deNoche = (cambios: Partial<Jugador> = {}) => estadoCon(cambios, 'descanso');

  it('en una aldea se puede dormir a la intemperie o intentar convencer a los nativos', () => {
    expect(opcionesDeDescanso(deNoche(), 'aldea', ALDEA).map(o => o.eleccion)).toEqual(['intemperie', 'convencer_nativos']);
    expect(opcionesDeDescanso(deNoche(), 'intemperie').map(o => o.eleccion)).toEqual(['intemperie']);
  });

  it('si supera el chequeo de Ingenio, duermen allí: sin eventos y con posibilidad de dormir genial', () => {
    const noche = descansar(deNoche(), 'convencer_nativos', 'aldea', new Dados(7), undefined, ALDEA);

    expect(noche.chequeo).toMatchObject({ caracteristica: 'ingenio', dado: 1, superado: true });
    expect(noche.echado).toBe(false);
    expect(noche.haDormidoGenial).toBeDefined();
    expect(noche.estado.mundo.marcas).toEqual([{ col: 10, fila: 10, tipo: 'nativos_convencidos' }]);
    expect(noche.amigoDeLaAldea).toBeUndefined();
  });

  it('si los convences por segunda vez en la misma aldea, te haces su amigo: desde entonces duermes allí gratis y sin chequeo', () => {
    const primera = descansar(deNoche(), 'convencer_nativos', 'aldea', new Dados(7), undefined, ALDEA);
    const segundaNoche: Estado = { ...primera.estado, mundo: { ...primera.estado.mundo, fase: 'descanso' } };
    const segunda = descansar(segundaNoche, 'convencer_nativos', 'aldea', new Dados(7), undefined, ALDEA);

    expect(segunda.amigoDeLaAldea).toBe(true);
    expect(segunda.estado.mundo.marcas).toContainEqual({ col: 10, fila: 10, tipo: 'aldea_amiga' });

    const tercera: Estado = { ...segunda.estado, mundo: { ...segunda.estado.mundo, fase: 'descanso' } };
    expect(opcionesDeDescanso(tercera, 'aldea', ALDEA)).toContainEqual({ eleccion: 'techo_todos', precio: 0, alcanzaElOro: true });
    expect(opcionesDeDescanso(tercera, 'aldea', ALDEA).map(o => o.eleccion)).not.toContain('convencer_nativos');
    const dormida = descansar(tercera, 'techo_todos', 'aldea', new Dados(1), undefined, ALDEA);
    expect(dormida.chequeo).toBeUndefined();
    expect(dormida.eventos).toEqual([]);

    // En otra aldea, nada: hay que empezar de cero.
    expect(opcionesDeDescanso(tercera, 'aldea', { col: 3, fila: 3 }).map(o => o.eleccion)).toContain('convencer_nativos');
  });

  it('solo esa noche: al día siguiente vuelve a tener las mismas dos opciones', () => {
    const noche = descansar(deNoche(), 'convencer_nativos', 'aldea', new Dados(7), undefined, ALDEA);
    const otraNoche: Estado = { ...noche.estado, mundo: { ...noche.estado.mundo, fase: 'descanso' } };

    expect(opcionesDeDescanso(otraNoche, 'aldea', ALDEA).map(o => o.eleccion)).toEqual(['intemperie', 'convencer_nativos']);
  });

  it('si falla, le echan: duerme a la intemperie (puede haber evento nocturno) y no puede volver a intentarlo aquí', () => {
    const noche = descansar(deNoche(), 'convencer_nativos', 'aldea', new Dados(1), undefined, ALDEA);
    expect(noche.chequeo?.superado).toBe(false);
    expect(noche.echado).toBe(true);
    expect(noche.haDormidoGenial).toBeUndefined();
    expect(noche.estado.mundo.marcas).toEqual([{ col: 10, fila: 10, tipo: 'echado_de_la_aldea' }]);

    const otraNoche: Estado = { ...noche.estado, mundo: { ...noche.estado.mundo, fase: 'descanso' } };
    expect(opcionesDeDescanso(otraNoche, 'aldea', ALDEA).map(o => o.eleccion)).toEqual(['intemperie']);
    expect(() => descansar(otraNoche, 'convencer_nativos', 'aldea', new Dados(7), undefined, ALDEA)).toThrow(/no se puede elegir/);
  });

  it('con la fiesta de bienvenida no hace falta convencer a nadie: solo dormir allí gratis', () => {
    const fiesta = deNoche();
    const conFiesta: Estado = { ...fiesta, mundo: { ...fiesta.mundo, nochePagada: true } };

    expect(opcionesDeDescanso(conFiesta, 'aldea', ALDEA).map(o => o.eleccion)).toEqual(['techo_todos']);
  });
});

describe('mendigar', () => {
  it('la da el artista (con dos, la misma acción); sin artista, desactivada', () => {
    const conDos = accionesDisponibles(estadoCon({ seguidores: [artista('a'), artista('b')] }), EN_PUERTO).filter(a => a.accion === 'mendigar');
    const sin = accionesDisponibles(estadoCon(), EN_PUERTO).find(a => a.accion === 'mendigar');

    expect(conDos).toEqual([{ accion: 'mendigar', disponible: true }]);
    expect(sin).toEqual({ accion: 'mendigar', disponible: false, motivo: 'sin_artista' });
  });

  it('en puertos y guaridas; en el resto, desactivada', () => {
    const conArtista = estadoCon({ seguidores: [artista('a')] });

    expect(accionesDisponibles(conArtista, { lugar: 'guarida' }).find(a => a.accion === 'mendigar')?.disponible).toBe(true);
    expect(accionesDisponibles(conArtista, { lugar: 'aldea' }).find(a => a.accion === 'mendigar')?.motivo).toBe('solo_puerto');
  });

  it('2: un guardia te pilla (evento pendiente)', () => {
    expect(mendigar(estadoCon({ seguidores: [artista('a')] }), EN_PUERTO, new Dados(7)).eventos).toEqual(['guardia']);
  });

  it('3: unos matones te quitan 1d6 de oro', () => {
    const { estado } = mendigar(estadoCon({ oro: 20, seguidores: [artista('a')] }), EN_PUERTO, new Dados(12));

    expect(estado.jugador.oro).toBeGreaterThanOrEqual(14);
    expect(estado.jugador.oro).toBeLessThan(20);
  });

  it('4-5: nadie se para a mirar', () => {
    expect(mendigar(estadoCon({ seguidores: [artista('a')] }), EN_PUERTO, new Dados(27)).cambios).toEqual([]);
  });

  it('6-8: unas monedas (1d6)', () => {
    const { estado } = mendigar(estadoCon({ oro: 20, seguidores: [artista('a')] }), EN_PUERTO, new Dados(3));

    expect(estado.jugador.oro).toBeGreaterThan(20);
    expect(estado.jugador.oro).toBeLessThanOrEqual(26);
  });

  it('12: un noble os invita a comer: 3d6 de oro y hoy coméis gratis', () => {
    const { estado } = mendigar(estadoCon({ oro: 0, comida: 2, seguidores: [artista('a')] }), EN_PUERTO, new Dados(30));
    expect(estado.jugador.oro).toBeGreaterThanOrEqual(3);
    expect(estado.mundo.comidaGratis).toBe(true);

    const comida = comer(estado, 'invitado', 'puerto', new Dados(1));
    expect(comida.estado.jugador.comida).toBe(2);
  });

  it('el contable gana su 1d6 cuando mendigar le da oro', () => {
    const { cambios } = mendigar(estadoCon({ seguidores: [artista('a')], sobrenombre: 'el_contable' }), EN_PUERTO, new Dados(3));

    expect(cambios.some(c => c.tipo === 'recurso' && c.motivo === 'contable')).toBe(true);
  });

  it('gasta el día: toca comer', () => {
    expect(mendigar(estadoCon({ seguidores: [artista('a')] }), EN_PUERTO, new Dados(27)).estado.mundo.fase).toBe('comida');
  });
});

describe('dormir en la aldea con vínculo nativo', () => {
  const deNoche = (cambios: Partial<Jugador> = {}) => estadoCon(cambios, 'descanso');

  it('con vínculo nativo, se ofrece dormir en la aldea (gratis, sin chequeo) en vez de convencer', () => {
    const nativo = deNoche({ sobrenombre: 'el_nativo' });

    expect(opcionesDeDescanso(nativo, 'aldea', ALDEA)).toEqual([
      { eleccion: 'intemperie', precio: 0, alcanzaElOro: true },
      { eleccion: 'techo_todos', precio: 0, alcanzaElOro: true },
    ]);
  });

  it('duermen allí sin chequeo, sin eventos y con posibilidad de dormir genial', () => {
    const noche = descansar(deNoche({ sobrenombre: 'el_nativo' }), 'techo_todos', 'aldea', new Dados(1), undefined, ALDEA);

    expect(noche.chequeo).toBeUndefined();
    expect(noche.eventos).toEqual([]);
    expect(noche.haDormidoGenial).toBeDefined();
    expect(noche.estado.jugador.oro).toBe(50);
  });

  it('también con el amuleto kalinago o un seguidor nativo (cualquier fuente del vínculo)', () => {
    const conAmuleto = deNoche({ inventario: [{ id: 'amuleto_kalinago' }] });

    expect(opcionesDeDescanso(conAmuleto, 'aldea', ALDEA).map(o => o.eleccion)).toEqual(['intemperie', 'techo_todos']);
  });
});

describe('protección: fuera de la fase de acción no se puede empezar ninguna acción', () => {
  it('en otra fase, todas desactivadas con "no_es_momento"', () => {
    const deNoche = estadoCon({}, 'descanso');

    expect(accionesDisponibles(deNoche, EN_PUERTO).every(a => !a.disponible && a.motivo === 'no_es_momento')).toBe(true);
  });

  it('con una acción a medias, todas desactivadas con "accion_a_medias"', () => {
    const base = estadoCon();
    const enElMercado: Estado = { ...base, mundo: { ...base.mundo, accionEnCurso: { tipo: 'mercado', rastrillo: null } } };

    expect(accionesDisponibles(enElMercado, EN_PUERTO).every(a => !a.disponible && a.motivo === 'accion_a_medias')).toBe(true);
  });

  it('con la partida terminada, también "no_es_momento"', () => {
    const base = estadoCon();
    const terminada: Estado = { ...base, mundo: { ...base.mundo, finPartida: { resultado: 'derrota', motivo: 'vida' } } };

    expect(accionesDisponibles(terminada, EN_PUERTO)[0].motivo).toBe('no_es_momento');
  });
});
