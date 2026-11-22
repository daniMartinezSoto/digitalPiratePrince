import { Dados } from '../dados/dados';
import type { Estado } from '../estado/estado';
import { crearPartida } from '../partida/crear-partida';
import type { Evento } from './evento';
import { continuarEvento, elegirOpcion, hacerChequeo, lanzarEventos, vistaDelEvento, type ResultadoMotor } from './motor';
import { validarEventos } from './validar-evento';

// Cambios del 22-nov, pedidos por el autor tras probar el borracho:
//   - menos "Continuar": al pasar a otro paso del mismo evento, lo leído se queda arriba ("anteriores") y
//     el paso siguiente sale debajo; "pausa": true para parar igualmente;
//   - al morir, el evento se queda para enseñar por qué (el mensaje de la rama, o el del evento);
//   - botones con sabor.

const EVENTOS = [
  {
    id: 'cadena',
    titulo: 'Cadena',
    muerte: 'Mueres en la cadena.',
    pasos: {
      inicio: {
        texto: 'Empieza',
        chequeo: {
          caracteristica: 'fuerza',
          boton: '¿Aguantas?',
          exito: { texto: 'Bien', paso: 'elegir' },
          fallo: { texto: 'Mal', efectos: [{ tipo: 'vida', cantidad: -1 }], paso: 'elegir', muerte: 'Te mata la caída.' },
        },
      },
      elegir: { texto: '¿Y ahora?', opciones: [{ texto: 'Seguir', paso: 'silencio' }, { texto: 'Caer', paso: 'caer' }] },
      silencio: { segun: { barco: { texto: 'A bordo' } } },
      caer: { texto: 'Te caes', efectos: [{ tipo: 'vida', cantidad: -1 }] },
    },
  },
  {
    id: 'final_mudo',
    titulo: 'Final mudo',
    pasos: {
      inicio: { texto: 'Empieza', chequeo: { caracteristica: 'fuerza', exito: { texto: 'Bien', paso: 'silencio' }, fallo: { texto: 'Mal' } } },
      silencio: { segun: { barco: { texto: 'A bordo' } } },
    },
  },
  {
    id: 'con_pausa',
    titulo: 'Con pausa',
    pasos: {
      inicio: { texto: 'Empieza', chequeo: { caracteristica: 'fuerza', exito: { texto: 'Bien', paso: 'fin', pausa: true }, fallo: { texto: 'Mal', paso: 'fin', pausa: true } } },
      fin: { texto: 'Fin', opciones: [{ texto: 'Vale' }] },
    },
  },
] as unknown as Evento[];

function estadoCon(vida = 10): Estado {
  const { estado } = crearPartida(1, 'Prueba');
  return { ...estado, jugador: { ...estado.jugador, vida, sobrenombre: 'el_fuerte', inventario: [], seguidores: [], condiciones: [] }, mundo: { ...estado.mundo, fase: 'accion' } };
}

const dados = () => new Dados(1);
const lanzar = (id: string, vida = 10) => lanzarEventos(estadoCon(vida), [id], dados(), EVENTOS);
const chequeo = (r: ResultadoMotor, dado: number) => hacerChequeo(r.estado, dados(), { dadoTrucado: dado }, EVENTOS);
const vista = (r: ResultadoMotor) => vistaDelEvento(r.estado, EVENTOS)!;

describe('sin tanto "Continuar", la muerte y los botones (22-nov)', () => {
  it('los eventos de prueba están bien escritos', () => {
    expect(validarEventos(EVENTOS)).toEqual([]);
  });

  it('el botón del chequeo viene del evento', () => {
    expect(vista(lanzar('cadena')).chequeo).toEqual({ caracteristica: 'fuerza', modificador: 0, boton: '¿Aguantas?' });
  });

  it('al pasar a otro paso, el resultado se queda arriba y el paso siguiente sale debajo con sus botones', () => {
    const r = chequeo(lanzar('cadena'), 1);
    expect(vista(r)).toMatchObject({ modo: 'opciones', texto: '¿Y ahora?' });
    expect(vista(r).anteriores).toHaveLength(1);
    expect(vista(r).anteriores[0]).toMatchObject({ texto: 'Bien', chequeo: { superado: true } });
  });

  it('al pulsar el siguiente botón, lo de antes se borra', () => {
    const r = elegirOpcion(chequeo(lanzar('cadena'), 1).estado, 1, dados(), EVENTOS);
    expect(vista(r).anteriores).toEqual([]);
    expect(vista(r)).toMatchObject({ modo: 'continuar', texto: 'Te caes' });
  });

  it('si después no hay nada más que leer y el evento se acaba, se para en "Continuar" para ver lo último', () => {
    // El éxito lleva a un paso "segun" que, fuera del barco, termina sin texto.
    const r = chequeo(lanzar('final_mudo'), 1);
    expect(r.terminado).toBe(false);
    expect(vista(r).modo).toBe('continuar');
    expect(vista(r).lectura?.texto).toBeUndefined();
    expect(vista(r).anteriores.map(l => l.texto)).toEqual(['Bien']);
    expect(continuarEvento(r.estado, dados(), EVENTOS).terminado).toBe(true);
  });

  it('con "pausa", se para en "Continuar" como antes', () => {
    let r = chequeo(lanzar('con_pausa'), 1);
    expect(vista(r)).toMatchObject({ modo: 'continuar', anteriores: [] });
    expect(vista(r).lectura!.texto).toBe('Bien');
    r = continuarEvento(r.estado, dados(), EVENTOS);
    expect(vista(r)).toMatchObject({ modo: 'opciones', texto: 'Fin', anteriores: [] });
  });

  it('al morir manda el mensaje de la rama; si no tiene, el del evento', () => {
    const porLaRama = chequeo(lanzar('cadena', 1), 6);
    expect(porLaRama.estado.mundo.finPartida!.causa).toEqual({ tipo: 'evento', evento: 'cadena', texto: 'Te mata la caída.' });
    expect(vista(porLaRama)).toMatchObject({ modo: 'muerte', texto: 'Mal' });

    const conUnaVida = chequeo(lanzar('cadena', 2), 6);
    const porElEvento = elegirOpcion(conUnaVida.estado, 1, dados(), EVENTOS);
    expect(porElEvento.estado.mundo.finPartida!.causa).toEqual({ tipo: 'evento', evento: 'cadena', texto: 'Mueres en la cadena.' });
    expect(vista(porElEvento)).toMatchObject({ modo: 'muerte', texto: 'Te caes' });
  });
});
