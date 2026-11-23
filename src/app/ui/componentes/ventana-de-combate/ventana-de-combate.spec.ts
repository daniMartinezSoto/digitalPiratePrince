import { atacar, iniciarCombate } from '../../../core/combate/combate';
import { abordar, iniciarCombateNaval } from '../../../core/combate-naval/combate-naval';
import { dadosTrucados } from '../../../core/dados/dados-trucados';
import type { Estado } from '../../../core/estado/estado';
import { TestBed } from '@angular/core/testing';
import { abrir, boton, prepararJuego, pulsar } from '../../probar-pantallas';
import { RITMO_DEL_COMBATE } from '../../servicios/luchar';
import { cartasDelCombate, SILUETAS } from './ventana-de-combate';

type Harness = Awaited<ReturnType<typeof abrir>>;

async function pulsarYEsperar(harness: Harness, texto: string): Promise<void> {
  pulsar(harness.routeNativeElement!, texto);
  await harness.fixture.whenStable();
}

/** Partida nueva con un combate contra el explorador (2 de ataque, 10 de resistencia). */
function conCombate(pedido = 'explorador') {
  const store = prepararJuego();
  store.nuevaPartida('Marta', 'mujer', 555);
  store.ejecutar((e, d) => ({ estado: iniciarCombate(e, [{ enemigo: pedido }], d) }));
  return store;
}

const ventana = (h: Harness) => h.routeNativeElement!.querySelector('.ventana-combate') as HTMLElement | null;
const carta = (h: Harness, id: string) => h.routeNativeElement!.querySelector(`.carta[data-luchador="${id}"]`) as HTMLElement;

