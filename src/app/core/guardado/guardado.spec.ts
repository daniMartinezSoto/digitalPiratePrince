import { iniciarCombate } from '../combate/combate';
import type { Estado } from '../estado/estado';
import { pescar } from '../acciones/pescar';
import { irAlMercado } from '../mercado/mercado';
import { crearPartida, VERSION_ESTADO } from '../partida/crear-partida';
import { comer } from '../turno/comer';
import { descansar } from '../turno/descansar';
import { iniciarTurno } from '../turno/iniciar-turno';
import { ADAPTADORES, type Adaptador } from './adaptadores';
import { guardarPartida } from './guardar-partida';
import { dadosDePartida, leerPartida } from './leer-partida';

const SEMILLA_MALDITO = 7; // "el maldito" (amuleto con sus partes)
const SEMILLA_HERMANO = 30; // "el hermano" (seguidor vital)

/** Guarda y vuelve a leer; falla el test si no se puede leer. */
function idaYVuelta(estado: Estado): Estado {
  const resultado = leerPartida(guardarPartida(estado));
  if (!resultado.ok) {
    throw new Error(`no se pudo leer: ${resultado.motivo}`);
  }
  return resultado.estado;
}

/** Texto de una partida válida con un cambio hecho a mano (para estropearla). */
function partidaRetocada(retocar: (datos: any) => void): string {
  const datos = JSON.parse(guardarPartida(crearPartida(123, 'Marta').estado));
  retocar(datos);
  return JSON.stringify(datos);
}

describe('guardar y leer una partida: ida y vuelta idéntica', () => {
  it('una partida recién creada', () => {
    const { estado } = crearPartida(123, 'Marta');
    expect(idaYVuelta(estado)).toEqual(estado);
  });

  it('tras un día completo (amanecer, pescar, comer y dormir a bordo)', () => {
    const { estado: inicial, dados } = crearPartida(123, 'Marta');
    let estado = iniciarTurno(inicial, dados).estado;
    estado = pescar(estado, { lugar: 'barco' }, dados).estado;
    estado = comer(estado, 'reservas', 'barco', dados).estado;
    estado = descansar(estado, 'a_bordo', 'barco', dados).estado;
    expect(estado.mundo.dia).toBe(2);
    expect(idaYVuelta(estado)).toEqual(estado);
  });

  it('a mitad de un combate', () => {
    const { estado: inicial, dados } = crearPartida(123, 'Marta');
    const estado = iniciarCombate(inicial, [{ enemigo: 'jaguar' }], dados);
    expect(estado.mundo.combate).not.toBeNull();
    expect(idaYVuelta(estado)).toEqual(estado);
  });

  it('dentro del mercado (acción a medias)', () => {
    const { estado: inicial, dados } = crearPartida(123, 'Marta');
    const enAccion = iniciarTurno(inicial, dados).estado;
    const estado = irAlMercado(enAccion, { lugar: 'puerto' }, dados).estado;
    expect(estado.mundo.accionEnCurso?.tipo).toBe('mercado');
    expect(idaYVuelta(estado)).toEqual(estado);
  });

  it('con "el maldito" (amuleto maldito con sus partes)', () => {
    const { estado } = crearPartida(SEMILLA_MALDITO, 'Marta');
    expect(estado.jugador.sobrenombre).toBe('el_maldito');
    expect(idaYVuelta(estado)).toEqual(estado);
  });

  it('con "el hermano" (seguidor inseparable y vital)', () => {
    const { estado } = crearPartida(SEMILLA_HERMANO, 'Marta');
    expect(estado.jugador.sobrenombre).toBe('el_hermano');
    expect(idaYVuelta(estado)).toEqual(estado);
  });

  it('conserva la semilla', () => {
    const { estado } = crearPartida(482913, 'Marta');
    expect(idaYVuelta(estado).mundo.semilla).toBe(482913);
  });
});

describe('dadosDePartida: la misma suerte tras cerrar el juego', () => {
  it('los dados recuperados sacan lo mismo que habrían sacado sin cerrar', () => {
    const { estado: inicial, dados } = crearPartida(555, 'Marta');
    let estado = iniciarTurno(inicial, dados).estado;
    estado = pescar(estado, { lugar: 'barco' }, dados).estado;

    const recuperados = dadosDePartida(idaYVuelta(estado));
    for (let i = 0; i < 20; i++) {
      expect(recuperados.tirar('2d6')).toEqual(dados.tirar('2d6'));
    }
  });
});

