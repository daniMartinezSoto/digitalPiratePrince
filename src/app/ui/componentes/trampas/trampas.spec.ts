import { abrir, escribir, prepararJuego, pulsar } from '../../probar-pantallas';

describe('trampas de prueba', () => {
  it('−10 tripulación, +100 oro y comida a 0 cambian la partida y se apuntan en el registro', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');
    const pantalla = harness.routeNativeElement!;
    const { tripulacion, oro } = store.estado()!.jugador;

    pulsar(pantalla, '−10 tripulación');
    pulsar(pantalla, '+100 oro');
    pulsar(pantalla, 'Comida a 0');
    await harness.fixture.whenStable();

    expect(store.estado()!.jugador.tripulacion).toBe(tripulacion - 10);
    expect(store.estado()!.jugador.oro).toBe(oro + 100);
    expect(store.estado()!.jugador.comida).toBe(0);
    expect(pantalla.textContent).toContain('Trampa: −10 tripulación');
  });

  it('darse un objeto, una condición y un seguidor elegidos en la lista', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');
    const pantalla = harness.routeNativeElement!;

    escribir(pantalla, 'select[name=trampa-objeto]', 'unguento');
    pulsar(pantalla, 'Darme el objeto');
    escribir(pantalla, 'select[name=trampa-condicion]', 'tormenta');
    pulsar(pantalla, 'Ponerme la condición');
    escribir(pantalla, 'select[name=trampa-seguidor]', 'pirata_experto');
    pulsar(pantalla, 'Darme el seguidor');
    await harness.fixture.whenStable();

    const jugador = store.estado()!.jugador;
    expect(jugador.inventario.map(o => o.id)).toContain('unguento');
    expect(jugador.condiciones.map(c => c.id)).toContain('tormenta');
    expect(jugador.seguidores.map(s => s.tipo)).toContain('pirata_experto');

    pulsar(pantalla, 'Quitármela');
    await harness.fixture.whenStable();
    expect(store.estado()!.jugador.condiciones.map(c => c.id)).not.toContain('tormenta');
  });
});
