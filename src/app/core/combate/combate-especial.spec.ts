import { dadosTrucados } from '../dados/dados-trucados';
import type { Estado } from '../estado/estado';
import type { ObjetoLlevado } from '../estado/objeto-llevado';
import { crearPartida } from '../partida/crear-partida';
import { atacar, cerrarCombate, EVENTO_MALDICION, huir, iniciarCombate, opcionesDeCombate, usarObjetoEnCombate, volverATirar, type EnemigoPedido, type OpcionesDeCombate, type SucesoDeCombate } from './combate';

// Paso 6 del combate: habilidades de los enemigos, opciones de cada combate, objetos y recompensas.

function partida(cambios: Partial<Estado['jugador']> = {}): Estado {
  const { estado } = crearPartida(1, 'Ana');
  return {
    ...estado,
    jugador: { ...estado.jugador, sobrenombre: 'el_conformista', vida: 15, vidaMax: 15, seguidores: [], condiciones: [], inventario: [], diasSinComer: 0, ...cambios },
    mundo: { ...estado.mundo, fase: 'accion' },
  };
}

// Uno contra uno (el sorteo no tira dados).
function contra(enemigo: string, cambios: Partial<Estado['jugador']> = {}, opciones: OpcionesDeCombate = {}, pedido: Partial<EnemigoPedido> = {}): Estado {
  return iniciarCombate(partida(cambios), [{ enemigo, ...pedido }], dadosTrucados([]), opciones);
}

function rondas(estado: Estado, ...tiradas: number[][]): Estado {
  return tiradas.reduce((actual, numeros) => atacar(actual, dadosTrucados(numeros)).estado, estado);
}

function enemigo1(estado: Estado) {
  return estado.mundo.combate!.enemigos[0];
}

function de<T extends SucesoDeCombate['tipo']>(sucesos: SucesoDeCombate[], tipo: T): Extract<SucesoDeCombate, { tipo: T }>[] {
  return sucesos.filter((s): s is Extract<SucesoDeCombate, { tipo: T }> => s.tipo === tipo);
}

