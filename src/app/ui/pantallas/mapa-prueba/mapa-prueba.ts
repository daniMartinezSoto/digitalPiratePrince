import { Component, signal } from '@angular/core';
import { obtenerMapa } from '../../../core/mapa/cargar-mapas';
import { MapaDelJuego } from '../../componentes/mapa/mapa';
import type { TipoDeBarco } from '../../componentes/mapa/pintor-del-mapa';

// PANTALLA DEL MAPA DE PRUEBA (/mapa-prueba, Sprint 9): enseña el primer mapa de prueba a pantalla
// completa. No toca la partida: el barco navega libre por el agua. Las reglas del mapa (viajar,
// desembarcar...) llegarán después.
// Desplegable "Pruebas" (arriba a la derecha) para comparar opciones: rejilla, marcas de prueba
// y barco 3D o 2D. No existirá en el juego (la rejilla irá al menú de opciones).
@Component({
  selector: 'app-pantalla-mapa-prueba',
  imports: [MapaDelJuego],
  templateUrl: './mapa-prueba.html',
  styleUrl: './mapa-prueba.css',
})
export class PantallaMapaPrueba {
  protected readonly mapa = obtenerMapa('primer-mapa-prueba');
  protected readonly rejilla = signal(true);
  protected readonly marcas = signal(true);
  protected readonly barco = signal<TipoDeBarco>('3d');

  protected cambiarRejilla(evento: Event): void {
    this.rejilla.set((evento.target as HTMLInputElement).checked);
  }

  protected cambiarMarcas(evento: Event): void {
    this.marcas.set((evento.target as HTMLInputElement).checked);
  }

  protected cambiarBarco(tipo: TipoDeBarco): void {
    this.barco.set(tipo);
  }
}
