import { Dados } from '../dados/dados';
import { crearPartida } from '../partida/crear-partida';
import { comer } from './comer';
import { descansar } from './descansar';
import { iniciarTurno } from './iniciar-turno';

// Las tres fases juntas, con el catálogo real del juego. La fase de acción todavía
// no existe (Sprint 6): aquí se salta a mano, pasando de "accion" a "comida".
describe('un día completo', () => {
  it('amanecer, (acción), comida y descanso: empieza el día siguiente', () => {
    const { estado: inicial, dados } = crearPartida(2024, 'Marta');
    expect(inicial.mundo).toMatchObject({ dia: 1, fase: 'inicio' });

    const amanecer = iniciarTurno(inicial, dados);
    expect(amanecer.estado.mundo.fase).toBe('accion');

    // Aquí iría la acción del jugador.
    const trasLaAccion = { ...amanecer.estado, mundo: { ...amanecer.estado.mundo, fase: 'comida' as const } };

    const comida = comer(trasLaAccion, 'reservas', 'barco', dados);
    expect(comida.haComido).toBe(true);
    expect(comida.estado.jugador.comida).toBe(4);
    expect(comida.estado.mundo.fase).toBe('descanso');

    const noche = descansar(comida.estado, 'a_bordo', 'barco', dados);
    expect(noche.estado.mundo).toMatchObject({ dia: 2, fase: 'inicio' });
  });

  it('una semana en el mar sin pescar: la comida se acaba, llega el hambre y no se rompe nada', () => {
    const { estado: inicial } = crearPartida(7, 'Marta');
    const dados = new Dados(inicial.mundo.estadoDados);
    let estado = inicial;

    for (let dia = 1; dia <= 7 && !estado.mundo.finPartida; dia++) {
      estado = iniciarTurno(estado, dados).estado;
      if (estado.mundo.fase === 'accion') {
        estado = { ...estado, mundo: { ...estado.mundo, fase: 'comida' } };
      }
      estado = comer(estado, 'reservas', 'barco', dados).estado;
      if (!estado.mundo.finPartida) {
        estado = descansar(estado, 'a_bordo', 'barco', dados).estado;
      }
    }

    // Empieza con 5 reservas: come 5 días y pasa hambre 2.
    expect(estado.mundo.dia).toBe(8);
    expect(estado.jugador.comida).toBe(0);
    expect(estado.jugador.diasSinComer).toBe(2);
    expect(estado.jugador.condiciones.map(c => c.id)).toContain('hambre');
    // Pierde 1 + 2 PV por el hambre (15 → 12). Las dos noches con hambre puede recuperar 1 PV
    // cada una, si duerme genial: acaba entre 12 y 14.
    expect(estado.jugador.vida).toBeGreaterThanOrEqual(12);
    expect(estado.jugador.vida).toBeLessThanOrEqual(14);
    // El estado sigue siendo solo datos.
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
  });
});