describe('habilidades de los enemigos', () => {
  describe('curarse (guardián de la isla misteriosa)', () => {
    it('al final de la ronda 2 se cura 1d6 (sin pasar de su máximo)', () => {
      const tras1 = rondas(contra('guardian_isla_misteriosa'), [2, 1]); // 14 → 12; en la ronda 1 no se cura
      expect(enemigo1(tras1).resistencia).toBe(12);

      const { estado, sucesos } = atacar(tras1, dadosTrucados([2, 1, 6])); // 12 → 10, y se cura 6 (hasta 14)
      expect(de(sucesos, 'se_cura')).toEqual([{ tipo: 'se_cura', luchador: 'enemigo_1', dado: 6, antes: 10, despues: 14 }]);
      expect(enemigo1(estado).resistencia).toBe(14);
    });

    it('si no está herido, no tira nada', () => {
      const dados = dadosTrucados([1, 1]);
      atacar(rondas(contra('guardian_isla_misteriosa'), [1, 1]), dados);
      expect(dados.restantes()).toBe(0);
    });
  });

  it('revivir debilitado (pirata maldito): vuelve con −1/−1, como mucho 3 veces (hay que derrotarlo 4)', () => {
    const inicio = contra('pirata_maldito'); // 3 de ataque, 5 de resistencia
    const primera = atacar(inicio, dadosTrucados([5, 1]));
    expect(de(primera.sucesos, 'muerte')).toEqual([{ tipo: 'muerte', luchador: 'enemigo_1', nombre: 'Pirata maldito' }]);
    expect(de(primera.sucesos, 'revive')).toEqual([{ tipo: 'revive', luchador: 'enemigo_1', ataque: 2, resistencia: 4 }]);
    expect(primera.estado.mundo.combate!.resultado).toBeNull();

    const casi = rondas(primera.estado, [4, 1], [3, 1]); // 1/3, 1/2
    expect(enemigo1(casi)).toMatchObject({ ataque: 1, resistencia: 2, resistenciaMaxima: 2, vecesRevivido: 3 });

    const fin = atacar(casi, dadosTrucados([2, 1])); // la cuarta vez ya no vuelve
    expect(de(fin.sucesos, 'revive')).toEqual([]);
    expect(fin.estado.mundo.combate!.resultado).toBe('victoria');
  });

  describe('revivir una vez (piratas esqueleto)', () => {
    it('al caer tira 1d6: con un 1 vuelve con toda su resistencia; la segunda vez ya no', () => {
      const vuelve = atacar(contra('pirata_esqueleto'), dadosTrucados([3, 1, 1]));
      expect(de(vuelve.sucesos, 'revive')).toEqual([{ tipo: 'revive', luchador: 'enemigo_1', ataque: 1, resistencia: 3, dado: 1 }]);
      expect(enemigo1(vuelve.estado)).toMatchObject({ resistencia: 3, vecesRevivido: 1 });

      const dados = dadosTrucados([3, 1]);
      const fin = atacar(vuelve.estado, dados); // ya no tira para revivir
      expect(fin.estado.mundo.combate!.resultado).toBe('victoria');
      expect(dados.restantes()).toBe(0);
    });

    it('con otro número se queda en el suelo', () => {
      const { estado, sucesos } = atacar(contra('pirata_esqueleto'), dadosTrucados([3, 1, 4]));
      expect(de(sucesos, 'no_revive')).toEqual([{ tipo: 'no_revive', luchador: 'enemigo_1', dado: 4 }]);
      expect(estado.mundo.combate!.resultado).toBe('victoria');
    });
  });

  describe('atacar dos veces (velociraptor)', () => {
    it('tira dos ataques contra su rival', () => {
      const { estado, sucesos } = atacar(contra('velociraptor'), dadosTrucados([1, 3, 6])); // 2 + 3
      expect(de(sucesos, 'ataque').filter(a => a.atacante === 'enemigo_1').length).toBe(2);
      expect(estado.jugador.vida).toBe(10);
    });

    it('si el primero es un 1, no hay segundo (con un 2 falla, pero sí hay segundo)', () => {
      const dados = dadosTrucados([1, 1]);
      atacar(contra('velociraptor'), dados);
      expect(dados.restantes()).toBe(0);
      expect(atacar(contra('velociraptor'), dadosTrucados([1, 2, 4])).estado.jugador.vida).toBe(13);
    });
  });

  it('piel de piedra (gólem): cada golpe que recibe le hace 1 menos', () => {
    const { estado, sucesos } = atacar(contra('golem_guardian'), dadosTrucados([5, 1]));
    const tuyo = de(sucesos, 'ataque')[0];
    expect([tuyo.tirada.dano, tuyo.pielDePiedra, tuyo.dano]).toEqual([5, 1, 4]);
    expect(enemigo1(estado).resistencia).toBe(8);
  });

  describe('acierta solo con 5-6 (cangrejo gigante)', () => {
    it('con un 4 falla; con un 5 hace su daño; con un 6, su daño +1', () => {
      expect(atacar(contra('cangrejo_gigante'), dadosTrucados([1, 4])).estado.jugador.vida).toBe(15);
      expect(atacar(contra('cangrejo_gigante'), dadosTrucados([1, 5])).estado.jugador.vida).toBe(10);
      expect(atacar(contra('cangrejo_gigante'), dadosTrucados([1, 6])).estado.jugador.vida).toBe(9);
    });

    it('si acabas de fallar una huida, acierta siempre', () => {
      const fallo = huir(rondas(contra('cangrejo_gigante'), [1, 1]), dadosTrucados([2])).estado;
      expect(atacar(fallo, dadosTrucados([1, 1])).estado.jugador.vida).toBe(10);
    });
  });

  describe('maldice con un 6 (chamán)', () => {
    it('si saca un 6, al terminar el combate salta la maldición (una sola vez)', () => {
      const { estado, sucesos } = atacar(contra('chaman'), dadosTrucados([1, 6]));
      expect(de(sucesos, 'maldicion_pendiente')).toEqual([{ tipo: 'maldicion_pendiente', luchador: 'enemigo_1' }]);

      const otraVez = atacar(estado, dadosTrucados([1, 6]));
      expect(de(otraVez.sucesos, 'maldicion_pendiente')).toEqual([]);

      // Tú 6 (el chamán falla con un 1) y te arriesgas: 2 → 8, cae.
      const ganado = volverATirar(atacar(otraVez.estado, dadosTrucados([6, 1])).estado, dadosTrucados([2])).estado;
      expect(cerrarCombate(ganado, dadosTrucados([])).eventos).toEqual([EVENTO_MALDICION]);
    });

    it('también si huyes', () => {
      const tras = rondas(contra('chaman'), [1, 6]);
      const huido = huir(tras, dadosTrucados([5])).estado;
      expect(cerrarCombate(huido, dadosTrucados([])).eventos).toEqual([EVENTO_MALDICION]);
    });

    it('sin un 6, no hay maldición', () => {
      const ganado = volverATirar(atacar(contra('chaman'), dadosTrucados([6, 1])).estado, dadosTrucados([2])).estado;
      expect(cerrarCombate(ganado, dadosTrucados([])).eventos).toEqual([]);
    });
  });
});

