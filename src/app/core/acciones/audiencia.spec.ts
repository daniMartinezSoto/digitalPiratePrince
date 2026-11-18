import { contratarMarineros } from '../contratar/contratar';
import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import type { Jugador } from '../estado/jugador';
import { irAlMercado } from '../mercado/mercado';
import { crearPartida } from '../partida/crear-partida';
import { opcionesDeComida } from '../turno/comer';
import { opcionesDeDescanso } from '../turno/descansar';
import type { Sitio } from './accion';
import { accionesDisponibles } from './acciones-disponibles';
import { solicitarAudiencia, tieneBonoDeAyer } from './audiencia';
import { buscarInformacion, opcionesDeBuscarInformacion } from './buscar-informacion';

// SOLICITAR AUDIENCIA y la GUARIDA PIRATA como sitio (paso 11a del Sprint 6).
// Semillas comprobadas (el primer dado que se tira es el 1d6 de la audiencia; 3d6 en buscar información):
//   1d6: 7 → 1 · 9 → 2 · 14 → 3 · 1 → 4 · 2 → 5 · 4 → 6.   3d6: 66 → 4.
const SALE = { 1: 7, 2: 9, 3: 14, 4: 1, 5: 2, 6: 4 } as const;

const EN_PUERTO: Sitio = { lugar: 'puerto', hex: { col: 6, fila: 2 } };
const OTRO_PUERTO: Sitio = { lugar: 'puerto', hex: { col: 20, fila: 9 } };
const EN_ALDEA: Sitio = { lugar: 'aldea', hex: { col: 10, fila: 10 } };
const EN_GUARIDA: Sitio = { lugar: 'guarida', hex: { col: 15, fila: 3 } };

/** Partida de "el fuerte" (sin bonificadores a estas tiradas) en la fase de acción. */
function estadoCon(cambios: Partial<Jugador> = {}): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado, jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', ...cambios }, mundo: { ...estado.mundo, fase: 'accion' } };
}

function diasDespues(estado: Estado, dias: number): Estado {
  return { ...estado, mundo: { ...estado.mundo, dia: estado.mundo.dia + dias, fase: 'accion' } };
}

const disponibilidad = (estado: Estado, sitio: Sitio) => accionesDisponibles(estado, sitio).find(a => a.accion === 'solicitar_audiencia');

describe('solicitar audiencia: dónde', () => {
  it('en puertos, aldeas y guaridas; en el resto sale desactivada', () => {
    for (const sitio of [EN_PUERTO, EN_ALDEA, EN_GUARIDA]) {
      expect(disponibilidad(estadoCon(), sitio)?.disponible).toBe(true);
    }
    expect(disponibilidad(estadoCon(), { lugar: 'monasterio' })).toEqual({
      accion: 'solicitar_audiencia',
      disponible: false,
      motivo: 'solo_puerto_aldea_o_guarida',
    });
  });

  it('termina la acción: toca comer', () => {
    expect(solicitarAudiencia(estadoCon(), EN_PUERTO, new Dados(SALE[4])).estado.mundo.fase).toBe('comida');
  });
});

