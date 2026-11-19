import { abrir, escribir, prepararJuego, pulsar, SEMILLA_DE_PRUEBA, urlActual } from '../../probar-pantallas';

describe('pantalla Nueva partida', () => {
  it('crea la partida con lo escrito y va a la partida', async () => {
    const store = prepararJuego();
    const harness = await abrir('/nueva-partida');
    const pantalla = harness.routeNativeElement!;
    escribir(pantalla, 'input[name=nombre]', '  Marta  ');
    escribir(pantalla, 'select[name=retrato]', 'mujer');
    escribir(pantalla, 'input[name=semilla]', '482913');
    pulsar(pantalla, 'Empezar');
    await harness.fixture.whenStable();

    expect(store.estado()?.jugador.nombre).toBe('Marta');
    expect(store.estado()?.jugador.retrato).toBe('mujer');
    expect(store.estado()?.mundo.semilla).toBe(482913);
    expect(urlActual()).toBe('/partida');
  });

  it('sin semilla, la saca al azar', async () => {
    const store = prepararJuego();
    const harness = await abrir('/nueva-partida');
    escribir(harness.routeNativeElement!, 'input[name=nombre]', 'Marta');
    pulsar(harness.routeNativeElement!, 'Empezar');
    await harness.fixture.whenStable();
    expect(store.estado()?.mundo.semilla).toBe(SEMILLA_DE_PRUEBA);
  });

  it('sin nombre, avisa y no empieza', async () => {
    const store = prepararJuego();
    const harness = await abrir('/nueva-partida');
    pulsar(harness.routeNativeElement!, 'Empezar');
    await harness.fixture.whenStable();
    expect(store.estado()).toBeNull();
    expect(harness.routeNativeElement!.textContent).toContain('Escribe un nombre.');
  });

  it.each(['abc', '-1', '1000000', '3.5'])('con la semilla "%s", avisa y no empieza', async semilla => {
    const store = prepararJuego();
    const harness = await abrir('/nueva-partida');
    escribir(harness.routeNativeElement!, 'input[name=nombre]', 'Marta');
    escribir(harness.routeNativeElement!, 'input[name=semilla]', semilla);
    pulsar(harness.routeNativeElement!, 'Empezar');
    await harness.fixture.whenStable();
    expect(store.estado()).toBeNull();
    expect(harness.routeNativeElement!.textContent).toContain('La semilla tiene que ser');
    expect(urlActual()).toBe('/nueva-partida');
  });

  it('enseña la crónica', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 5);
    store.abandonar();
    const harness = await abrir('/nueva-partida');
    const texto = harness.routeNativeElement!.textContent!;
    expect(texto).toContain('Marta');
    expect(texto).toContain('abandono');
  });
});
