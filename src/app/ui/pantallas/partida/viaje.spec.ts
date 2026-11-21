import { aplicarEfectos } from '../../../core/efectos/aplicar-efectos';
import { abrir, boton, ponerEn, prepararJuego, pulsar } from '../../probar-pantallas';

type Harness = Awaited<ReturnType<typeof abrir>>;

async function pulsarYEsperar(harness: Harness, texto: string): Promise<void> {
  pulsar(harness.routeNativeElement!, texto);
  await harness.fixture.whenStable();
}

/** Pulsa el botón cuyo texto empieza por eso. */
async function pulsarQueEmpieza(harness: Harness, inicio: string): Promise<void> {
  const b = [...harness.routeNativeElement!.querySelectorAll('button')].find(x => (x.textContent ?? '').replace(/\s+/g, ' ').trim().startsWith(inicio));
  if (!b) throw new Error(`No hay ningún botón que empiece por "${inicio}"`);
  b.click();
  await harness.fixture.whenStable();
}

describe('pantalla Partida: viajar por el mapa, el barco, puertos y victoria', () => {
  it('"Dónde estás" lo dice el mapa: al empezar, a pie en la jungla profunda y el barco junto a La Habana', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');
    const texto = harness.routeNativeElement!.textContent!;
    expect(texto).toContain('Estás en Jungla profunda (6,0), a pie');
    expect(texto).toContain('El barco está en Costa (7,2)');
  });

  it('viajar a pie hasta La Habana: salen las casillas vecinas y el puerto queda visitado', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    ponerEn(store, { col: 6, fila: 1 });
    const harness = await abrir('/partida');
    const pantalla = harness.routeNativeElement!;
    expect(pantalla.textContent).toContain('Puertos 0/4');

    await pulsarYEsperar(harness, 'Empezar el día');
    await pulsarYEsperar(harness, 'Viajar…');
    await pulsarQueEmpieza(harness, 'Viajar al S (6,2): La Habana (puerto principal)');

    expect(store.estado()?.mundo.fase).toBe('comida');
    expect(store.estado()?.mundo.posicion).toEqual({ col: 6, fila: 2 });
    expect(store.estado()?.mundo.puertosVisitados).toEqual(['la_habana']);
    expect(pantalla.textContent).toContain('Puertos 1/4');
    expect(pantalla.textContent).toContain('Estás en La Habana (puerto principal) (6,2), a pie');
  });

  it('embarcar en La Habana (sin gastar la acción) y navegar', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    ponerEn(store, 'puerto');
    const harness = await abrir('/partida');
    await pulsarYEsperar(harness, 'Empezar el día');
    await pulsarYEsperar(harness, 'Embarcar');

    expect(store.estado()?.mundo.posicion).toEqual({ col: 7, fila: 2 });
    expect(store.estado()?.mundo.fase).toBe('accion');
    expect(harness.routeNativeElement!.textContent).toContain('a bordo');
    expect(harness.routeNativeElement!.textContent).toContain('Ya has subido o bajado del barco hoy');

    await pulsarYEsperar(harness, 'Viajar…');
    await pulsarQueEmpieza(harness, 'Viajar al');
    const { posicion, posicionBarco } = store.estado()!.mundo;
    expect(posicion).toEqual(posicionBarco); // el barco va contigo
  });

  it('desembarcar en La Habana desde el barco', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    ponerEn(store, 'barco');
    const harness = await abrir('/partida');
    await pulsarYEsperar(harness, 'Empezar el día');
    await pulsarQueEmpieza(harness, 'Desembarcar al NO (6,2): La Habana');

    expect(store.estado()?.mundo.posicion).toEqual({ col: 6, fila: 2 });
    expect(store.estado()?.mundo.puertosVisitados).toEqual(['la_habana']);
    expect(store.estado()?.mundo.fase).toBe('accion');
  });

  it('al llegar al 4.º puerto con 10 de fama, VICTORIA y a la crónica', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    store.ejecutar((e, d) => aplicarEfectos(e, [{ tipo: 'fama', cantidad: 10 }], d));
    store.ejecutar(e => ({ estado: { ...e, mundo: { ...e.mundo, puertosVisitados: ['tortuga', 'port_royal', 'nassau'] } } }));
    ponerEn(store, { col: 6, fila: 1 });
    const harness = await abrir('/partida');
    await pulsarYEsperar(harness, 'Empezar el día');
    await pulsarYEsperar(harness, 'Viajar…');
    await pulsarQueEmpieza(harness, 'Viajar al S (6,2)');

    expect(store.estado()?.mundo.finPartida).toEqual({ resultado: 'victoria', motivo: 'fama_y_puertos' });
    expect(harness.routeNativeElement!.textContent).toContain('PARTIDA TERMINADA · VICTORIA');
    expect(store.cronica()[0]).toMatchObject({ resultado: 'victoria', motivo: 'fama_y_puertos' });
  });

  it('con tormenta, "Viajar…" sale desactivado con su motivo', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');
    await pulsarYEsperar(harness, 'Empezar el día');
    // La tormenta, ya en la fase de acción (al amanecer podría amainar).
    store.ejecutar((e, d) => aplicarEfectos(e, [{ tipo: 'poner_condicion', condicion: 'tormenta' }], d));
    await harness.fixture.whenStable();
    expect(boton(harness.routeNativeElement!, 'Viajar…').disabled).toBe(true);
    expect(harness.routeNativeElement!.textContent).toContain('No puedes: Tormenta');
  });

  it('abrir "Viajar…" y luego desembarcar: la lista se cierra y salen las acciones de la casilla nueva', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    ponerEn(store, 'barco');
    const harness = await abrir('/partida');
    await pulsarYEsperar(harness, 'Empezar el día');
    await pulsarYEsperar(harness, 'Viajar…');
    expect(harness.routeNativeElement!.textContent).toContain('Viajar: ¿a qué casilla?');

    await pulsarQueEmpieza(harness, 'Desembarcar al NO (6,2): La Habana');

    const pantalla = harness.routeNativeElement!;
    expect(pantalla.textContent).not.toContain('Viajar: ¿a qué casilla?');
    expect(boton(pantalla, 'Ir al mercado').disabled).toBe(false); // estás en un puerto y la acción no se ha gastado
  });
});
