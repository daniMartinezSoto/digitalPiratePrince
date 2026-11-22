import type { Estado } from '../../../core/estado/estado';
import { vistaDelEvento } from '../../../core/eventos/motor';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { esSemillaValida, SEMILLA_MAXIMA } from '../../../core/partida/semilla';
import type { Retrato } from '../../../core/personaje/retrato';
import { JuegoStore } from '../../../store/juego.store';
import { Registro } from '../../servicios/registro';
import { nombreDeEvento, textoDeSobrenombre } from '../../textos/textos';

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
  private readonly registro = inject(Registro);

  protected readonly cronica = this.store.cronica;
  protected readonly error = signal<string | null>(null);
  protected readonly semillaMaxima = SEMILLA_MAXIMA;
  protected readonly textoDeSobrenombre = textoDeSobrenombre;

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
    const eventos = this.store.nuevaPartida(nombreLimpio, retrato as Retrato, semilla);
    this.registro.vaciar();
    this.registro.apuntar(1, [
      `Empieza la partida (semilla ${this.store.estado()?.mundo.semilla}).`,
      ...eventos.map(e => `  Evento pendiente: ${nombreDeEvento(e)}`),
      ...eventoAbierto(this.store.estado()),
    ]);
    void this.router.navigate(['/partida']);
  }
}

/** Si la partida empieza con un evento (el deseo de "el maldito"), lo apunta: "Evento: Deseo". */
function eventoAbierto(estado: Estado | null): string[] {
  const vista = estado ? vistaDelEvento(estado) : null;
  return vista ? [`  Evento: ${vista.titulo}`] : [];
}
