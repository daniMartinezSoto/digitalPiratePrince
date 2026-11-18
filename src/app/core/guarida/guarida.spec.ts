import type { Sitio } from '../acciones/accion';
import { accionesDisponibles } from '../acciones/acciones-disponibles';
import { pescar } from '../acciones/pescar';
import { chequeo } from '../chequeos/chequeo';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import { crearPartida } from '../partida/crear-partida';
import { opcionesDeApuesta } from './apuestas';
import { apostarALosDados, levantarseDeLaMesa, sentarseALosDados } from './dados';
import { echarUnPulso, rivalDePulso } from './pulso';

// JUGAR A LOS DADOS y ECHAR UN PULSO en la guarida pirata (paso 11b del Sprint 6), y el chequeo.
// Semillas comprobadas:
//   dados (tuyo, suyo): 1 → 4 contra 1 (ganas) · 8 → 1 contra 4 (pierdes) · 5 → empate a 5 y se vuelve a tirar.
//   pulso (dado del rival, dado del chequeo): 2 → campeón, 2 · 5 → campeón, 5 · 8 → borracho, 4 · 11 → parroquiano, 4.
const EN_GUARIDA: Sitio = { lugar: 'guarida', hex: { col: 15, fila: 3 } };
const OTRA_GUARIDA: Sitio = { lugar: 'guarida', hex: { col: 2, fila: 18 } };

/** Partida de "el fuerte" (fuerza 3 para que las cuentas sean claras) en la fase de acción. */
function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado, jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', fuerza: 3, ...cambios }, mundo: { ...estado.mundo, fase: 'accion' } };
}

function otroDia(estado: Estado): Estado {
  return { ...estado, mundo: { ...estado.mundo, dia: estado.mundo.dia + 1, fase: 'accion' } };
}

describe('chequeo de Fuerza o Ingenio', () => {
  it('1d6 ≤ característica; el modificador se suma al dado', () => {
    const resultado = chequeo(estadoCon({ fuerza: 3 }).jugador, 'fuerza', 1, new Dados(2)); // dado 5

    expect(resultado).toEqual({ caracteristica: 'fuerza', valor: 3, dado: 5, modificador: 1, total: 6, superado: false });
  });

  it('usa la característica actual (con las bendiciones del amuleto)', () => {
    const conAmuleto = estadoCon({ ingenio: 2, condiciones: [{ id: 'amuleto_maldito', partes: ['super_cerebro', 'manos_torpes'] }] });

    expect(chequeo(conAmuleto.jugador, 'ingenio', 0, new Dados(1)).valor).toBe(4);
  });
});

describe('apuestas', () => {
  it('botones 10, 25, 50, 100 o todo; desactivados los que no puede pagar', () => {
    expect(opcionesDeApuesta(estadoCon({ oro: 60 }))).toEqual([
      { apuesta: 10, cantidad: 10, disponible: true },
      { apuesta: 25, cantidad: 25, disponible: true },
      { apuesta: 50, cantidad: 50, disponible: true },
      { apuesta: 100, cantidad: 100, disponible: false },
      { apuesta: 'todo', cantidad: 60, disponible: true },
    ]);
  });
});

describe('jugar a los dados', () => {
  /** Sentado a la mesa de dados. */
  const sentado = (cambios: Partial<Jugador> = {}) => sentarseALosDados(estadoCon(cambios), EN_GUARIDA, new Dados(1)).estado;

  it('solo en guaridas; sin oro, desactivada', () => {
    const enPuerto = accionesDisponibles(estadoCon(), { lugar: 'puerto' }).find(a => a.accion === 'jugar_a_los_dados');
    const sinOro = accionesDisponibles(estadoCon({ oro: 0 }), EN_GUARIDA).find(a => a.accion === 'jugar_a_los_dados');

    expect(enPuerto).toEqual({ accion: 'jugar_a_los_dados', disponible: false, motivo: 'solo_guarida' });
    expect(sinOro?.motivo).toBe('sin_oro');
  });

  it('sentarse gasta el día: hay una acción a medias hasta levantarse', () => {
    const estado = sentado();

    expect(estado.mundo.accionEnCurso).toEqual({ tipo: 'dados' });
    expect(() => pescar(estado, { lugar: 'guarida', juntoAlAgua: true }, new Dados(1))).toThrow(/acción a medias \("dados"\)/);
  });

  it('si tu dado es mayor, ganas lo apostado', () => {
    const partida = apostarALosDados(sentado({ oro: 50 }), 25, new Dados(1));

    expect(partida.tiradas).toEqual([{ tuyo: 4, suyo: 1 }]);
    expect(partida.ganada).toBe(true);
    expect(partida.estado.jugador.oro).toBe(75);
  });

  it('si es menor, lo pierdes', () => {
    const partida = apostarALosDados(sentado({ oro: 50 }), 25, new Dados(8));

    expect(partida.ganada).toBe(false);
    expect(partida.estado.jugador.oro).toBe(25);
  });

  it('si empatan, se vuelve a tirar hasta que haya ganador', () => {
    const partida = apostarALosDados(sentado({ oro: 50 }), 10, new Dados(5));

    expect(partida.tiradas[0]).toEqual({ tuyo: 5, suyo: 5 });
    expect(partida.tiradas.length).toBeGreaterThan(1);
    const ultima = partida.tiradas[partida.tiradas.length - 1];
    expect(ultima.tuyo).not.toBe(ultima.suyo);
  });

  it('se puede jugar varias veces seguidas, y apostar todo', () => {
    const dados = new Dados(1);
    const primera = apostarALosDados(sentado({ oro: 30 }), 10, dados);
    const todo = apostarALosDados(primera.estado, 'todo', dados);

    expect(todo.apostado).toBe(primera.estado.jugador.oro);
    expect(todo.estado.mundo.accionEnCurso).toEqual({ tipo: 'dados' });
  });

  it('error si apuesta más de lo que tiene o una cantidad que no es un botón', () => {
    expect(() => apostarALosDados(sentado({ oro: 20 }), 25, new Dados(1))).toThrow(/no le llega/);
    expect(() => apostarALosDados(sentado({ oro: 200 }), 30, new Dados(1))).toThrow(/no existe/);
  });

  it('el contable gana su 1d6 cuando gana una partida', () => {
    const partida = apostarALosDados(sentado({ oro: 50, sobrenombre: 'el_contable' }), 10, new Dados(1));

    expect(partida.cambios.some(c => c.tipo === 'recurso' && c.motivo === 'contable')).toBe(true);
  });

  it('levantarse termina la acción: toca comer', () => {
    const { estado } = levantarseDeLaMesa(sentado(), new Dados(1));

    expect(estado.mundo.accionEnCurso).toBeNull();
    expect(estado.mundo.fase).toBe('comida');
    expect(() => apostarALosDados(estado, 10, new Dados(1))).toThrow(/no está sentado/);
  });
});

