import { Component, computed, inject } from '@angular/core';
import { vasABordo } from '../../../core/mapa/donde-estas';
import type { Coordenada } from '../../../core/mapa/mapa';
import { opcionesDeEmbarque } from '../../../core/viaje/embarcar';
import { JuegoStore } from '../../../store/juego.store';
import { Navegar } from '../../servicios/navegar';
import { describirCasilla, TEXTO_SIN_EMBARQUE } from '../../textos/textos-del-mapa';

// DÓNDE ESTÁS (pantalla de pruebas, Sprint 9): ya no se elige a mano; lo dice el mapa. Enseña la
// casilla del jugador y la del barco, y los botones para desembarcar o embarcar (sin gastar la
// acción, una vez por turno, antes de elegir la acción). En el mapa, esas casillas salen en amarillo.
@Component({
  selector: 'app-donde-estas',
  templateUrl: './donde-estas.html',
  styleUrl: './donde-estas.css',
})
export class DondeEstas {
  private readonly store = inject(JuegoStore);
  private readonly navegar = inject(Navegar);

  protected readonly info = computed(() => {
    const estado = this.store.estado();
    if (!estado) return null;
    const { posicion, posicionBarco } = estado.mundo;
    const aBordo = vasABordo(estado);
    const opciones = opcionesDeEmbarque(estado);
    return {
      aBordo,
      aqui: `${describirCasilla(estado, posicion, aBordo)} (${posicion.col},${posicion.fila})`,
      barco: `${describirCasilla(estado, posicionBarco, true)} (${posicionBarco.col},${posicionBarco.fila})`,
      enAccion: estado.mundo.fase === 'accion',
      embarcar: opciones.embarcar,
      desembarcar: opciones.desembarcar.map(c => ({ casilla: c, texto: this.navegar.textoDelDesembarco(c) })),
      motivo: opciones.motivo ? TEXTO_SIN_EMBARQUE[opciones.motivo] : '',
    };
  });

  protected embarcar(): void {
    this.navegar.embarcar();
  }

  protected desembarcar(casilla: Coordenada): void {
    this.navegar.desembarcar(casilla);
  }
}
