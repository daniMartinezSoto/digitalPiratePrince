import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { esSemillaValida, SEMILLA_MAXIMA } from '../../../core/partida/semilla';
import type { Retrato } from '../../../core/personaje/retrato';
import { JuegoStore } from '../../../store/juego.store';

// PANTALLA "NUEVA PARTIDA" (pantalla de pruebas): nombre, hombre o mujer y semilla opcional.
// Comprueba lo escrito (para avisar en la pantalla) y le pide la partida al store: la pantalla
// nunca crea la partida por su cuenta. También enseña la crónica.
@Component({
  selector: 'app-pantalla-nueva-partida',
  templateUrl: './nueva-partida.html',
  styleUrl: './nueva-partida.css',
})
export class PantallaNuevaPartida {
  private readonly store = inject(JuegoStore);
  private readonly router = inject(Router);

  protected readonly cronica = this.store.cronica;
  protected readonly error = signal<string | null>(null);
  protected readonly semillaMaxima = SEMILLA_MAXIMA;

  protected empezar(nombre: string, retrato: string, semillaEscrita: string): void {
    const nombreLimpio = nombre.trim();
    if (nombreLimpio === '') {
      this.error.set('Escribe un nombre.');
      return;
    }
    let semilla: number | undefined;
    if (semillaEscrita.trim() !== '') {
      semilla = Number(semillaEscrita);
      if (!esSemillaValida(semilla)) {
        this.error.set(`La semilla tiene que ser un número entero de 0 a ${SEMILLA_MAXIMA}.`);
        return;
      }
    }
    this.error.set(null);
    this.store.nuevaPartida(nombreLimpio, retrato as Retrato, semilla);
    void this.router.navigate(['/partida']);
  }
}
