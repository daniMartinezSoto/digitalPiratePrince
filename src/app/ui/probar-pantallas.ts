import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AlmacenEnMemoria } from '../core/guardado/almacen-en-memoria';
import { ALMACEN, GENERAR_SEMILLA, JuegoStore, RELOJ } from '../store/juego.store';
import { RUTAS } from './rutas';

// AYUDAS SOLO PARA LOS TESTS DE LAS PANTALLAS (no las usa el juego).

export const SEMILLA_DE_PRUEBA = 123456;

/** Prepara el juego con un almacén de mentira (el navegador no se toca). */
export function prepararJuego(almacen = new AlmacenEnMemoria()): JuegoStore {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(RUTAS),
      { provide: ALMACEN, useValue: almacen },
      { provide: RELOJ, useValue: () => '2026-11-19T12:30:00.000Z' },
      { provide: GENERAR_SEMILLA, useValue: () => SEMILLA_DE_PRUEBA },
    ],
  });
  return TestBed.inject(JuegoStore);
}

/** Abre el juego en esa dirección y devuelve el "navegador de pruebas". */
export async function abrir(url: string): Promise<RouterTestingHarness> {
  const harness = await RouterTestingHarness.create(url);
  await harness.fixture.whenStable();
  return harness;
}

export function urlActual(): string {
  return TestBed.inject(Router).url;
}

/** Escribe en un campo (input o select) como lo haría el jugador. */
export function escribir(raiz: HTMLElement, selector: string, valor: string): void {
  const campo = raiz.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
  campo.dispatchEvent(new Event('change'));
}

/** El botón que tiene ese texto (sin contar espacios de más). */
export function boton(raiz: HTMLElement, texto: string): HTMLButtonElement {
  const limpio = (t: string | null) => (t ?? '').replace(/\s+/g, ' ').trim();
  const encontrado = [...raiz.querySelectorAll('button')].find(b => limpio(b.textContent) === texto);
  if (!encontrado) {
    throw new Error(`No hay ningún botón "${texto}"`);
  }
  return encontrado;
}

/** Pulsa el botón que tiene ese texto, como lo haría el jugador. Falla si está desactivado. */
export function pulsar(raiz: HTMLElement, texto: string): void {
  const encontrado = boton(raiz, texto);
  if (encontrado.disabled) {
    throw new Error(`El botón "${texto}" está desactivado`);
  }
  encontrado.click();
}