describe('el gobernador (puerto)', () => {
  it('1: un guardia te reconoce (evento) y aquí ya no puedes volver a pedirla', () => {
    const { estado, eventos } = solicitarAudiencia(estadoCon(), EN_PUERTO, new Dados(SALE[1]));

    expect(eventos).toEqual(['guardia']);
    expect(disponibilidad(diasDespues(estado, 1), EN_PUERTO)?.motivo).toBe('audiencia_vetada');
    expect(disponibilidad(diasDespues(estado, 1), OTRO_PUERTO)?.disponible).toBe(true);
  });

  it('2-3: hoy no; si la pides aquí mañana, +1', () => {
    const ayer = solicitarAudiencia(estadoCon(), EN_PUERTO, new Dados(SALE[2])).estado;
    const hoy = diasDespues(ayer, 1);
    expect(tieneBonoDeAyer(hoy, EN_PUERTO)).toBe(true);

    const otraVez = solicitarAudiencia(hoy, EN_PUERTO, new Dados(SALE[4]));
    expect(otraVez.tirada?.modificador).toBe(1);
    expect(otraVez.tirada?.total).toBe(5);
    expect(otraVez.eventos).toEqual(['audiencia_gobernador']);
  });

  it('el +1 solo vale al día siguiente y en el mismo sitio: después caduca', () => {
    const ayer = solicitarAudiencia(estadoCon(), EN_PUERTO, new Dados(SALE[2])).estado;

    expect(tieneBonoDeAyer(diasDespues(ayer, 2), EN_PUERTO)).toBe(false);
    expect(tieneBonoDeAyer(diasDespues(ayer, 1), OTRO_PUERTO)).toBe(false);
    expect(solicitarAudiencia(diasDespues(ayer, 3), EN_PUERTO, new Dados(SALE[4])).tirada?.modificador).toBe(0);
  });

  it('el +1 no se acumula: tras usarlo, si vuelven a decir "hoy no", es otro +1, no +2', () => {
    const dia1 = solicitarAudiencia(estadoCon(), EN_PUERTO, new Dados(SALE[2])).estado;
    const dia2 = solicitarAudiencia(diasDespues(dia1, 1), EN_PUERTO, new Dados(SALE[1])); // 1 + 1 = 2: otra vez "hoy no"

    expect(dia2.tirada?.total).toBe(2);
    expect(solicitarAudiencia(diasDespues(dia2.estado, 1), EN_PUERTO, new Dados(SALE[4])).tirada?.modificador).toBe(1);
  });

  it('4: te atiende su hija (evento); no cuenta como audiencia concedida', () => {
    const { estado, eventos } = solicitarAudiencia(estadoCon(), EN_PUERTO, new Dados(SALE[4]));

    expect(eventos).toEqual(['hija_del_gobernador']);
    expect(disponibilidad(diasDespues(estado, 1), EN_PUERTO)?.disponible).toBe(true);
  });

  it('5-6: te recibe (evento) y aquí ya no se puede volver a pedir en toda la partida', () => {
    const { estado, eventos } = solicitarAudiencia(estadoCon(), EN_PUERTO, new Dados(SALE[6]));

    expect(eventos).toEqual(['audiencia_gobernador']);
    expect(disponibilidad(diasDespues(estado, 30), EN_PUERTO)?.motivo).toBe('audiencia_ya_concedida');
    expect(() => solicitarAudiencia(diasDespues(estado, 1), EN_PUERTO, new Dados(1))).toThrow(/audiencia_ya_concedida/);
  });

  it('bonificadores: el influyente y el barbero-cirujano suman', () => {
    const barbero = { id: 'b', tipo: 'barbero_cirujano', nombre: 'b', ataque: 2, resistencia: 10, resistenciaMaxima: 10, habilidades: ['cirujano'] };
    const { tirada } = solicitarAudiencia(estadoCon({ sobrenombre: 'el_influyente', seguidores: [barbero] }), EN_PUERTO, new Dados(SALE[1]));

    expect(tirada?.modificador).toBe(2);
  });
});

describe('el jefe de la aldea', () => {
  it('1: le ofendes y no puedes volver a pedirla', () => {
    const { estado } = solicitarAudiencia(estadoCon(), EN_ALDEA, new Dados(SALE[1]));

    expect(disponibilidad(diasDespues(estado, 1), EN_ALDEA)?.motivo).toBe('audiencia_vetada');
  });

  it('2: no se permite (puedes volver a intentarlo, sin +1)', () => {
    const { estado, eventos } = solicitarAudiencia(estadoCon(), EN_ALDEA, new Dados(SALE[2]));

    expect(eventos).toEqual([]);
    expect(tieneBonoDeAyer(diasDespues(estado, 1), EN_ALDEA)).toBe(false);
  });

  it('3: hoy no, mañana +1', () => {
    const { estado } = solicitarAudiencia(estadoCon(), EN_ALDEA, new Dados(SALE[3]));

    expect(tieneBonoDeAyer(diasDespues(estado, 1), EN_ALDEA)).toBe(true);
  });

  it('4-6: te recibe (evento audiencia_jefe_aldea)', () => {
    expect(solicitarAudiencia(estadoCon(), EN_ALDEA, new Dados(SALE[4])).eventos).toEqual(['audiencia_jefe_aldea']);
  });

  it('el nativo tiene +1', () => {
    expect(solicitarAudiencia(estadoCon({ sobrenombre: 'el_nativo' }), EN_ALDEA, new Dados(SALE[1])).tirada?.modificador).toBe(1);
  });
});