describe('la ventana de combate', () => {
  it('sale encima del mapa con los dos bandos: cartas, barras de vida y a quién ataca cada uno', async () => {
    conCombate();
    const harness = await abrir('/partida');
    const v = ventana(harness)!;

    expect(v).toBeTruthy();
    expect(v.textContent).toContain('Combate · ronda 0');
    expect(v.textContent).toContain('Tu bando');
    expect(v.textContent).toContain('Enemigos');
    expect(carta(harness, 'jugador').textContent).toContain('Marta (tú)');
    expect(carta(harness, 'jugador').textContent).toContain('⚔ ataca a Explorador');
    expect(carta(harness, 'enemigo_1').textContent).toContain('10/10');
    expect(carta(harness, 'enemigo_1').textContent).toContain('ataque 2');
    expect((carta(harness, 'enemigo_1').querySelector('.queda') as HTMLElement).style.width).toBe('100%');
    expect((carta(harness, 'jugador').querySelector('img') as HTMLImageElement).getAttribute('src')).toBe('personaje/tokenMujer.png');
  });

  it('en el panel, Acciones dice que se lucha en el mapa y Pruebas tiene el combate en texto', async () => {
    conCombate();
    const harness = await abrir('/partida');
    const pantalla = harness.routeNativeElement!;
    expect(pantalla.textContent).toContain('Hay un combate en curso: lucha en la ventana del mapa.');
    expect(pantalla.textContent).toContain('El combate en texto (para probar)');
  });

  it('Atacar desde la ventana juega la ronda: la barra del enemigo baja', async () => {
    const store = conCombate();
    const harness = await abrir('/partida');
    for (let i = 0; i < 10 && store.estado()!.mundo.combate!.enemigos[0].resistencia === 10 && !store.estado()!.mundo.combate!.rondaEnPausa; i++) {
      await pulsarYEsperar(harness, 'Atacar');
    }
    const enemigo = store.estado()!.mundo.combate!.enemigos[0];
    if (!store.estado()!.mundo.combate!.rondaEnPausa) {
      expect(enemigo.resistencia).toBeLessThan(10);
      expect(carta(harness, 'enemigo_1').textContent).toContain(`${enemigo.resistencia}/10`);
    }
    expect(store.estado()!.mundo.combate!.ronda).toBeGreaterThan(0);
  });

  it('con un 6: las barras enseñan en translúcido lo que van a perder y salen los botones del 6', async () => {
    const store = conCombate();
    store.ejecutar(e => atacar(e, dadosTrucados([6, 4]))); // tu 6; el explorador acierta (2)
    const harness = await abrir('/partida');
    const v = ventana(harness)!;

    expect(v.textContent).toContain('¡SEIS!');
    expect(v.textContent).toContain('Llevas 6 (6 de daño)');
    expect(() => boton(v, 'Atacar')).toThrow(); // mientras decides, solo los botones del 6
    expect((carta(harness, 'enemigo_1').querySelector('.pierde') as HTMLElement).style.width).toBe('60%');
    expect(carta(harness, 'enemigo_1').textContent).toContain('(−6)');
    expect(carta(harness, 'jugador').textContent).toContain('(−2)');

    await pulsarYEsperar(harness, 'Quedarme así');
    expect(store.estado()!.mundo.combate!.enemigos[0].resistencia).toBe(4);
    expect(carta(harness, 'enemigo_1').querySelector('.pierde')!.getAttribute('style') ?? '').toContain('width: 0%');
    expect(boton(ventana(harness)!, 'Atacar')).toBeTruthy();
  });

  it('al terminar: el resultado y "Cerrar el combate" (el día sigue donde estaba)', async () => {
    const store = conCombate('pescador'); // 1 de ataque, 5 de resistencia
    const harness = await abrir('/partida');
    for (let i = 0; i < 40 && !store.estado()!.mundo.combate?.resultado && !store.estado()!.mundo.finPartida; i++) {
      const v = ventana(harness)!;
      if (v.textContent!.includes('¡SEIS!')) await pulsarYEsperar(harness, 'Quedarme así');
      else await pulsarYEsperar(harness, 'Atacar');
    }
    expect(ventana(harness)!.textContent).toMatch(/¡VICTORIA!|Os ponéis a salvo|DERROTA/);
    await pulsarYEsperar(harness, 'Cerrar el combate');
    expect(store.estado()!.mundo.combate).toBeNull();
    if (!store.estado()!.mundo.finPartida) {
      // después de cerrar, la tarjeta con lo conseguido (o "No hay nada que recoger") hasta "Continuar"
      expect(ventana(harness)!.classList).toContain('cierre');
      await pulsarYEsperar(harness, 'Continuar');
    }
    expect(ventana(harness)).toBeNull();
  });

  it('la tarjeta final: rondas, derrotados, la vida perdida y el botín; al cerrar, lo cobrado', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    store.ejecutar((e, d) => ({ estado: iniciarCombate(e, [{ enemigo: 'jaguar', recompensa: [{ tipo: 'oro', cantidad: 7 }] }], d) }));
    const harness = await abrir('/partida');
    // Ronda 1 desde la ventana, con dados de verdad; después se gana a mano (6: el jaguar ya cae).
    store.ejecutar(e => atacar(e, dadosTrucados([6, 4]))); // tu 6 lo tumba; el jaguar te da 4
    await harness.fixture.whenStable();
    const v = ventana(harness)!;

    expect(v.querySelector('.tarjeta-final')!.textContent).toContain('¡VICTORIA!');
    expect(v.textContent).toContain('1 ronda');
    expect(v.textContent).toContain('Derrotados: Jaguar');
    expect(v.textContent).toContain('Hay botín que recoger');

    const oro = store.estado()!.jugador.oro;
    await pulsarYEsperar(harness, 'Cerrar el combate');
    expect(store.estado()!.jugador.oro).toBe(oro + 7);
    expect(ventana(harness)!.textContent).toContain('¡VICTORIA!');
    expect(ventana(harness)!.textContent).toMatch(/[Oo]ro/);
    await pulsarYEsperar(harness, 'Continuar');
    expect(ventana(harness)).toBeNull();
  });

  it('la vida perdida se cuenta desde la primera ronda jugada en la ventana', async () => {
    const store = conCombate('pescador');
    const harness = await abrir('/partida');
    const vidaAlEmpezar = store.estado()!.jugador.vida;
    for (let i = 0; i < 40 && !store.estado()!.mundo.combate?.resultado && !store.estado()!.mundo.finPartida; i++) {
      if (ventana(harness)!.textContent!.includes('¡SEIS!')) await pulsarYEsperar(harness, 'Quedarme así');
      else await pulsarYEsperar(harness, 'Atacar');
    }
    const perdida = vidaAlEmpezar - store.estado()!.jugador.vida;
    expect(ventana(harness)!.textContent).toContain(perdida > 0 ? `Has perdido ${perdida} PV` : 'No has perdido vida');
  });

  it('se puede plegar para mirar el mapa, y volver', async () => {
    conCombate();
    const harness = await abrir('/partida');
    await pulsarYEsperar(harness, 'Plegar');
    expect(ventana(harness)).toBeNull();
    await pulsarYEsperar(harness, 'Combate en curso (volver a la ventana)');
    expect(ventana(harness)).toBeTruthy();
  });

  it('el abordaje de un combate naval no sale en la ventana (se juega en el panel del naval)', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    store.ejecutar((e, d) => ({ estado: abordar(iniciarCombateNaval(e, 'chalupa_de_pescadores', d), d) }));
    const harness = await abrir('/partida');
    expect(store.estado()!.mundo.combate).not.toBeNull();
    expect(ventana(harness)).toBeNull();
    expect(harness.routeNativeElement!.textContent).toContain('Abordaje');
  });
});

