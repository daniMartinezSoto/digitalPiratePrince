import { Component, computed, inject } from '@angular/core';
import { aliadosQueLuchan, opcionesDeCombate } from '../../../core/combate/combate';
import { vidaMaxActual } from '../../../core/condiciones/consultas';
import { JuegoStore } from '../../../store/juego.store';
import { Luchar } from '../../servicios/luchar';
import { NOMBRE_DE_HABILIDAD_DE_ENEMIGO, nombresDeLuchadores, TEXTO_NO_HUIR, TEXTO_NO_USAR_OBJETO } from '../../textos/textos-de-combate';
import { descripcionDeObjeto, nombreDeObjeto } from '../../textos/textos';

// EL COMBATE DE TEXTO (pantalla de pruebas): los dos bandos, quién ataca a quién y los botones (Atacar,
// Huir, objetos de combate y, con un 6, Tirar otra vez / Quedarme así). Desde el Sprint 11 el combate
// normal se juega en la ventana de combate, encima del mapa; este se queda en la pestaña Pruebas para
// ver los números en crudo, y dentro del combate naval para el abordaje. Los botones son los del
// servicio Luchar, los mismos que usa la ventana.
@Component({
  selector: 'app-combate',
  templateUrl: './combate.html',
  styleUrl: './combate.css',
})
export class Combate {
  private readonly store = inject(JuegoStore);
  protected readonly luchar = inject(Luchar);

  protected readonly combate = computed(() => this.store.estado()?.mundo.combate ?? null);
  protected readonly esAbordaje = computed(() => this.store.estado()?.mundo.combateNaval != null);
  private readonly nombres = computed(() => nombresDeLuchadores(this.store.estado()));

  protected readonly aliados = computed(() => {
    const estado = this.store.estado();
    if (!estado) return [];
    const ids = aliadosQueLuchan(estado.jugador);
    return ids.map(id => {
      if (id === 'jugador') {
        return { id, nombre: `${estado.jugador.nombre} (tú)`, vida: estado.jugador.vida, maximo: vidaMaxActual(estado.jugador) };
      }
      const s = estado.jugador.seguidores.find(x => x.id === id)!;
      return { id, nombre: s.nombre, vida: s.resistencia, maximo: s.resistenciaMaxima };
    });
  });

  protected readonly enemigos = computed(() =>
    (this.combate()?.enemigos ?? []).map(e => ({
      ...e,
      habilidadesTexto: e.habilidades.map(h => NOMBRE_DE_HABILIDAD_DE_ENEMIGO[h]).join(', '),
    })),
  );

  protected readonly parejas = computed(() =>
    Object.entries(this.combate()?.objetivos ?? {}).map(([quien, aQuien]) => `${this.nombres()[quien] ?? quien} → ${this.nombres()[aQuien] ?? aQuien}`),
  );

  protected readonly opciones = computed(() => {
    const estado = this.store.estado();
    return estado ? opcionesDeCombate(estado) : null;
  });

  protected readonly textoNoHuir = TEXTO_NO_HUIR;
  protected readonly textoNoUsar = TEXTO_NO_USAR_OBJETO;
  protected readonly nombreDeObjeto = nombreDeObjeto;
  protected readonly descripcionDeObjeto = descripcionDeObjeto;
}