describe('opciones de cada combate', () => {
  it('cantidad al azar: "1d6" piratas', () => {
    // Primero el 1d6 de la cantidad (3); después el sorteo (tú → posición 0).
    const estado = iniciarCombate(partida(), [{ enemigo: 'pirata', cantidad: '1d6' }], dadosTrucados([3, 0]));
    expect(estado.mundo.combate!.enemigos.map(e => e.nombre)).toEqual(['Pirata con cuchillo 1', 'Pirata con cuchillo 2', 'Pirata con cuchillo 3']);
  });

  it('recompensa por cada enemigo derrotado: se cobra al cerrar, aunque huyas', () => {
    const inicio = iniciarCombate(partida(), [{ enemigo: 'pirata', cantidad: 2, recompensa: [{ tipo: 'oro', cantidad: 5 }] }], dadosTrucados([0]));
    const tras = rondas(inicio, [5, 1, 1]); // cae el 1
    const huido = huir(tras, dadosTrucados([4])).estado;
    const cierre = cerrarCombate(huido, dadosTrucados([]));

    expect(cierre.estado.jugador.oro).toBe(55);
    expect(cierre.cambios).toContainEqual({ tipo: 'recurso', recurso: 'oro', antes: 50, despues: 55 });
  });

  it('si pierdes la partida, ni recompensas ni eventos', () => {
    const perdido = rondas(contra('chaman', { vida: 1 }, {}, { recompensa: [{ tipo: 'oro', cantidad: 5 }] }), [1, 6]);
    expect(perdido.mundo.finPartida).not.toBeNull();
    const cierre = cerrarCombate(perdido, dadosTrucados([]));
    expect(cierre.eventos).toEqual([]);
    expect(cierre.cambios).toEqual([]);
  });

  describe('combate no mortal', () => {
    it('si caes, te quedas con 1 PV y pierdes el combate, no la partida', () => {
      const { estado, sucesos } = atacar(contra('jaguar', { vida: 3 }, { noMortal: true }), dadosTrucados([1, 5]));
      expect(de(sucesos, 'derrota_no_mortal').length).toBe(1);
      expect(estado.jugador.vida).toBe(1);
      expect(estado.mundo.finPartida).toBeNull();
      expect(estado.mundo.combate!.resultado).toBe('derrota');
    });

    it('el afortunado no se gasta en un combate no mortal', () => {
      const { estado } = atacar(contra('jaguar', { vida: 3, sobrenombre: 'el_afortunado' }, { noMortal: true }), dadosTrucados([1, 5]));
      expect(estado.mundo.banderas['afortunado_usado']).toBeUndefined();
    });
  });

  describe('ataque por sorpresa', () => {
    it('emboscáis vosotros: en la primera ronda solo atacáis vosotros', () => {
      const dados = dadosTrucados([5]);
      const { estado, sucesos } = atacar(contra('jaguar', {}, { sorpresa: 'nuestra' }), dados);
      expect(sucesos[0]).toEqual({ tipo: 'emboscada', quien: 'nuestra' });
      expect(estado.jugador.vida).toBe(15);
      expect(enemigo1(estado).resistencia).toBe(1);
      expect(dados.restantes()).toBe(0);
      // La segunda ronda ya es normal: tiráis los dos.
      expect(atacar(estado, dadosTrucados([1, 3])).estado.jugador.vida).toBe(11);
    });

    it('¡emboscada!: en la primera ronda solo atacan ellos', () => {
      const { estado, sucesos } = atacar(contra('jaguar', {}, { sorpresa: 'suya' }), dadosTrucados([3]));
      expect(sucesos[0]).toEqual({ tipo: 'emboscada', quien: 'suya' });
      expect(estado.jugador.vida).toBe(11);
      expect(enemigo1(estado).resistencia).toBe(6);
    });
  });
});