describe('el capitán pirata (guarida)', () => {
  it('1-2: le ofendes; 3: no se permite; 4+: te recibe', () => {
    expect(solicitarAudiencia(estadoCon(), EN_GUARIDA, new Dados(SALE[2])).estado.mundo.marcas).toEqual([
      { col: 15, fila: 3, tipo: 'audiencia_vetada' },
    ]);
    expect(solicitarAudiencia(estadoCon(), EN_GUARIDA, new Dados(SALE[3])).eventos).toEqual([]);
    expect(solicitarAudiencia(estadoCon(), EN_GUARIDA, new Dados(SALE[4])).eventos).toEqual(['audiencia_capitan_pirata']);
  });

  it('+1 por cada 2 de fama', () => {
    expect(solicitarAudiencia(estadoCon({ fama: 5 }), EN_GUARIDA, new Dados(SALE[1])).tirada?.modificador).toBe(2);
  });
});

describe('la guarida pirata neutral funciona como un puerto', () => {
  it('tiene las acciones de un puerto: mercado, contratar, audiencia...', () => {
    const disponibles = accionesDisponibles(estadoCon({ tripulacion: 30 }), EN_GUARIDA)
      .filter(a => a.disponible)
      .map(a => a.accion);

    expect(disponibles).toEqual(
      expect.arrayContaining(['ir_al_mercado', 'dar_discurso', 'contratar_marineros', 'buscar_seguidor', 'buscar_informacion', 'solicitar_audiencia']),
    );
    expect(() => irAlMercado(estadoCon(), EN_GUARIDA, new Dados(1))).not.toThrow();
    expect(() => contratarMarineros(estadoCon({ tripulacion: 30 }), EN_GUARIDA, new Dados(1))).not.toThrow();
  });

  it('se puede comer en la taberna y dormir en la posada; a la intemperie no hay eventos nocturnos', () => {
    const { estado } = crearPartida(1, 'Prueba');

    expect(opcionesDeComida({ ...estado, mundo: { ...estado.mundo, fase: 'comida' } }, 'guarida').pago).not.toBeNull();
    expect(opcionesDeDescanso({ ...estado, mundo: { ...estado.mundo, fase: 'descanso' } }, 'guarida').map(o => o.eleccion)).toEqual([
      'techo_solo',
      'intemperie',
    ]);
  });

  it('buscar información: sin sobornos, pero +1 por cada 2 de fama', () => {
    expect(opcionesDeBuscarInformacion(estadoCon({ oro: 100 }), EN_GUARIDA).sobornos).toEqual([]);
    expect(() => buscarInformacion(estadoCon({ oro: 100 }), EN_GUARIDA, 1, new Dados(1))).toThrow(/solo se puede sobornar en los puertos/);

    const { tirada } = buscarInformacion(estadoCon({ fama: 4 }), EN_GUARIDA, 0, new Dados(66));
    expect(tirada?.modificador).toBe(2);
  });

  it('el influyente también suma su +1 al buscar información en la guarida', () => {
    const { tirada } = buscarInformacion(estadoCon({ sobrenombre: 'el_influyente' }), EN_GUARIDA, 0, new Dados(66));

    expect(tirada?.modificador).toBe(1);
  });
});
