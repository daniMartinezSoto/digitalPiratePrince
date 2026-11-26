import { contratarMarineros, darDiscurso } from '../contratar/contratar';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import { obtenerTabla } from '../tablas/rangos/cargar-tablas';
import { validarTabla } from '../tablas/rangos/validar-tabla';
import { comer, opcionesDeComida } from '../turno/comer';
import { descansar, opcionesDeDescanso } from '../turno/descansar';
import type { Sitio } from './accion';
import { accionesDisponibles } from './acciones-disponibles';
import { buscarInformacion, opcionesDeBuscarInformacion } from './buscar-informacion';

// BUSCAR INFORMACIÓN (paso 10 del Sprint 6). Semillas comprobadas: el primer dado que se tira es el 3d6
// de la tabla, y con "el fuerte" no hay bonificadores. Total que sale con cada semilla:
//   146 → 3 · 66 → 4 · 27 → 5 · 19 → 6 · 8 → 7 · 1 → 9 · 25 → 13 · 36 → 14 · 10 → 15 · 749 → 18.
// Después del 3d6, el mono: con la semilla 1 saca un 6; con la 3, un 1 (y la multa, un 5).
const SALE = { 3: 146, 4: 66, 5: 27, 6: 19, 7: 8, 9: 1, 13: 25, 14: 36, 15: 10, 18: 749 } as const;

const EN_PUERTO: Sitio = { lugar: 'puerto', hex: { col: 6, fila: 2 } };
const OTRO_PUERTO: Sitio = { lugar: 'puerto', hex: { col: 20, fila: 9 } };
const EN_ALDEA: Sitio = { lugar: 'aldea', hex: { col: 10, fila: 10 } };

/** Partida de "el fuerte" (sin bonificadores a esta tirada) en la fase de acción. */
function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado, jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', ...cambios }, mundo: { ...estado.mundo, fase: 'accion' } };
}

/** El mismo estado, días después, otra vez en la fase de acción. */
function diasDespues(estado: Estado, dias: number): Estado {
  return { ...estado, mundo: { ...estado.mundo, dia: estado.mundo.dia + dias, fase: 'accion' } };
}

function mono(id: string): Seguidor {
  return { id, tipo: 'mono', nombre: id, ataque: 0, resistencia: 3, resistenciaMaxima: 3, habilidades: ['manos_largas'] };
}

const disponibilidad = (estado: Estado, sitio: Sitio) => accionesDisponibles(estado, sitio).find(a => a.accion === 'buscar_informacion');

describe('dónde y cuándo', () => {
  it('en puertos y aldeas; en el resto sale desactivada', () => {
    expect(disponibilidad(estadoCon(), EN_PUERTO)?.disponible).toBe(true);
    expect(disponibilidad(estadoCon(), EN_ALDEA)?.disponible).toBe(true);
    expect(disponibilidad(estadoCon(), { lugar: 'barco' })).toEqual({ accion: 'buscar_informacion', disponible: false, motivo: 'solo_puerto_o_aldea' });
  });

  it('cada dos días: al día siguiente sale desactivada ("falta 1 día"), en cualquier sitio; al otro, se puede', () => {
    const tras = buscarInformacion(estadoCon(), EN_PUERTO, 0, new Dados(SALE[4])).estado;

    expect(tras.mundo.ultimaBusquedaInformacion).toBe(1);
    expect(disponibilidad(diasDespues(tras, 1), OTRO_PUERTO)).toEqual({ accion: 'buscar_informacion', disponible: false, motivo: 'espera', faltanDias: 1 });
    expect(disponibilidad(diasDespues(tras, 2), EN_PUERTO)?.disponible).toBe(true);
    expect(() => buscarInformacion(diasDespues(tras, 1), EN_PUERTO, 0, new Dados(1))).toThrow(/espera/);
  });

  it('termina la acción: toca comer', () => {
    expect(buscarInformacion(estadoCon(), EN_PUERTO, 0, new Dados(SALE[4])).estado.mundo.fase).toBe('comida');
  });
});

describe('sobornos (solo en puertos)', () => {
  it('opciones: sobornar 10, 20 o 30, desactivados los que no puede pagar', () => {
    expect(opcionesDeBuscarInformacion(estadoCon({ oro: 25 }), EN_PUERTO)).toEqual({
      sobornos: [
        { cantidad: 1, precio: 10, disponible: true },
        { cantidad: 2, precio: 20, disponible: true },
        { cantidad: 3, precio: 30, disponible: false },
      ],
      amigos: false,
    });
  });

  it('en aldeas no hay sobornos, y pedirlos da error', () => {
    expect(opcionesDeBuscarInformacion(estadoCon(), EN_ALDEA).sobornos).toEqual([]);
    expect(() => buscarInformacion(estadoCon(), EN_ALDEA, 1, new Dados(1))).toThrow(/solo se puede sobornar en los puertos/);
  });

  it('cada soborno cuesta 10 y da +1 a la tirada', () => {
    const { estado, tirada } = buscarInformacion(estadoCon({ oro: 50 }), EN_PUERTO, 3, new Dados(SALE[4]));

    expect(tirada?.modificador).toBe(3);
    expect(tirada?.total).toBe(7);
    expect(estado.jugador.oro).toBe(20);
  });

  it('error si no le llega el oro o pide más de 3', () => {
    expect(() => buscarInformacion(estadoCon({ oro: 15 }), EN_PUERTO, 2, new Dados(1))).toThrow(/cuestan 20/);
    expect(() => buscarInformacion(estadoCon({ oro: 100 }), EN_PUERTO, 4, new Dados(1))).toThrow(/no válidos/);
  });

  it('el influyente tiene +1 en puertos', () => {
    const { tirada } = buscarInformacion(estadoCon({ sobrenombre: 'el_influyente' }), EN_PUERTO, 0, new Dados(SALE[4]));

    expect(tirada?.modificador).toBe(1);
  });
});