describe('la animación de la ventana de combate', () => {
  const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

  /** Como conCombate, pero con animación (rapidísima). */
  function conAnimacion() {
    // Antes de preparar el juego (después ya no se puede cambiar).
    TestBed.overrideProvider(RITMO_DEL_COMBATE, { useValue: { dados: 30, paso: 30, mensaje: 200 } });
    return conCombate();
  }

  async function refrescar(h: Harness, ms: number): Promise<void> {
    await esperar(ms);
    h.fixture.detectChanges();
    await h.fixture.whenStable();
  }

  it('al pulsar Atacar: primero las barras de antes y "Rápido"; luego los mensajes, uno a uno; al final, vuelven los botones', async () => {
    const store = conAnimacion();
    const harness = await abrir('/partida');
    pulsar(ventana(harness)!, 'Atacar');
    harness.fixture.detectChanges();

    const v = () => ventana(harness)!;
    expect(boton(v(), 'Rápido ⏩')).toBeTruthy();
    expect(() => boton(v(), 'Atacar')).toThrow(); // los botones esperan
    expect(carta(harness, 'enemigo_1').textContent).toContain('10/10'); // aún caen los dados: como antes
    expect(v().querySelectorAll('.mensaje, .mensaje-central').length).toBe(0);

    await refrescar(harness, 45); // ya ha salido el primer mensaje
    expect(v().querySelectorAll('.mensaje, .mensaje-central').length).toBeGreaterThan(0);

    const pasos = store.estado()!.mundo.combate!.rondaEnPausa ? 1 : 6;
    await refrescar(harness, 30 * (pasos + 2));
    const combate = store.estado()!.mundo.combate!;
    if (!combate.rondaEnPausa && !combate.resultado) {
      expect(boton(v(), 'Atacar')).toBeTruthy();
      expect(carta(harness, 'enemigo_1').textContent).toContain(`${combate.enemigos[0].resistencia}/10`);
    }
  });

  it('"Rápido" salta al final: se ve cómo ha quedado todo y se puede seguir', async () => {
    const store = conAnimacion();
    const harness = await abrir('/partida');
    pulsar(ventana(harness)!, 'Atacar');
    harness.fixture.detectChanges();
    pulsar(ventana(harness)!, 'Rápido ⏩');
    harness.fixture.detectChanges();

    expect(() => boton(ventana(harness)!, 'Rápido ⏩')).toThrow();
    expect(ventana(harness)!.querySelectorAll('.mensaje, .mensaje-central').length).toBe(0);
    const combate = store.estado()!.mundo.combate!;
    expect(carta(harness, 'enemigo_1').textContent).toContain(combate.enemigos[0].resistencia > 0 ? `${combate.enemigos[0].resistencia}/10` : 'Caído');
  });

  it('el historial desplegable guarda cada ronda con sus dados y sus mensajes (lo más nuevo arriba)', async () => {
    conCombate();
    const harness = await abrir('/partida');
    pulsar(ventana(harness)!, 'Atacar');
    await harness.fixture.whenStable();
    const v = ventana(harness)!;
    if (v.textContent!.includes('¡SEIS!')) pulsar(v, 'Quedarme así');
    else pulsar(v, 'Atacar');
    await harness.fixture.whenStable();

    const historial = ventana(harness)!.querySelector('.historial') as HTMLDetailsElement;
    expect(historial.querySelector('summary')!.textContent).toMatch(/Historial del combate \(2\)/);
    const rondas = [...historial.querySelectorAll('.ronda-del-historial strong')].map(e => e.textContent);
    expect(rondas[rondas.length - 1]).toBe('Ronda 1');
    expect(historial.querySelector('.dadito')).toBeTruthy();
    expect(historial.querySelector('li')).toBeTruthy();
  });
});

