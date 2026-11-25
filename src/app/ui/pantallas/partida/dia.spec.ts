import { TestBed } from '@angular/core/testing';
import { aplicarEfectos } from '../../../core/efectos/aplicar-efectos';
import { Registro } from '../../servicios/registro';
import { abrir, boton, escribir, ponerEn, prepararJuego, pulsar } from '../../probar-pantallas';

/** Pulsa y espera a que la pantalla se repinte. */
async function pulsarYEsperar(harness: Awaited<ReturnType<typeof abrir>>, texto: string): Promise<void> {
  pulsar(harness.routeNativeElement!, texto);
  await harness.fixture.whenStable();
}

describe('pantalla Partida: el día con botones', () => {
  it('un día completo a bordo: empezar el día → pescar → comer → dormir → día 2', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    ponerEn(store, 'barco');
    const harness = await abrir('/partida');

    await pulsarYEsperar(harness, 'Empezar el día');
    expect(store.estado()?.mundo.fase).toBe('accion');
    await pulsarYEsperar(harness, 'Pescar');
    expect(store.estado()?.mundo.fase).toBe('comida');
    await pulsarYEsperar(harness, 'Comer de las reservas');
    expect(store.estado()?.mundo.fase).toBe('descanso');
    await pulsarYEsperar(harness, 'Dormir a bordo');

    expect(store.estado()?.mundo.dia).toBe(2);
    expect(store.estado()?.mundo.fase).toBe('inicio');
    const texto = harness.routeNativeElement!.textContent!;
    expect(texto).toContain('Amanece.');
    expect(texto).toContain('Pescar');
    expect(texto).toContain('Dormir a bordo');
    expect(TestBed.inject(Registro).entradas()).toHaveLength(4);
  });

  it('las acciones que no se pueden salen desactivadas, con su motivo', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    ponerEn(store, 'barco');
    const harness = await abrir('/partida');
    await pulsarYEsperar(harness, 'Empezar el día');

    const pantalla = harness.routeNativeElement!;
    expect(boton(pantalla, 'Cazar').disabled).toBe(true);
    expect(boton(pantalla, 'Pescar').disabled).toBe(false);
    expect(pantalla.textContent).toContain('Solo en tierra salvaje');
    expect(pantalla.textContent).toContain('Solo en puertos');
  });

  it('en un puerto se pueden usar todas sus acciones (también las de varios pasos)', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    ponerEn(store, 'puerto');
    const harness = await abrir('/partida');
    await pulsarYEsperar(harness, 'Empezar el día');

    const pantalla = harness.routeNativeElement!;
    expect(boton(pantalla, 'Ir al mercado').disabled).toBe(false);
    expect(boton(pantalla, 'Dar un discurso').disabled).toBe(false);
    expect(pantalla.textContent).not.toContain('llega en el paso 3');
  });

  it('el tesoro enterrado se recuerda por casilla: en otra casilla se puede volver a enterrar', async () => {
    const store = prepararJuego();
    store.nuevaPartida('Marta', 'mujer', 555);
    store.ejecutar((estado, dados) => aplicarEfectos(estado, [{ tipo: 'oro', cantidad: 300 }], dados));
    ponerEn(store, 'intemperie');
    const harness = await abrir('/partida');

    await pulsarYEsperar(harness, 'Empezar el día');
    await pulsarYEsperar(harness, 'Enterrar tesoro');
    await pulsarYEsperar(harness, 'Comer de las reservas');
    await pulsarYEsperar(harness, 'Dormir al raso');
    await pulsarYEsperar(harness, 'Empezar el día');

    const pantalla = harness.routeNativeElement!;
    expect(boton(pantalla, 'Enterrar tesoro').disabled).toBe(true);
    expect(pantalla.textContent).toContain('Ya has enterrado un tesoro aquí');

    ponerEn(store, { col: 5, fila: 0 }); // otra casilla de jungla
    await harness.fixture.whenStable();
    expect(boton(pantalla, 'Enterrar tesoro').disabled).toBe(false);
  });

  it('el registro apunta el inicio de la partida (el maldito de la semilla 7 ya no empieza con el deseo)', async () => {
    prepararJuego();
    const harness = await abrir('/nueva-partida');
    escribir(harness.routeNativeElement!, 'input[name=nombre]', 'Marta');
    escribir(harness.routeNativeElement!, 'input[name=semilla]', '7'); // el maldito (voz de mando + hedor)
    pulsar(harness.routeNativeElement!, 'Empezar');
    await harness.fixture.whenStable();
    const texto = harness.routeNativeElement!.textContent!;
    expect(texto).toContain('Empieza la partida (semilla 7)');
    expect(texto).not.toContain('Evento: Deseo');
    expect(harness.routeNativeElement!.querySelector('.ventana')).toBeNull();
  });
});
