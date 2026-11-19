import { Component, input } from '@angular/core';
import type { HojaDePersonaje } from '../../../core/personaje/hoja-de-personaje';

// LA HOJA DE PERSONAJE (pantalla de pruebas). Solo pinta: recibe la hoja ya calculada por
// core/ (hojaDePersonaje) y la semilla. No tiene reglas ni cambia nada.
@Component({
  selector: 'app-hoja-personaje',
  templateUrl: './hoja-personaje.html',
  styleUrl: './hoja-personaje.css',
})
export class HojaPersonaje {
  readonly hoja = input.required<HojaDePersonaje>();
  readonly semilla = input.required<number>();
}
