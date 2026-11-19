import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { hojaDePersonaje } from '../../../core/personaje/hoja-de-personaje';
import { JuegoStore, type AvisoDeGuardado } from '../../../store/juego.store';
import { DondeEstas } from '../../componentes/donde-estas/donde-estas';
import { HojaPersonaje } from '../../componentes/hoja-personaje/hoja-personaje';
import { PanelDelDia } from '../../componentes/panel-del-dia/panel-del-dia';
import { RegistroDeLaPartida } from '../../componentes/registro/registro';
import { Trampas } from '../../componentes/trampas/trampas';
import { NOMBRE_DE_FASE } from '../../textos/textos';
import { UBICACION_INICIAL, type Ubicacion } from '../../ubicacion';

const TEXTO_DE_AVISO: Record<AvisoDeGuardado, string> = {
  no_se_pudo_guardar: 'No se ha podido guardar la partida (¿modo incógnito o sin espacio?).',
  partida_no_recuperada: 'No se ha podido recuperar tu partida guardada.',
  cronica_estropeada: 'La crónica estaba estropeada: se ha guardado una copia aparte.',
};

// PANTALLA DE LA PARTIDA (pantalla de pruebas): junta el "¿dónde estás?", el panel del día, el
// registro y la hoja del personaje, más los avisos del guardado y el botón Abandonar (con confirmación). Si la partida ha
// terminado, lo dice y ofrece empezar otra. Todo lo que cambia la partida se pide al store.
@Component({
  selector: 'app-pantalla-partida',
  imports: [HojaPersonaje, DondeEstas, PanelDelDia, RegistroDeLaPartida, Trampas],
  templateUrl: './partida.html',
  styleUrl: './partida.css',
})
export class PantallaPartida {
  private readonly store = inject(JuegoStore);
  private readonly router = inject(Router);

  protected readonly estado = this.store.estado;
  protected readonly hoja = computed(() => {
    const estado = this.store.estado();
    return estado ? hojaDePersonaje(estado.jugador) : null;
  });
  protected readonly avisos = computed(() => this.store.avisos().map(aviso => TEXTO_DE_AVISO[aviso]));
  protected readonly confirmandoAbandono = signal(false);
  protected readonly nombreDeFase = NOMBRE_DE_FASE;
  /** Dónde está el jugador (elegido a mano hasta que exista el mapa). */
  protected readonly ubicacion = signal<Ubicacion>(UBICACION_INICIAL);

  protected abandonar(): void {
    this.store.abandonar();
    this.confirmandoAbandono.set(false);
  }

  protected nuevaPartida(): void {
    void this.router.navigate(['/nueva-partida']);
  }

  protected descartarAvisos(): void {
    this.store.descartarAvisos();
  }
}
