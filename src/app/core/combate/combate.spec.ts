import { comprobarQueSePuedeActuar } from '../acciones/accion';
import { accionesDisponibles } from '../acciones/acciones-disponibles';
import { dadosTrucados } from '../dados/dados-trucados';
import type { Estado } from '../estado/estado';
import type { Seguidor } from '../estado/seguidor';
import { crearPartida } from '../partida/crear-partida';
import { aliadosQueLuchan, atacar, BANDERA_AFORTUNADO, cerrarCombate, huir, iniciarCombate, opcionesDeCombate } from './combate';

// Partida de prueba: sobrenombre sin efectos en combate, 15 PV, sin seguidores ni condiciones, fase de acción.
function partida(cambios: Partial<Estado['jugador']> = {}): Estado {
  const { estado } = crearPartida(1, 'Ana');
  return {
    ...estado,
    jugador: { ...estado.jugador, sobrenombre: 'el_conformista', vida: 15, vidaMax: 15, seguidores: [], condiciones: [], diasSinComer: 0, ...cambios },
    mundo: { ...estado.mundo, fase: 'accion' },
  };
}

function seguidor(id: string, ataque: number, resistencia: number, extra: Partial<Seguidor> = {}): Seguidor {
  return { id, tipo: id.replace(/_\d+$/, ''), nombre: `Nombre de ${id}`, ataque, resistencia, resistenciaMaxima: resistencia, habilidades: [], ...extra };
}

// Un combate contra un jaguar (4 de ataque, 6 de resistencia). Uno contra uno: el sorteo no tira dados.
function contraJaguar(cambios: Partial<Estado['jugador']> = {}): Estado {
  return iniciarCombate(partida(cambios), [{ enemigo: 'jaguar' }], dadosTrucados([]));
}

describe('iniciarCombate', () => {
  it('copia los enemigos del bestiario, los numera si se repiten y sortea las parejas', () => {
    // Uno contra tres: el jugador elige la posición 1 (enemigo_2); los otros dos van a por él.
    const estado = iniciarCombate(partida(), [{ enemigo: 'pirata_esqueleto', cantidad: 3 }], dadosTrucados([1]));
    const combate = estado.mundo.combate!;

    expect(combate.enemigos.map(e => e.nombre)).toEqual(['Pirata esqueleto 1', 'Pirata esqueleto 2', 'Pirata esqueleto 3']);
    expect(combate.enemigos[0]).toEqual({ id: 'enemigo_1', tipo: 'pirata_esqueleto', nombre: 'Pirata esqueleto 1', categoria: 'no_muerto', ataque: 1, resistencia: 3, resistenciaMaxima: 3, habilidades: ['revivir_una_vez'], vecesRevivido: 0 });
    expect(combate.objetivos).toEqual({ jugador: 'enemigo_2', enemigo_2: 'jugador', enemigo_1: 'jugador', enemigo_3: 'jugador' });
    expect(combate.ronda).toBe(0);
    expect(combate.resultado).toBeNull();
  });

  it('un enemigo solo no lleva número, y el combate puede cambiar sus números (el jaguar hace 3)', () => {
    const estado = iniciarCombate(partida(), [{ enemigo: 'jaguar', ataque: 3 }], dadosTrucados([]));

    expect(estado.mundo.combate!.enemigos).toEqual([{ id: 'enemigo_1', tipo: 'jaguar', nombre: 'Jaguar', categoria: 'animal', ataque: 3, resistencia: 6, resistenciaMaxima: 6, habilidades: [], vecesRevivido: 0 }]);
  });

  it('mezcla tipos: el número solo sale en los repetidos', () => {
    const estado = iniciarCombate(
      partida(),
      [{ enemigo: 'agente_de_la_marina' }, { enemigo: 'guardia_de_la_marina', cantidad: 2 }],
      dadosTrucados([0]),
    );
    expect(estado.mundo.combate!.enemigos.map(e => e.nombre)).toEqual(['Agente de la marina', 'Guardia de la marina 1', 'Guardia de la marina 2']);
  });

  it('el mono no lucha: ni está en el sorteo ni le atacan', () => {
    const jugador = partida({ seguidores: [seguidor('forzudo_1', 3, 10), seguidor('mono_1', 0, 3)] }).jugador;
    expect(aliadosQueLuchan(jugador)).toEqual(['jugador', 'forzudo_1']);
  });

  it('avisa de errores: ya hay combate, enemigo que no existe, cantidad mala, sin enemigos', () => {
    expect(() => iniciarCombate(contraJaguar(), [{ enemigo: 'jaguar' }], dadosTrucados([]))).toThrow(/ya hay un combate/);
    expect(() => iniciarCombate(partida(), [{ enemigo: 'jaguarr' }], dadosTrucados([]))).toThrow(/no existe el enemigo "jaguarr"/);
    expect(() => iniciarCombate(partida(), [{ enemigo: 'jaguar', cantidad: 0 }], dadosTrucados([]))).toThrow(/cantidad/);
    expect(() => iniciarCombate(partida(), [], dadosTrucados([]))).toThrow(/al menos un enemigo/);
  });

  it('no se puede empezar con la partida terminada', () => {
    const terminada = { ...partida(), mundo: { ...partida().mundo, finPartida: { resultado: 'derrota' as const, motivo: 'vida' as const } } };
    expect(() => iniciarCombate(terminada, [{ enemigo: 'jaguar' }], dadosTrucados([]))).toThrow(/ha terminado/);
  });
});

