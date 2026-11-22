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

  // Sprint 10, paso 6: trampas de eventos.
  it('lanzar un evento elegido de la lista abre su ventana (y no se puede lanzar otro encima)', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');
    const pantalla = harness.routeNativeElement!;

    escribir(pantalla, 'select[name=trampa-evento]', 'deseo');
    pulsar(pantalla, 'Lanzar el evento');
    await harness.fixture.whenStable();

    expect(store.estado()!.mundo.pilaEventos.map(m => m.evento)).toEqual(['deseo']);
    expect(pantalla.querySelector('app-ventana-de-evento')!.textContent).toContain('djinn');
    expect(pantalla.textContent).toContain('Trampa: lanzar el evento Deseo (E041)');
    expect(() => pulsar(pantalla, 'Lanzar el evento')).toThrow(/desactivado/);
  });

  it('fijar la próxima tirada de un evento: se ve el número y se puede quitar', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');
    const pantalla = harness.routeNativeElement!;

    escribir(pantalla, 'input[name=trampa-tirada]', '4');
    pulsar(pantalla, 'Fijar');
    await harness.fixture.whenStable();
    expect(pantalla.textContent).toContain('fijada: 4');

    pulsar(pantalla, 'Quitar');
    await harness.fixture.whenStable();
    expect(pantalla.textContent).not.toContain('fijada:');
  });

  it('ponerse el amuleto maldito tira sus dos tablas (bendición y maldición); en la barra salen sus partes, no él', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    const harness = await abrir('/partida');
    const pantalla = harness.routeNativeElement!;

    escribir(pantalla, 'select[name=trampa-condicion]', 'amuleto_maldito');
    pulsar(pantalla, 'Ponerme la condición');
    await harness.fixture.whenStable();

    const amuleto = store.estado()!.jugador.condiciones.find(c => c.id === 'amuleto_maldito');
    expect(amuleto?.partes?.length ?? 0).toBeGreaterThanOrEqual(1);
    const barra = pantalla.querySelector('.barra')!;
    const titulos = [...barra.querySelectorAll('.condicion')].map(e => e.getAttribute('title') ?? '');
    expect(titulos.some(t => t.startsWith('Amuleto maldito'))).toBe(false);
    expect(titulos.every(t => t.endsWith('(Amuleto maldito)'))).toBe(true);
  });
});