describe('echar un pulso', () => {
  it('quién se sienta: 1-2 borracho, 3-4 parroquiano, 5-6 campeón', () => {
    expect([1, 2, 3, 4, 5, 6].map(d => rivalDePulso(d, false))).toEqual(['borracho', 'borracho', 'parroquiano', 'parroquiano', 'campeon', 'campeon']);
  });

  it('con el campeón ya vencido, el 3-4 pasa a ser 3-6', () => {
    expect([1, 2, 3, 4, 5, 6].map(d => rivalDePulso(d, true))).toEqual(['borracho', 'borracho', 'parroquiano', 'parroquiano', 'parroquiano', 'parroquiano']);
  });

  it('contra el borracho, −1 al dado: un 4 con fuerza 3 gana', () => {
    const { rival, chequeo: ch, estado } = echarUnPulso(estadoCon({ oro: 50 }), EN_GUARIDA, 25, new Dados(8));

    expect(rival).toBe('borracho');
    expect(ch).toMatchObject({ dado: 4, total: 3, superado: true });
    expect(estado.jugador.oro).toBe(75);
  });

  it('contra un parroquiano, tirada normal: un 4 con fuerza 3 pierde', () => {
    const { rival, estado } = echarUnPulso(estadoCon({ oro: 50 }), EN_GUARIDA, 25, new Dados(11));

    expect(rival).toBe('parroquiano');
    expect(estado.jugador.oro).toBe(25);
  });

  it('ganar al campeón: el oro, +1 de fama, y ya no vuelve a salir en esa guarida (en otra, sí)', () => {
    const primera = echarUnPulso(estadoCon({ oro: 50 }), EN_GUARIDA, 10, new Dados(2));
    expect(primera.rival).toBe('campeon');
    expect(primera.estado.jugador).toMatchObject({ oro: 60, fama: 1 });
    expect(primera.estado.mundo.marcas).toEqual([{ col: 15, fila: 3, tipo: 'campeon_vencido' }]);

    const otraVez = echarUnPulso(otroDia(primera.estado), EN_GUARIDA, 10, new Dados(2));
    expect(otraVez.rival).toBe('parroquiano');
    expect(otraVez.estado.jugador.fama).toBe(1);

    expect(echarUnPulso(otroDia(primera.estado), OTRA_GUARIDA, 10, new Dados(2)).rival).toBe('campeon');
  });

  it('perder contra el campeón: pierdes lo apostado y no pasa nada más', () => {
    const { rival, estado } = echarUnPulso(estadoCon({ oro: 50 }), EN_GUARIDA, 10, new Dados(5));

    expect(rival).toBe('campeon');
    expect(estado.jugador).toMatchObject({ oro: 40, fama: 0 });
    expect(estado.mundo.marcas).toEqual([]);
  });

  it('gasta el día: un intento por día', () => {
    const { estado } = echarUnPulso(estadoCon({ oro: 50 }), EN_GUARIDA, 10, new Dados(8));

    expect(estado.mundo.fase).toBe('comida');
    expect(() => echarUnPulso(estado, EN_GUARIDA, 10, new Dados(1))).toThrow(/fase "accion"/);
  });

  it('solo en guaridas', () => {
    expect(() => echarUnPulso(estadoCon(), { lugar: 'puerto' }, 10, new Dados(1))).toThrow(/solo_guarida/);
  });
});