describe('mientras hay un combate no se puede hacer nada más', () => {
  it('ni empezar una acción', () => {
    expect(() => comprobarQueSePuedeActuar(contraJaguar(), 'pescar')).toThrow(/combate en curso/);
  });

  it('las acciones salen desactivadas con el motivo "combate_en_curso"', () => {
    const acciones = accionesDisponibles(contraJaguar(), { lugar: 'puerto' });
    expect(acciones.every(a => !a.disponible && a.motivo === 'combate_en_curso')).toBe(true);
  });
});

describe('atacar (una ronda)', () => {
  it('todos tiran y el daño se aplica a la vez; los sucesos salen en orden', () => {
    const dados = dadosTrucados([5, 3]); // tú sacas 5; el jaguar, 3 (acierta: 4)
    const { estado, sucesos } = atacar(contraJaguar(), dados);

    expect(sucesos).toEqual([
      { tipo: 'ataque', atacante: 'jugador', objetivo: 'enemigo_1', pielDePiedra: 0, dano: 5,
        tirada: { dados: [5], acierta: true, danoSinCastigo: 5, bonificador: 0, castigoHambre: 0, dano: 5 } },
      { tipo: 'ataque', atacante: 'enemigo_1', objetivo: 'jugador', pielDePiedra: 0, dano: 4,
        tirada: { dados: [3], acierta: true, danoSinCastigo: 4, bonificador: 0, castigoHambre: 0, dano: 4 } },
      { tipo: 'herido', luchador: 'jugador', antes: 15, despues: 11 },
      { tipo: 'herido', luchador: 'enemigo_1', antes: 6, despues: 1 },
    ]);
    expect(estado.jugador.vida).toBe(11);
    expect(estado.mundo.combate!.enemigos[0].resistencia).toBe(1);
    expect(estado.mundo.combate!.ronda).toBe(1);
    expect(estado.mundo.combate!.resultado).toBeNull();
    expect(dados.restantes()).toBe(0);
  });

  it('victoria: cae el último enemigo (y su golpe de esa ronda también cuenta)', () => {
    const { estado, sucesos } = atacar(contraJaguar(), dadosTrucados([6, 2, 4])); // tú 6 + 2 = 8; el jaguar acierta: 4

    expect(estado.jugador.vida).toBe(11);
    expect(estado.mundo.combate!.resultado).toBe('victoria');
    expect(sucesos).toContainEqual({ tipo: 'muerte', luchador: 'enemigo_1', nombre: 'Jaguar' });
    expect(sucesos[sucesos.length - 1]).toEqual({ tipo: 'fin', resultado: 'victoria' });
  });

  it('cerrarCombate recoge el resultado y quita el combate: ya se puede seguir jugando', () => {
    const { estado } = atacar(contraJaguar(), dadosTrucados([6, 2, 4]));
    const cerrado = cerrarCombate(estado, dadosTrucados([]));

    expect(cerrado.resultado).toBe('victoria');
    expect(cerrado.estado.mundo.combate).toBeNull();
    expect(() => comprobarQueSePuedeActuar(cerrado.estado, 'pescar')).not.toThrow();
  });

  it('derrota: llegas a 0 y pierdes la partida', () => {
    const { estado, sucesos } = atacar(contraJaguar({ vida: 2 }), dadosTrucados([2, 4]));

    expect(estado.jugador.vida).toBe(0);
    expect(estado.mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'vida' });
    expect(estado.mundo.combate!.resultado).toBe('derrota');
    expect(sucesos).toContainEqual({ tipo: 'muerte', luchador: 'jugador', nombre: 'Ana' });
    expect(cerrarCombate(estado, dadosTrucados([])).resultado).toBe('derrota');
  });

  it('golpe de gracia: si matas a tu rival en la ronda en que caerías, te quedas con 1 PV', () => {
    const { estado, sucesos } = atacar(contraJaguar({ vida: 3 }), dadosTrucados([6, 3, 6])); // 9 al jaguar; él te hace 5

    expect(sucesos).toContainEqual({ tipo: 'golpe_de_gracia' });
    expect(estado.jugador.vida).toBe(1);
    expect(estado.mundo.finPartida).toBeNull();
    expect(estado.mundo.combate!.resultado).toBe('victoria');
  });

  it('golpe de gracia con más enemigos: te quedas con 1 PV y el combate sigue', () => {
    // Tú contra dos jaguares: atacas al 1 y te atacan los dos.
    const inicio = iniciarCombate(partida({ vida: 5 }), [{ enemigo: 'jaguar', cantidad: 2 }], dadosTrucados([0]));
    const { estado, sucesos } = atacar(inicio, dadosTrucados([6, 2, 3, 3])); // matas al 1; cada uno te hace 4

    expect(sucesos).toContainEqual({ tipo: 'golpe_de_gracia' });
    expect(estado.jugador.vida).toBe(1);
    expect(estado.mundo.combate!.resultado).toBeNull();
    expect(sucesos).toContainEqual({ tipo: 'nuevo_objetivo', luchador: 'jugador', objetivo: 'enemigo_2' });
  });

  it('el afortunado evita la muerte una vez; la segunda, no', () => {
    const inicio = contraJaguar({ vida: 3, sobrenombre: 'el_afortunado' });
    const primera = atacar(inicio, dadosTrucados([1, 5])); // fallas; el jaguar te hace 4

    expect(primera.sucesos).toContainEqual({ tipo: 'afortunado' });
    expect(primera.estado.jugador.vida).toBe(1);
    expect(primera.estado.mundo.banderas[BANDERA_AFORTUNADO]).toBe(true);
    expect(primera.estado.mundo.combate!.resultado).toBeNull();

    const segunda = atacar(primera.estado, dadosTrucados([1, 5]));
    expect(segunda.sucesos).not.toContainEqual({ tipo: 'afortunado' });
    expect(segunda.estado.mundo.combate!.resultado).toBe('derrota');
  });

  it('el golpe de gracia va antes que el afortunado: si te salva el golpe, el afortunado no se gasta', () => {
    const { estado, sucesos } = atacar(contraJaguar({ vida: 3, sobrenombre: 'el_afortunado' }), dadosTrucados([6, 3, 6]));

    expect(sucesos).toContainEqual({ tipo: 'golpe_de_gracia' });
    expect(estado.mundo.banderas[BANDERA_AFORTUNADO]).toBeUndefined();
  });

  it('piel de piedra: −1 a cada golpe que te aciertan, pero cada uno te hace al menos 1', () => {
    const inicio = iniciarCombate(partida({ condiciones: [{ id: 'piel_de_piedra' }] }), [{ enemigo: 'pirata_esqueleto', cantidad: 2 }], dadosTrucados([0]));
    const { estado, sucesos } = atacar(inicio, dadosTrucados([1, 3, 6])); // fallas; uno te hace 1, el otro 2

    const golpes = sucesos.filter(s => s.tipo === 'ataque' && s.objetivo === 'jugador');
    expect(golpes.map(s => s.tipo === 'ataque' && [s.tirada.dano, s.pielDePiedra, s.dano])).toEqual([[1, 0, 1], [2, 1, 1]]);
    expect(estado.jugador.vida).toBe(13);
  });

  it('el hambre resta a tu daño', () => {
    const { sucesos } = atacar(contraJaguar({ diasSinComer: 2 }), dadosTrucados([5, 1]));
    const tuAtaque = sucesos[0];
    expect(tuAtaque.tipo === 'ataque' && [tuAtaque.tirada.castigoHambre, tuAtaque.dano]).toEqual([2, 3]);
  });

  it('el hambre también resta al daño de tus seguidores', () => {
    const inicio = iniciarCombate(partida({ diasSinComer: 1, seguidores: [seguidor('forzudo_1', 3, 10)] }), [{ enemigo: 'jaguar' }], dadosTrucados([0]));
    // El jaguar va siempre a por ti; tú y el forzudo le atacáis.
    const { sucesos } = atacar(inicio, dadosTrucados([1, 4, 1]));
    const delForzudo = sucesos.find(s => s.tipo === 'ataque' && s.atacante === 'forzudo_1');
    expect(delForzudo?.tipo === 'ataque' && delForzudo.dano).toBe(2);
  });

  it('el maleficio del pirata quita 1 a tu daño', () => {
    const { sucesos } = atacar(contraJaguar({ condiciones: [{ id: 'maleficio_del_pirata' }] }), dadosTrucados([4, 1]));
    const tuAtaque = sucesos[0];
    expect(tuAtaque.tipo === 'ataque' && [tuAtaque.tirada.bonificador, tuAtaque.dano]).toEqual([-1, 3]);
  });

  it('el daño que sobra se pierde: no pasa a otro enemigo', () => {
    const inicio = iniciarCombate(partida(), [{ enemigo: 'pirata_esqueleto', cantidad: 2 }], dadosTrucados([0]));
    const { estado } = atacar(inicio, dadosTrucados([6, 6, 2, 1, 1, 4])); // 14 al primero, que tenía 3 (y no revive: 4)

    expect(estado.mundo.combate!.enemigos.map(e => e.resistencia)).toEqual([0, 3]);
  });

  it('con seguidores: cada uno ataca a su rival, y quien se queda sin rival pasa a otro (el mono, fuera)', () => {
    const mono = seguidor('mono_1', 0, 3);
    const inicio = iniciarCombate(
      partida({ seguidores: [seguidor('forzudo_1', 3, 10), mono] }),
      [{ enemigo: 'pirata_esqueleto', cantidad: 3 }],
      dadosTrucados([0, 0, 0]), // tú → 1; el forzudo → 2; el 3 sobra y va a por ti
    );
    expect(inicio.mundo.combate!.objetivos).toEqual({ jugador: 'enemigo_1', enemigo_1: 'jugador', forzudo_1: 'enemigo_2', enemigo_2: 'forzudo_1', enemigo_3: 'jugador' });

    // Tú matas al 1 (3), el forzudo al 2 (3); el 1 y el 2 fallan; el 3 te da (1). Ninguno revive (5 y 2).
    const { estado, sucesos } = atacar(inicio, dadosTrucados([3, 4, 1, 1, 3, 5, 2]));

    expect(estado.jugador.vida).toBe(14);
    expect(estado.mundo.combate!.objetivos).toEqual({ jugador: 'enemigo_3', forzudo_1: 'enemigo_3', enemigo_3: 'jugador' });
    expect(sucesos).toContainEqual({ tipo: 'nuevo_objetivo', luchador: 'jugador', objetivo: 'enemigo_3' });
    expect(sucesos).toContainEqual({ tipo: 'nuevo_objetivo', luchador: 'forzudo_1', objetivo: 'enemigo_3' });
    expect(estado.jugador.seguidores.find(s => s.id === 'mono_1')).toEqual(mono);
  });

  it('si muere un seguidor, sale del grupo y quien le atacaba busca a otro', () => {
    // Dos contra dos: tú eliges la posición 1 (enemigo_2); al forzudo le queda el 1.
    const inicio = iniciarCombate(partida({ seguidores: [seguidor('forzudo_1', 3, 2)] }), [{ enemigo: 'pirata_esqueleto', cantidad: 2 }], dadosTrucados([1]));
    // Tú haces 2; el forzudo falla; el 1 saca un 6 (2 de daño) y mata al forzudo; el 2 falla.
    const { estado, sucesos, cambios } = atacar(inicio, dadosTrucados([2, 1, 6, 1]));

    expect(estado.jugador.seguidores).toEqual([]);
    expect(cambios).toContainEqual({ tipo: 'seguidor_muerto', seguidor: 'forzudo_1' });
    expect(sucesos).toContainEqual({ tipo: 'herido', luchador: 'forzudo_1', antes: 2, despues: 0 });
    expect(sucesos).toContainEqual({ tipo: 'muerte', luchador: 'forzudo_1', nombre: 'Nombre de forzudo_1' });
    expect(sucesos).toContainEqual({ tipo: 'nuevo_objetivo', luchador: 'enemigo_1', objetivo: 'jugador' });
  });

  it('si muere el seguidor vital, pierdes aunque caigan los enemigos esa misma ronda', () => {
    const hermano = seguidor('forzudo_1', 5, 2, { vital: true, inseparable: true });
    // Dos contra dos piratas (1/5): tú eliges la posición 1 (enemigo_2); al forzudo le queda el 1.
    const inicio = iniciarCombate(partida({ seguidores: [hermano] }), [{ enemigo: 'pirata', cantidad: 2 }], dadosTrucados([1]));
    // Tú matas al 2 (5); el forzudo mata al 1 (5); el 1 saca un 6 (2) y mata al forzudo; el 2 falla.
    const { estado } = atacar(inicio, dadosTrucados([5, 4, 6, 1]));
    expect(estado.mundo.combate!.enemigos.every(e => e.resistencia === 0)).toBe(true);

    expect(estado.mundo.finPartida).toEqual({ resultado: 'derrota', motivo: 'seguidor' });
    expect(estado.mundo.combate!.resultado).toBe('derrota');
  });

  it('avisa si no hay combate o si ya ha terminado', () => {
    expect(() => atacar(partida(), dadosTrucados([]))).toThrow(/no hay ningún combate/);
    const { estado } = atacar(contraJaguar(), dadosTrucados([6, 2, 4]));
    expect(() => atacar(estado, dadosTrucados([3, 3]))).toThrow(/ya ha terminado/);
    expect(() => cerrarCombate(contraJaguar(), dadosTrucados([]))).toThrow(/todavía no ha terminado/);
  });
});