describe('cartasDelCombate', () => {
  it('los caídos salen como caídos y ya no atacan a nadie', () => {
    const store = conCombate('pescador');
    const estado = store.estado()!;
    const muerto: Estado = {
      ...estado,
      mundo: { ...estado.mundo, combate: { ...estado.mundo.combate!, enemigos: estado.mundo.combate!.enemigos.map(e => ({ ...e, resistencia: 0 })) } },
    };
    const { aliados, enemigos } = cartasDelCombate(muerto);
    expect(enemigos[0]).toMatchObject({ caido: true, atacaA: null, vida: 0, maximo: 5 });
    expect(aliados[0]).toMatchObject({ id: 'jugador', esJugador: true, ataque: null });
  });
});

describe('las siluetas de las cartas', () => {
  it('sin dibujo en su ficha, cada enemigo lleva la silueta de su categoría y los seguidores la suya', () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const seguidor = { id: 'forzudo_1', tipo: 'forzudo', nombre: 'Rufus', ataque: 3, resistencia: 10, resistenciaMaxima: 10, habilidades: [] };
    store.ejecutar((e, d) => ({
      estado: iniciarCombate(
        { ...e, jugador: { ...e.jugador, seguidores: [seguidor] } },
        [{ enemigo: 'pirata' }, { enemigo: 'jaguar' }, { enemigo: 'pirata_esqueleto' }, { enemigo: 'golem_guardian' }],
        d,
      ),
    }));
    const { aliados, enemigos } = cartasDelCombate(store.estado()!);

    expect(enemigos.map(c => c.imagen)).toEqual([SILUETAS.humano, SILUETAS.animal, SILUETAS.no_muerto, SILUETAS.criatura]);
    expect(enemigos.every(c => c.silueta)).toBe(true);
    expect(aliados.find(c => c.id === 'forzudo_1')).toMatchObject({ imagen: SILUETAS.seguidor, silueta: true });
    expect(aliados.find(c => c.id === 'jugador')).toMatchObject({ imagen: 'personaje/tokenMujer.png', silueta: false });
  });

  it('cada luchador sabe el id de su rival (para dibujar la línea)', () => {
    const store = conCombate();
    const { aliados, enemigos } = cartasDelCombate(store.estado()!);
    expect(aliados[0].rival).toBe('enemigo_1');
    expect(enemigos[0].rival).toBe('jugador');
  });
});
