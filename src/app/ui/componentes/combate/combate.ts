import { Component, computed, inject } from '@angular/core';
import { aliadosQueLuchan, atacar, cerrarCombate, huir, opcionesDeCombate, usarObjetoEnCombate, type ResultadoRonda } from '../../../core/combate/combate';
import type { Dados } from '../../../core/dados/dados';
import { vidaMaxActual } from '../../../core/condiciones/consultas';
import type { Estado } from '../../../core/estado/estado';
import { JuegoStore } from '../../../store/juego.store';
import { Jugar } from '../../servicios/jugar';
import { lineasSimples } from '../../textos/lineas-del-registro';
import {
  lineasDeRonda,
  NOMBRE_DE_HABILIDAD_DE_ENEMIGO,
  nombresDeLuchadores,
  TEXTO_NO_HUIR,
  TEXTO_NO_USAR_OBJETO,
} from '../../textos/textos-de-combate';
import { nombreDeEvento, nombreDeObjeto } from '../../textos/textos';

// EL COMBATE (pantalla de pruebas): los dos bandos, quién ataca a quién y los botones (Atacar, Huir,
// objetos de combate). Cuando termina, "Cerrar el combate" cobra las recompensas y enseña los eventos.
// Si es el abordaje de un combate naval, lo cierra el combate naval (no este botón).
@Component({
  selector: 'app-combate',
  templateUrl: './combate.html',
  styleUrl: './combate.css',
})
export class Combate {
  private readonly store = inject(JuegoStore);
  private readonly jugar = inject(Jugar);

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

  protected atacar(): void {
    const ronda = (this.combate()?.ronda ?? 0) + 1;
    this.ronda(`Ronda ${ronda}`, (e, d) => atacar(e, d));
  }

  protected huir(): void {
    this.ronda('Huir', (e, d) => huir(e, d));
  }

  protected usar(posicion: number, objeto: string): void {
    this.ronda(`Usar ${nombreDeObjeto(objeto)}`, (e, d) => usarObjetoEnCombate(e, posicion, d));
  }

  protected cerrar(): void {
    this.jugar.hacer(
      (e, d) => cerrarCombate(e, d),
      (r, n) => [
        ...lineasSimples(`Se cierra el combate: ${r.resultado}`, r, n),
        ...r.eventos.map(ev => (ev === 'maldicion' ? '  ¡MALDITO! Evento pendiente: maldicion' : `  Evento pendiente: ${nombreDeEvento(ev)}`)),
      ],
    );
  }

  private ronda(titulo: string, regla: (estado: Estado, dados: Dados) => ResultadoRonda): void {
    const antes = this.store.estado();
    this.jugar.hacer(regla, (r, seguidores) => lineasDeRonda(titulo, r, nombresDeLuchadores(antes, r.estado), seguidores));
  }
}
