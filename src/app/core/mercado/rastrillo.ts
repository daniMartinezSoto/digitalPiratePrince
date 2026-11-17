// Formato de data/rastrillo.json: lo que puede aparecer en el rastrillo del mercado.
// Al entrar en el mercado se elige UNO, al azar y con pesos (como las listas de eventos):
// con peso 3 sale el triple de veces que con peso 1.
// Hoy solo hay objetos. Las mejoras del barco (no ocupan inventario) se decidirán con el combate naval.

export interface EntradaRastrillo {
  // Id del objeto en el catálogo (data/objetos.json).
  objeto: string;

  // Cuántas veces más sale que uno de peso 1.
  peso: number;

  // Oro que cuesta comprarlo. Tiene que ser MÁS que lo que te dan al venderlo (su precioVenta):
  // si no, comprar y vender daría oro sin hacer nada.
  precio: number;
}

export interface Rastrillo {
  objetos: EntradaRastrillo[];
}
