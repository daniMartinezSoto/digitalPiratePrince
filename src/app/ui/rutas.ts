import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Routes } from '@angular/router';
import { JuegoStore } from '../store/juego.store';
import { PantallaNuevaPartida } from './pantallas/nueva-partida/nueva-partida';
import { PantallaPartida } from './pantallas/partida/partida';

// LAS RUTAS DEL JUEGO (pantalla de pruebas).
//   / (o una dirección que no existe) → a /partida si hay una partida en curso; si no, a /nueva-partida.
//   /nueva-partida → crear personaje (si hay una partida en curso, a /partida).
//   /partida       → la partida (si no hay ninguna, ni terminada, a /nueva-partida).

/** Solo se entra si NO hay una partida en curso. */
const sinPartidaEnCurso: CanActivateFn = () =>
  inject(JuegoStore).hayPartidaEnCurso() ? inject(Router).parseUrl('/partida') : true;

/** Solo se entra si hay partida (en curso o recién terminada, para ver el final). */
const conPartida: CanActivateFn = () =>
  inject(JuegoStore).estado() !== null ? true : inject(Router).parseUrl('/nueva-partida');

/** A dónde ir al abrir el juego (o con una dirección que no existe). */
const alPrincipio = (): string => (inject(JuegoStore).hayPartidaEnCurso() ? '/partida' : '/nueva-partida');

export const RUTAS: Routes = [
  { path: '', pathMatch: 'full', redirectTo: alPrincipio },
  { path: 'nueva-partida', component: PantallaNuevaPartida, canActivate: [sinPartidaEnCurso] },
  { path: 'partida', component: PantallaPartida, canActivate: [conPartida] },
  { path: '**', redirectTo: alPrincipio },
];