describe('huir', () => {
  // Una ronda ya jugada contra el jaguar: tú haces 2 (le quedan 4) y él falla.
  function trasUnaRonda(opciones: { puedeHuir?: boolean } = {}): Estado {
    const inicio = iniciarCombate(partida(), [{ enemigo: 'jaguar' }], dadosTrucados([]), opciones);
    return atacar(inicio, dadosTrucados([2, 1])).estado;
  }

  it('antes de la primera ronda no se puede huir', () => {
    const estado = contraJaguar();
    expect(opcionesDeCombate(estado)).toEqual({ atacar: true, huir: { disponible: false, motivo: 'primera_ronda' }, objetos: [] });
    expect(() => huir(estado, dadosTrucados([6]))).toThrow(/no se puede huir \(primera_ronda\)/);
  });

  it('después de una ronda, sí', () => {
    expect(opcionesDeCombate(trasUnaRonda())).toEqual({ atacar: true, huir: { disponible: true }, objetos: [] });
  });

  it('con 4 o más huye todo el grupo: el combate termina en "huida" y conservas tu vida', () => {
    const { estado, sucesos } = huir(trasUnaRonda(), dadosTrucados([4]));

    expect(sucesos).toEqual([{ tipo: 'huida', dado: 4, exito: true }, { tipo: 'fin', resultado: 'huida' }]);
    expect(estado.mundo.combate!.resultado).toBe('huida');
    expect(opcionesDeCombate(estado)).toEqual({ atacar: false, huir: { disponible: false }, objetos: [] });
    const cerrado = cerrarCombate(estado, dadosTrucados([]));
    expect(cerrado.resultado).toBe('huida');
    expect(cerrado.estado.jugador.vida).toBe(15);
  });

  it('si falla, en la próxima ronda los enemigos aciertan siempre (un 1 cuenta como golpe)', () => {
    const fallo = huir(trasUnaRonda(), dadosTrucados([3]));
    expect(fallo.sucesos).toEqual([{ tipo: 'huida', dado: 3, exito: false }]);
    expect(fallo.estado.mundo.combate!.noPuedenFallar).toBe(true);

    const { estado, sucesos } = atacar(fallo.estado, dadosTrucados([1, 1])); // tú fallas; el jaguar saca un 1... y acierta
    expect(sucesos[0]).toEqual({ tipo: 'enemigos_no_fallan' });
    expect(estado.jugador.vida).toBe(11);
    expect(estado.mundo.combate!.noPuedenFallar).toBe(false);
  });

  it('tras fallar hay que pelear otra ronda antes de volver a intentarlo', () => {
    const fallo = huir(trasUnaRonda(), dadosTrucados([3]));
    expect(opcionesDeCombate(fallo.estado).huir).toEqual({ disponible: false, motivo: 'acabas_de_fallar' });
    expect(() => huir(fallo.estado, dadosTrucados([6]))).toThrow(/acabas_de_fallar/);

    const otraRonda = atacar(fallo.estado, dadosTrucados([1, 1])).estado;
    expect(opcionesDeCombate(otraRonda).huir).toEqual({ disponible: true });
  });

  it('hay combates de los que no se puede huir', () => {
    const estado = trasUnaRonda({ puedeHuir: false });
    expect(opcionesDeCombate(estado).huir).toEqual({ disponible: false, motivo: 'no_se_puede_huir' });
    expect(() => huir(estado, dadosTrucados([6]))).toThrow(/no_se_puede_huir/);
  });

  it('sin combate no hay nada que hacer', () => {
    expect(opcionesDeCombate(partida())).toEqual({ atacar: false, huir: { disponible: false }, objetos: [] });
    expect(() => huir(partida(), dadosTrucados([6]))).toThrow(/no hay ningún combate/);
  });
});
