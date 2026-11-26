import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import { crearPartida } from '../partida/crear-partida';
import { cerrarCombateDelEvento, continuarEvento, elegirOpcion, empezarCombateDelEvento, lanzarEventos, tirarDadosDelEvento, vistaDelEvento } from './motor';

// El guardia (E057), paso 7b: el primer evento con CANTIDAD (el soborno, 1d6x5, se tira cada vez que
// sale) y con un combate del que no se puede huir y en el que no se muere (decidido por el autor el 22-nov).

function estadoCon(oro: number): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return {
    ...estado,
    jugador: { ...estado.jugador, sobrenombre: 'el_fuerte', oro, inventario: [], seguidores: [], condiciones: [] },
    mundo: { ...estado.mundo, fase: 'accion' },
  };
}

/** Sale el guardia y el dado del soborno (a la vista, decidido por el autor el 26-nov) saca "dado": el soborno es dado × 5. */
function lanzado(dado: number, oro = 50): Estado {
  const dados = new Dados(1);
  const salido = lanzarEventos(estadoCon(oro), ['guardia'], dados).estado;
  return tirarDadosDelEvento(salido, dados, { resultadoTrucado: dado }).estado;
}

/** Termina el combate en curso como haya acabado ("victoria" o "derrota", con 1 PV). */
function acabarElCombate(estado: Estado, resultado: 'victoria' | 'derrota'): Estado {
  const combate = estado.mundo.combate!;
  return {
    ...estado,
    jugador: resultado === 'derrota' ? { ...estado.jugador, vida: 1 } : estado.jugador,
    mundo: {
      ...estado.mundo,
      combate: { ...combate, resultado, enemigos: resultado === 'victoria' ? combate.enemigos.map(e => ({ ...e, resistencia: 0 })) : combate.enemigos },
    },
  };
}

function enCombate(): Estado {
  const pelea = elegirOpcion(lanzado(3), 1, new Dados(1)).estado;
  return empezarCombateDelEvento(pelea, new Dados(1)).estado;
}

describe('el guardia (E057)', () => {
  it('primero se tira a la vista cuánto pide (1d6 × 5)', () => {
    const vista = vistaDelEvento(lanzarEventos(estadoCon(50), ['guardia'], new Dados(1)).estado)!;
    expect(vista.modo).toBe('tirada');
    expect(vista.tirada).toMatchObject({ dado: '1d6', boton: '¿Cuánto pedirá?', multiplicador: 5 });
  });

  it('pide un soborno de 1d6×5: el precio sale en el texto y en el botón', () => {
    const vista = vistaDelEvento(lanzado(3))!;

    expect(vista.modo).toBe('opciones');
    expect(vista.imagen).toBe('eventos/guardia.png');
    expect(vista.texto).toContain('soborno de 15 monedas de oro');
    expect(vista.opciones![0]).toEqual({ texto: 'Pagar el soborno (15 monedas de oro)', disponible: true });
    expect(vista.opciones![1].disponible).toBe(true);
  });

  it('cada guardia pide un precio distinto: se vuelve a tirar cada vez que sale', () => {
    expect(vistaDelEvento(lanzado(2))!.texto).toContain('soborno de 10 monedas');
    expect(vistaDelEvento(lanzado(6))!.texto).toContain('soborno de 30 monedas');
  });

  it('sin oro suficiente, pagar sale desactivado (y luchar no)', () => {
    const vista = vistaDelEvento(lanzado(4, 19))!;

    expect(vista.opciones![0]).toEqual({ texto: 'Pagar el soborno (20 monedas de oro)', disponible: false, motivo: 'sin_oro' });
    expect(vista.opciones![1].disponible).toBe(true);
    expect(() => elegirOpcion(lanzado(4, 19), 0, new Dados(1))).toThrow(/no se puede elegir/);
  });

  it('con el oro justo, sí se puede pagar', () => {
    expect(vistaDelEvento(lanzado(4, 20))!.opciones![0].disponible).toBe(true);
  });

  it('al pagar se pierde justo el soborno, se lee y el evento termina', () => {
    const r = elegirOpcion(lanzado(3), 0, new Dados(1));

    expect(r.estado.jugador.oro).toBe(35);
    expect(vistaDelEvento(r.estado)).toMatchObject({ modo: 'continuar', texto: expect.stringContaining('mira hacia otro lado') });
    expect(continuarEvento(r.estado, new Dados(1)).terminado).toBe(true);
  });

  it('al no pagar hay que luchar: sin poder huir, sin morir, y el guardia da 1d6×2 de oro', () => {
    const pelea = elegirOpcion(lanzado(3), 1, new Dados(1)).estado;
    expect(vistaDelEvento(pelea)).toMatchObject({ modo: 'combate', combate: { enemigos: [{ enemigo: 'guardia' }] } });

    const combate = empezarCombateDelEvento(pelea, new Dados(1)).estado.mundo.combate!;
    expect(combate.puedeHuir).toBe(false);
    expect(combate.noMortal).toBe(true);
    expect(combate.enemigos.map(e => e.tipo)).toEqual(['guardia']);
    expect(JSON.stringify(combate.enemigos[0].recompensa)).toBe(JSON.stringify([{ tipo: 'oro', cantidad: '1d6x2' }]));
  });

  it('si le vences, cobras su oro y te libras de la prisión', () => {
    const r = cerrarCombateDelEvento(acabarElCombate(enCombate(), 'victoria'), new Dados(5));
    const ganado = r.estado.jugador.oro - 50;

    expect(ganado).toBeGreaterThanOrEqual(2);
    expect(ganado).toBeLessThanOrEqual(12);
    expect(vistaDelEvento(r.estado)!.lectura!.texto).toContain('Te libras de la prisión');
    expect(continuarEvento(r.estado, new Dados(1))).toMatchObject({ terminado: true, pendientes: [] });
  });

  it('si pierdes, te quedas con 1 PV y te llevan preso (Arrestado, todavía pendiente)', () => {
    const r = cerrarCombateDelEvento(acabarElCombate(enCombate(), 'derrota'), new Dados(5));

    expect(r.estado.jugador.vida).toBe(1);
    expect(r.estado.mundo.finPartida).toBeFalsy();
    expect(vistaDelEvento(r.estado)!.lectura!.texto).toContain('te llevan preso');
    expect(continuarEvento(r.estado, new Dados(1))).toMatchObject({ terminado: true, pendientes: ['arrestado'] });
  });
});