describe('la tabla de puertos', () => {
  it('3: te roban la mitad del oro', () => {
    const { estado } = buscarInformacion(estadoCon({ oro: 51 }), EN_PUERTO, 0, new Dados(SALE[3]));

    expect(estado.jugador.oro).toBe(25);
  });

  it('5, haces amigos: +1 la próxima vez que busques información aquí, y se gasta', () => {
    const tras = buscarInformacion(estadoCon(), EN_PUERTO, 0, new Dados(SALE[5])).estado;
    expect(tras.mundo.marcas).toEqual([{ col: 6, fila: 2, tipo: 'amigos' }]);
    expect(opcionesDeBuscarInformacion(diasDespues(tras, 2), EN_PUERTO).amigos).toBe(true);
    expect(opcionesDeBuscarInformacion(diasDespues(tras, 2), OTRO_PUERTO).amigos).toBe(false);

    const otraVez = buscarInformacion(diasDespues(tras, 2), EN_PUERTO, 0, new Dados(SALE[3])); // 3 + 1 = 4: no pasa nada
    expect(otraVez.tirada?.modificador).toBe(1);
    expect(otraVez.tirada?.total).toBe(4);
    expect(otraVez.estado.mundo.marcas).toEqual([]);
  });

  it('5, haces amigos: también vale +1 para dar un discurso aquí, y se gasta', () => {
    const tras = buscarInformacion(estadoCon(), EN_PUERTO, 0, new Dados(SALE[5])).estado;
    const discurso = darDiscurso(diasDespues(tras, 1), EN_PUERTO, new Dados(1));

    expect(discurso.tirada?.modificador).toBe(1);
    expect(discurso.estado.mundo.marcas).toEqual([]);
  });

  it('los amigos no valen para contratar marineros (no hay tirada) ni se gastan con eso', () => {
    const tras = buscarInformacion(estadoCon({ tripulacion: 30 }), EN_PUERTO, 0, new Dados(SALE[5])).estado;
    const marineros = contratarMarineros(diasDespues(tras, 1), EN_PUERTO, new Dados(1));

    expect(marineros.estado.mundo.marcas).toEqual([{ col: 6, fila: 2, tipo: 'amigos' }]);
  });

  it('6, el cubil: +50 de oro la primera vez; la segunda vez en la misma casilla está vacío', () => {
    const primera = buscarInformacion(estadoCon({ oro: 10 }), EN_PUERTO, 0, new Dados(SALE[6]));
    expect(primera.estado.jugador.oro).toBe(60);
    expect(primera.estado.mundo.marcas).toEqual([{ col: 6, fila: 2, tipo: 'cubil_saqueado' }]);

    const segunda = buscarInformacion(diasDespues(primera.estado, 2), EN_PUERTO, 0, new Dados(SALE[6]));
    expect(segunda.estado.jugador.oro).toBe(60);
    expect(segunda.tirada?.texto).toBe('El cubil ya está vacío.');

    const enOtroPuerto = buscarInformacion(diasDespues(primera.estado, 2), OTRO_PUERTO, 0, new Dados(SALE[6]));
    expect(enOtroPuerto.estado.jugador.oro).toBe(110);
  });

  it('9-12: la taberna clandestina queda como evento pendiente', () => {
    expect(buscarInformacion(estadoCon(), EN_PUERTO, 0, new Dados(SALE[9])).eventos).toEqual(['taberna_clandestina']);
  });
});

describe('el mono (manos largas, solo en puertos)', () => {
  it('con 2-6 trae ese oro', () => {
    const { estado, manosLargas } = buscarInformacion(estadoCon({ oro: 10, seguidores: [mono('mono_1')] }), EN_PUERTO, 0, new Dados(1));

    expect(manosLargas).toEqual([{ seguidor: 'mono_1', dado: 6 }]);
    expect(estado.jugador.oro).toBe(16);
  });

  it('con un 1 lo pillan y pagas 1d6 de multa', () => {
    const { estado, manosLargas } = buscarInformacion(estadoCon({ oro: 10, seguidores: [mono('mono_1')] }), EN_PUERTO, 0, new Dados(3));

    expect(manosLargas).toEqual([{ seguidor: 'mono_1', dado: 1, multa: 5 }]);
    expect(estado.jugador.oro).toBe(5);
  });

  it('con dos monos, dos tiradas', () => {
    const { manosLargas } = buscarInformacion(estadoCon({ seguidores: [mono('mono_1'), mono('mono_2')] }), EN_PUERTO, 0, new Dados(1));

    expect(manosLargas.map(r => r.seguidor)).toEqual(['mono_1', 'mono_2']);
  });

  it('en una aldea el mono no roba', () => {
    expect(buscarInformacion(estadoCon({ seguidores: [mono('mono_1')] }), EN_ALDEA, 0, new Dados(1)).manosLargas).toEqual([]);
  });
});

