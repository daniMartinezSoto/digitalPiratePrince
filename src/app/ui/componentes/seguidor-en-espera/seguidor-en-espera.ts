import { Component, computed, inject, signal } from '@angular/core';
import { TIPOS_SEGUIDOR } from '../../../core/catalogos/cargar-seguidores';
import { contratarSeguidor, opcionesDelSeguidor, rechazarSeguidor } from '../../../core/contratar/contratar';
import { seguidoresDespedibles } from '../../../core/seguidores/consultas';
import { JuegoStore } from '../../../store/juego.store';
import { Jugar } from '../../servicios/jugar';
import { lineasSimples } from '../../textos/lineas-del-registro';
import { nombreDeHabilidad, nombreDeTipoDeSeguidor } from '../../textos/textos';

// BUSCAR SEGUIDOR, paso 2 (pantalla de pruebas): quién se ofrece y a qué precio. Contratarlo o
// rechazarlo; con el grupo lleno, elegir a quién se despide (los inseparables no salen).
@Component({
  selector: 'app-seguidor-en-espera',
  templateUrl: './seguidor-en-espera.html',
  styleUrl: './seguidor-en-espera.css',
})
export class SeguidorEnEspera {
  private readonly store = inject(JuegoStore);
  private readonly jugar = inject(Jugar);

  protected readonly opciones = computed(() => {
    const estado = this.store.estado();
    return estado?.mundo.accionEnCurso?.tipo === 'seguidor' ? opcionesDelSeguidor(estado) : null;
  });
  protected readonly ficha = computed(() => {
    const id = this.opciones()?.seguidor;
    const tipo = TIPOS_SEGUIDOR.find(t => t.id === id);
    return tipo ? { ...tipo, habilidades: tipo.habilidades.map(nombreDeHabilidad) } : null;
  });
  protected readonly despedibles = computed(() => {
    const estado = this.store.estado();
    return estado ? seguidoresDespedibles(estado.jugador).map(s => ({ id: s.id, nombre: `${s.nombre} (${nombreDeTipoDeSeguidor(s.tipo)})` })) : [];
  });
  protected readonly despedir = signal<string>('');

  protected contratar(): void {
    const opciones = this.opciones();
    const despedir = opciones?.hayQueDespedir ? this.despedir() || undefined : undefined;
    const tipo = nombreDeTipoDeSeguidor(opciones?.seguidor ?? '');
    const nombre = opciones?.nombre ? `${opciones.nombre} (${tipo})` : tipo;
    this.jugar.hacer((e, d) => contratarSeguidor(e, d, despedir), (r, n) => lineasSimples(`Contratas: ${nombre}`, r, n));
  }

  protected rechazar(): void {
    this.jugar.hacer((e, d) => rechazarSeguidor(e, d), (r, n) => lineasSimples('Lo rechazas', r, n));
  }
}