describe('objetos en combate', () => {
  const RON: ObjetoLlevado = { id: 'ron', usosRestantes: 1 };
  const PISTOLA: ObjetoLlevado = { id: 'pistola_de_chispa' };
  const BOMBA: ObjetoLlevado = { id: 'bomba_de_humo', usosRestantes: 1 };
  const POCION: ObjetoLlevado = { id: 'pocion_magica', usosRestantes: 1 };

  it('salen como botones junto a "Atacar"', () => {
    const estado = contra('jaguar', { inventario: [RON, { id: 'unguento', usosRestantes: 1 }, PISTOLA] });
    expect(opcionesDeCombate(estado).objetos).toEqual([
      { posicion: 0, objeto: 'ron', disponible: true },
      { posicion: 2, objeto: 'pistola_de_chispa', disponible: true },
    ]);
  });

  it('el ron: +2 al daño el resto del combate; se gasta y no gasta tu ataque', () => {
    const usado = usarObjetoEnCombate(contra('jaguar', { inventario: [RON] }), 0, dadosTrucados([]));
    expect(usado.sucesos).toEqual([{ tipo: 'objeto_usado', objeto: 'ron' }]);
    expect(usado.estado.jugador.inventario).toEqual([]);
    expect(usado.estado.mundo.combate!.ronda).toBe(0);

    const { sucesos } = atacar(usado.estado, dadosTrucados([4, 1]));
    const tuyo = de(sucesos, 'ataque')[0];
    expect([tuyo.tirada.bonificador, tuyo.dano]).toEqual([2, 6]);
  });

  it('la pistola: tu próximo ataque suma 1d6 si aciertas; una vez por combate y no se gasta', () => {
    const usado = usarObjetoEnCombate(contra('jaguar', { inventario: [PISTOLA] }), 0, dadosTrucados([])).estado;
    expect(opcionesDeCombate(usado).objetos).toEqual([{ posicion: 0, objeto: 'pistola_de_chispa', disponible: false, motivo: 'ya_usado_en_este_combate' }]);
    expect(() => usarObjetoEnCombate(usado, 0, dadosTrucados([]))).toThrow(/ya_usado_en_este_combate/);

    const { estado, sucesos } = atacar(usado, dadosTrucados([4, 3, 1])); // 4 + pistola 3
    const tuyo = de(sucesos, 'ataque')[0];
    expect([tuyo.dadosExtra, tuyo.dano]).toEqual([[3], 7]);
    expect(estado.jugador.inventario).toEqual([PISTOLA]);
    expect(estado.mundo.combate!.dadoExtra).toBeNull();
  });

  it('la pistola no suma nada si fallas (y se pierde ese disparo)', () => {
    const usado = usarObjetoEnCombate(contra('jaguar', { inventario: [PISTOLA] }), 0, dadosTrucados([])).estado;
    const dados = dadosTrucados([1, 1]);
    const { estado } = atacar(usado, dados);
    expect(dados.restantes()).toBe(0);
    expect(estado.mundo.combate!.dadoExtra).toBeNull();
  });

  it('la bomba de humo: huida segura; pero no en los combates de los que no se puede huir', () => {
    const { estado, sucesos } = usarObjetoEnCombate(contra('jaguar', { inventario: [BOMBA] }), 0, dadosTrucados([]));
    expect(sucesos).toEqual([{ tipo: 'objeto_usado', objeto: 'bomba_de_humo' }, { tipo: 'fin', resultado: 'huida' }]);
    expect(estado.mundo.combate!.resultado).toBe('huida');

    const sinHuida = contra('jaguar', { inventario: [BOMBA] }, { puedeHuir: false });
    expect(opcionesDeCombate(sinHuida).objetos[0]).toEqual({ posicion: 0, objeto: 'bomba_de_humo', disponible: false, motivo: 'no_se_puede_huir' });
    expect(() => usarObjetoEnCombate(sinHuida, 0, dadosTrucados([]))).toThrow(/no_se_puede_huir/);
  });

  it('la poción mágica: todos los enemigos caen (sin revivir) y ganas', () => {
    const inicio = iniciarCombate(partida({ inventario: [POCION] }), [{ enemigo: 'pirata_esqueleto', cantidad: 3 }], dadosTrucados([0]));
    const { estado, sucesos } = usarObjetoEnCombate(inicio, 0, dadosTrucados([]));
    expect(de(sucesos, 'muerte').map(s => s.nombre)).toEqual(['Pirata esqueleto 1', 'Pirata esqueleto 2', 'Pirata esqueleto 3']);
    expect(estado.mundo.combate!.resultado).toBe('victoria');
    expect(estado.jugador.inventario).toEqual([]);
  });

  it('la lanza kalinago: +2 contra no humanos (un jaguar), nada contra humanos', () => {
    const lanza: ObjetoLlevado = { id: 'lanza_kalinago' };
    const contraJaguar = de(atacar(contra('jaguar', { inventario: [lanza] }), dadosTrucados([4, 1])).sucesos, 'ataque')[0];
    expect([contraJaguar.tirada.bonificador, contraJaguar.dano]).toEqual([2, 6]);
    const contraPirata = de(atacar(contra('pirata', { inventario: [lanza] }), dadosTrucados([4, 1])).sucesos, 'ataque')[0];
    expect(contraPirata.tirada.bonificador).toBe(0);
  });

  it('el estoque: +1 al daño siempre', () => {
    const tuyo = de(atacar(contra('pirata', { inventario: [{ id: 'estoque' }] }), dadosTrucados([4, 1])).sucesos, 'ataque')[0];
    expect(tuyo.dano).toBe(5);
  });

  it('un objeto que no es de combate no se puede usar aquí', () => {
    expect(() => usarObjetoEnCombate(contra('jaguar', { inventario: [{ id: 'unguento', usosRestantes: 1 }] }), 0, dadosTrucados([]))).toThrow(/no se usa en combate/);
  });
});

describe('el retrato del jugador', () => {
  it('se elige al crear la partida: hombre o mujer', () => {
    expect(crearPartida(1, 'Anne', 'mujer').estado.jugador.retrato).toBe('mujer');
    expect(crearPartida(1, 'Jack').estado.jugador.retrato).toBe('hombre');
  });
});
