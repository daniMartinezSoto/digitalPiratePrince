import { inject, Injectable, signal } from '@angular/core';
import { vasABordo } from '../../core/mapa/donde-estas';
import type { Coordenada } from '../../core/mapa/mapa';
import { desembarcar, embarcar } from '../../core/viaje/embarcar';
import { progresoDePuertos } from '../../core/viaje/puertos-principales';
import { viajar } from '../../core/viaje/viajar';
import { JuegoStore } from '../../store/juego.store';
import { lineasDeAccion } from '../textos/lineas-del-registro';
import { describirCasilla, haciaDonde } from '../textos/textos-del-mapa';
import { Jugar } from './jugar';

// NAVEGAR (pantalla de pruebas, Sprint 9): moverse por el mapa, igual desde los botones que tocando
// el mapa. Pide las reglas al store (a través de Jugar) y apunta en el registro.
//   - eligiendoViaje: el jugador ha pulsado "Viajar…" (decidido por el autor el 21-nov: las casillas
//     de viajar solo se marcan en el mapa, en rojo, cuando se elige viajar).
//   - Embarcar y desembarcar: sus casillas salen en amarillo en el mapa cuando se puede.
@Injectable({ providedIn: 'root' })
export class Navegar {
  private readonly store = inject(JuegoStore);
  private readonly jugar = inject(Jugar);

  readonly eligiendoViaje = signal(false);

  /** "Viajar al S (6,2): La Habana (puerto principal)" (el texto de la lista y del registro). */
  textoDelViaje(destino: Coordenada): string {
    const estado = this.store.estado();
    if (!estado) return '';
    return `Viajar ${haciaDonde(estado.mundo.posicion, destino)}: ${describirCasilla(estado, destino, vasABordo(estado))}`;
  }

  /** "Desembarcar al NO (6,2): La Habana (puerto principal)". */
  textoDelDesembarco(destino: Coordenada): string {
    const estado = this.store.estado();
    if (!estado) return '';
    return `Desembarcar ${haciaDonde(estado.mundo.posicionBarco, destino)}: ${describirCasilla(estado, destino, false)}`;
  }

  viajar(destino: Coordenada): void {
    const texto = this.textoDelViaje(destino);
    this.eligiendoViaje.set(false);
    this.jugar.hacer(
      (e, d) => viajar(e, destino, d),
      (r, n) => {
        const lineas = lineasDeAccion(texto.replace(/^Viajar/, 'Viajas'), r, n);
        if (r.puertoNuevo) {
          const progreso = progresoDePuertos(r.estado);
          lineas.splice(1, 0, `  ¡Primera visita a un puerto principal! Puertos ${progreso.visitados}/${progreso.total}`);
        }
        return lineas;
      },
    );
  }

  embarcar(): void {
    this.eligiendoViaje.set(false);
    this.jugar.hacer(e => embarcar(e), (r, n) => lineasDeAccion('Subes al barco', r, n));
  }

  desembarcar(destino: Coordenada): void {
    const texto = this.textoDelDesembarco(destino);
    this.eligiendoViaje.set(false);
    this.jugar.hacer((e, d) => desembarcar(e, destino, d), (r, n) => lineasDeAccion(texto, r, n));
  }

  /** Tocar una casilla amarilla del mapa: si vas a bordo, bajas allí; si no, subes al barco. */
  embarcarODesembarcar(casilla: Coordenada): void {
    const estado = this.store.estado();
    if (!estado) return;
    if (vasABordo(estado)) this.desembarcar(casilla);
    else this.embarcar();
  }
}