describe('la tabla de aldeas', () => {
  it('la tabla está bien escrita y va del 3 al 18', () => {
    const tabla = obtenerTabla('buscar_informacion_aldea');

    expect(validarTabla(tabla)).toEqual([]);
    expect(tabla.dado).toBe('3d6');
  });

  it('el nativo tiene +1 en aldeas', () => {
    const { tirada } = buscarInformacion(estadoCon({ sobrenombre: 'el_nativo' }), EN_ALDEA, 0, new Dados(SALE[4]));

    expect(tirada?.modificador).toBe(1);
  });

  it('3-4: tabú sagrado (evento pendiente)', () => {
    expect(buscarInformacion(estadoCon(), EN_ALDEA, 0, new Dados(SALE[3])).eventos).toEqual(['tabu_sagrado']);
  });

  it('7: el niño curioso deja amigos en la aldea', () => {
    expect(buscarInformacion(estadoCon(), EN_ALDEA, 0, new Dados(SALE[7])).estado.mundo.marcas).toEqual([{ col: 10, fila: 10, tipo: 'amigos' }]);
  });

  it('9: la curandera os cura 1d6 a todos (una tirada)', () => {
    const herido: Seguidor = { ...mono('a'), resistencia: 1 };
    const { estado, cambios } = buscarInformacion(estadoCon({ vida: 5, seguidores: [herido] }), EN_ALDEA, 0, new Dados(SALE[9]));
    const curado = estado.jugador.vida - 5;

    expect(curado).toBeGreaterThanOrEqual(1);
    expect(cambios.some(c => c.tipo === 'resistencia_seguidor')).toBe(true);
  });

  it('12-13: fiesta de bienvenida: hoy come gratis y esta noche duerme en la aldea gratis y sin eventos', () => {
    const { estado } = buscarInformacion(estadoCon({ comida: 3 }), EN_ALDEA, 0, new Dados(SALE[13]));
    expect(estado.mundo.comidaGratis).toBe(true);
    expect(opcionesDeComida(estado, 'aldea').invitado).toBe(true);

    const comida = comer(estado, 'invitado', 'aldea', new Dados(1));
    expect(comida.haComido).toBe(true);
    expect(comida.estado.jugador.comida).toBe(3);

    expect(opcionesDeDescanso(comida.estado, 'aldea')).toEqual([{ eleccion: 'techo_todos', precio: 0, alcanzaElOro: true }]);
    const noche = descansar(comida.estado, 'techo_todos', 'aldea', new Dados(1));
    expect(noche.eventos).toEqual([]);
    expect(noche.haDormidoGenial).toBeDefined();
    expect(noche.estado.mundo).toMatchObject({ comidaGratis: false, nochePagada: false, dia: 2 });
  });

  it('sin fiesta, "invitado" no se puede elegir', () => {
    const { estado } = crearPartida(1, 'Prueba');
    const deComida: Estado = { ...estado, mundo: { ...estado.mundo, fase: 'comida' } };

    expect(() => comer(deComida, 'invitado', 'aldea', new Dados(1))).toThrow(/no le invitan/);
  });

  it('14: el chamán te quita la maldición más antigua y te da un ungüento curativo', () => {
    const malditos = { condiciones: [{ id: 'el_mal' }, { id: 'amuleto_maldito', partes: ['fuerza_letal', 'avaricioso'] }] };
    const { estado } = buscarInformacion(estadoCon(malditos), EN_ALDEA, 0, new Dados(SALE[14]));

    expect(estado.jugador.condiciones.map(c => c.id)).toEqual(['amuleto_maldito']);
    expect(estado.jugador.inventario).toEqual([{ id: 'unguento', usosRestantes: 1 }]);
  });

  it('15: un joven guerrero nativo quiere unirse (su evento pregunta y deja hacerle sitio)', () => {
    const { estado, eventos } = buscarInformacion(estadoCon(), EN_ALDEA, 0, new Dados(SALE[15]));
    expect(estado.jugador.seguidores).toEqual([]);
    expect(eventos).toEqual(['joven_guerrero']);
  });

  it('18: te confunden con su dios: +1 de fama y audiencia con el jefe (evento pendiente)', () => {
    const { estado, eventos } = buscarInformacion(estadoCon(), EN_ALDEA, 0, new Dados(SALE[18]));

    expect(estado.jugador.fama).toBe(1);
    expect(eventos).toEqual(['audiencia_jefe_aldea']);
  });
});
