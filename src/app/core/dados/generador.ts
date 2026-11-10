export class Generador {
    private estado: number;

    constructor(semilla: number) {
        this.estado = semilla;
    }


    siguiente(): number {
        let t = this.estado += 0x6D2B79F5;

        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    obtenerEstado(): number {
        return this.estado;
    }

}