describe('leerPartida: textos que no sirven (nunca rompe)', () => {
  it.each(['', 'hola', '{', '{"version": 1,'])('"%s" → no_se_puede_leer', texto => {
    expect(leerPartida(texto)).toEqual({ ok: false, motivo: 'no_se_puede_leer' });
  });

  it.each(['null', '[]', '42', '"partida"', '{}', '{"version": 1}'])('%s → no_es_una_partida', texto => {
    expect(leerPartida(texto)).toEqual({ ok: false, motivo: 'no_es_una_partida' });
  });

  const estropeadas: [string, (datos: any) => void][] = [
    ['sin jugador', d => delete d.jugador],
    ['sin mundo', d => delete d.mundo],
    ['versión escrita como texto', d => (d.version = '1')],
    ['versión 0', d => (d.version = 0)],
    ['versión con decimales', d => (d.version = 1.5)],
    ['vida escrita como texto', d => (d.jugador.vida = '18')],
    ['inventario que no es una lista', d => (d.jugador.inventario = {})],
    ['retrato inventado', d => (d.jugador.retrato = 'loro')],
    ['fase inventada', d => (d.mundo.fase = 'siesta')],
    ['sin semilla', d => delete d.mundo.semilla],
    ['estadoDados con decimales', d => (d.mundo.estadoDados = 3.5)],
    ['combate que no es un objeto ni null', d => (d.mundo.combate = 'sí')],
    ['sin barco (versión 2)', d => delete d.mundo.posicionBarco],
    ['posición vacía (versión 2)', d => (d.mundo.posicion = null)],
    ['casilla con decimales', d => (d.mundo.posicionBarco = { col: 6.5, fila: 1 })],
    ['sin mapa (versión 2)', d => (d.mundo.mapaId = null)],
  ];
  it.each(estropeadas)('partida %s → no_es_una_partida', (_nombre, retocar) => {
    expect(leerPartida(partidaRetocada(retocar))).toEqual({ ok: false, motivo: 'no_es_una_partida' });
  });

  it('una partida de una versión más nueva que el juego no se carga', () => {
    const texto = partidaRetocada(d => (d.version = VERSION_ESTADO + 1));
    expect(leerPartida(texto)).toEqual({ ok: false, motivo: 'version_futura' });
  });

  it('versión futura gana aunque el resto esté estropeado (no se sabe cómo será)', () => {
    expect(leerPartida(`{"version": ${VERSION_ESTADO + 1}}`)).toEqual({ ok: false, motivo: 'version_futura' });
  });

  it('acepta un estadoDados muy grande (crece con cada tirada)', () => {
    const texto = partidaRetocada(d => (d.mundo.estadoDados = 9_000_000_000_000));
    expect(leerPartida(texto).ok).toBe(true);
  });
});

describe('adaptadores por versión', () => {
  // Estos tests usan versiones imaginarias POR ENCIMA de la actual (V), con adaptadores de prueba.
  const V = VERSION_ESTADO;
  // Adaptador de prueba: en una versión futura imaginaria, el jugador tiene un loro.
  const conLoro: Adaptador = datos => ({
    ...datos,
    jugador: { ...(datos['jugador'] as Record<string, unknown>), loro: 'Capitán Flint' },
  });

  it('una partida antigua pasa por su adaptador y sale con la versión nueva', () => {
    const { estado } = crearPartida(123, 'Marta');
    const resultado = leerPartida(guardarPartida(estado), { [V]: conLoro }, V + 1);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.estado.version).toBe(V + 1);
    expect((resultado.estado.jugador as any).loro).toBe('Capitán Flint');
    expect(resultado.estado.jugador.nombre).toBe('Marta'); // lo demás, igual
  });

  it('se encadenan en orden: V → V+1 → V+2', () => {
    const orden: number[] = [];
    const adaptadores: Record<number, Adaptador> = {
      [V]: datos => (orden.push(V), datos),
      [V + 1]: datos => (orden.push(V + 1), datos),
    };
    const { estado } = crearPartida(123, 'Marta');
    const resultado = leerPartida(guardarPartida(estado), adaptadores, V + 2);
    expect(orden).toEqual([V, V + 1]);
    expect(resultado.ok && resultado.estado.version).toBe(V + 2);
  });

  it('si falta un adaptador por el camino, no se carga', () => {
    const { estado } = crearPartida(123, 'Marta');
    expect(leerPartida(guardarPartida(estado), {}, V + 1)).toEqual({ ok: false, motivo: 'no_es_una_partida' });
  });

  it('una partida de la versión actual no pasa por ningún adaptador', () => {
    const { estado } = crearPartida(123, 'Marta');
    const nuncaSeLlama: Adaptador = () => {
      throw new Error('no debería llamarse');
    };
    const resultado = leerPartida(guardarPartida(estado), { [V - 1]: nuncaSeLlama, [V]: nuncaSeLlama }, V);
    expect(resultado.ok).toBe(true);
  });

  // El primero de verdad (Sprint 9): las partidas de antes del mapa no sabían dónde estaba nadie.
  it('1 → 2: una partida de antes del mapa se abre en la casilla de inicio, con el barco junto a La Habana', () => {
    const vieja = JSON.parse(guardarPartida(crearPartida(123, 'Marta').estado));
    vieja.version = 1;
    vieja.mundo.mapaId = null;
    vieja.mundo.posicion = null;
    delete vieja.mundo.posicionBarco;
    vieja.mundo.dia = 9;
    vieja.jugador.oro = 77;

    const resultado = leerPartida(JSON.stringify(vieja));

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.estado.version).toBe(2);
    expect(resultado.estado.mundo.mapaId).toBe('primer-mapa-prueba');
    expect(resultado.estado.mundo.posicion).toEqual({ col: 6, fila: 0 });
    expect(resultado.estado.mundo.posicionBarco).toEqual(crearPartida(1, 'X').estado.mundo.posicionBarco);
    expect(resultado.estado.mundo.dia).toBe(9); // lo demás, igual
    expect(resultado.estado.jugador.oro).toBe(77);
  });

  it('el juego tiene un adaptador para cada versión entre la 1 y la actual (no falta ningún eslabón)', () => {
    for (let version = 1; version < VERSION_ESTADO; version++) {
      expect(ADAPTADORES[version], `falta el adaptador ${version} → ${version + 1}`).toBeDefined();
    }
  });
});
