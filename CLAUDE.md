# Pirate Prince (versión digital): contexto del proyecto

> Documento de traspaso y guía para cualquier IA que ayude con el proyecto (Claude Code, ChatGPT...). Va en la raíz del repositorio como `CLAUDE.md`. Las reglas y el mapa están en `docs/`. **Hay que mantenerlo al día** cuando se tomen decisiones nuevas.

---

## 0. Estado actual del proyecto

**Repositorio:** https://github.com/daniMartinezSoto/digitalPiratePrince (público, rama `main`). Ruta local: `C:\DigitalPiratePrince\digital-pirate-prince`.

**Entorno:** Windows 11 · Node `v26.13.0` · npm `11.20.0` · Angular CLI `22.2.6` · Angular 22 con **standalone components y signals**, SCSS, routing, sin SSR · tests con **Vitest `5.1.0`** (`ng test`) · `"resolveJsonModule": true`.

**Progreso**
- **Sprint 0: completado.** Proyecto, tests, Git/GitHub y estructura `core/ data/ store/ ui/`.
- **Sprint 1: completado (dados).** `core/dados/` contiene:
  - `Generador` (mulberry32): `siguiente()` y `obtenerEstado()`.
  - `tirar(expresion, generador)` y `ResultadoTirada { dados, total }`. Admite **cualquier número de dados y caras con multiplicador opcional** (`1d6`, `2d6`, `1d6x5`, `1d11`, `2d8`...).
  - `Dados`: envuelve un `Generador`; expone `tirar(expresion)` y `obtenerEstado()`. **Una única instancia por partida**.
  - `Dados` **no es un signal ni forma parte del estado**: solo se guarda su número interno en `mundo.estadoDados`.
  - Aún no existen en `Dados`: `probabilidad(p)` (para los % de deserción/motín), `elegirPonderado(lista)` y `entero(min, max)`. Se añaden en el Sprint 3; nunca usar `Math.random()`.
- **Sprint 2: completado (estado y personaje).**
  - Interfaces en `core/estado/` y datos en `data/personaje/`.
  - `crearPersonaje(nombre, dados)` en `core/personaje/`.
  - `crearPartida(semilla, nombre)` en `core/partida/crear-partida.ts` devuelve `{ estado, dados }`; guarda `dados.obtenerEstado()` en `mundo.estadoDados` DESPUÉS de crear el personaje. Constante `VERSION_ESTADO = 1`.
  - El estado sobrevive a `JSON.stringify` / `JSON.parse` y un `Dados` creado con `estadoDados` continúa la misma secuencia (ambos con test).
- **Tests:** 24 pasan en 5 archivos (`generador` 3, `tirada` 5, `dados` 5, `crear-personaje` 5, `crear-partida` 6).

**Siguiente:** Sprint 3. Métodos nuevos en `Dados` (`entero`, `probabilidad`, `elegirPonderado`), resolvedor de tablas por rangos, modificadores por identificador de tirada y primeras tablas en `data/tablas/` (pesca, caza, buscar información). No incluye aplicar efectos al estado (Sprint 4). Antes de las tablas de pesca y caza hay que decidir si son 1d6 o 2d6 (sección 5). El plan detallado por sprints lo mantiene el autor en un documento aparte.


---

## 1. Qué es el proyecto

Adaptación a videojuego de **Pirate Prince**, un juego de aventuras **en solitario de papel y lápiz** del autor (Daniel Martínez Soto, v0.1 Alpha, inspirado en *Barbarian Prince* de Arnold Hendrick). El jugador es un joven pirata con un barco heredado que quiere hacerse una leyenda.

- Un solo jugador, por turnos, muy basado en texto.
- Única interfaz gráfica "mecánica": un **mapa de hexágonos** por el que te mueves.
- Cada turno es un día. Se elige **una acción** según el hexágono, se resuelve con dados y tablas, y puede encadenar **eventos** (textos con decisiones, tiradas, combates, objetos...).
- **Objetivo:** conseguir **10 puntos de Fama** y haber visitado los 3 puertos principales (3 puertos concretos de los varios que hay). **Se pierde** si la vida del personaje o la tripulación del barco llegan a 0.
- El autor puede **cambiar reglas al digitalizar**: lo que en papel existe para ahorrar cuentas o guiar al jugador puede automatizarse o simplificarse.

En `docs/`: el PDF de reglas (24 páginas; **no incluye el libro de eventos**) y el mapa prototipo (hecho con Worldographer). El archivo `.wxx` del mapa está pendiente de añadir.

## 2. Sobre el autor y cómo trabajar con él

- Programador web junior; nunca ha hecho aplicaciones ni juegos. Trabaja con **Angular** y PHP en backend; quiere aprender **Spring** más adelante.
- Idioma: español. **Quiere entender y controlar cada pieza del proyecto**: explicar el porqué de cada decisión, con ejemplos de su juego, en pasos pequeños y sin jerga innecesaria.
- Proponer antes de construir (plan del sprint antes de escribir código). Si una regla del PDF es ambigua o parece un error, **preguntar** en vez de decidir en silencio.
- **Convención de nombres:** código y carpetas en español (`pescar`, `estado`, `jugador`, `mundo`, `core`...). Los nombres propios de Angular (`signal`, `Injectable`...) quedan en inglés.
- Al terminar cada sprint: commit, push y actualizar la sección 0.

---

## 3. Decisiones tomadas

### 3.1 Stack
- **Solo frontend. No hay backend.** El guardado es local en el navegador. Un backend (cuentas, ranking, nube; quizá con Spring o Supabase/Firebase) queda para el futuro, pero el diseño debe permitirlo.
- **Angular** (standalone + signals). No se usa Vite aparte.
- **Mapa en SVG** (un polígono por hexágono).
- **Tests unitarios desde el principio** para `core/`.

### 3.2 Estructura de carpetas

```
src/app/
├── core/   ← REGLAS DEL JUEGO. TypeScript puro. NO importa nada de Angular.
├── data/   ← JSON de solo lectura: tablas, personaje, enemigos, mapas, eventos.
├── store/  ← estado de la partida (un signal) + puente entre ui y core.
└── ui/     ← componentes: pintan el estado y avisan de las acciones. Sin reglas.
```

- **Aquí `core/` significa "lógica del juego", no "servicios globales de Angular".**
- Reglas de oro: **`core/` no importa Angular** y **`ui/` no contiene reglas del juego.**
- Los tests (`.spec.ts`) van junto al código. Las subcarpetas de `core/` se crean cuando toca su sprint. Existen ya: `core/dados/`, `core/estado/`, `core/personaje/`; datos en `data/personaje/`.

### 3.3 Flujo de una acción

```
ui → store → core → store → ui
```
1. `ui` avisa de la acción (p. ej. `store.pescar()`).
2. `store` lee el estado actual de su signal y se lo pasa a `core`.
3. `core` aplica las reglas y devuelve el resultado (**funciones sin memoria**).
4. `store` guarda el estado nuevo en el signal.
5. `ui` se repinta sola.

- **Todo lo que MODIFICA el estado pasa por el store.** La `ui` puede llamar directamente a funciones de `core` que solo **consultan**.
- Las funciones de acción reciben el **estado completo**; las auxiliares, solo la parte que necesitan.
- Fuera de `core/dados/`, nadie usa el `Generador` directamente: solo `Dados`.

```ts
// store/juego.store.ts
estado = signal<Estado>(...);
pescar() { this.estado.update(e => aplicarEfectos(e, pescar(e, this.dados))); }
```

### 3.4 Estado (implementado en `core/estado/`)
**Solo datos (serializable a JSON):** sin funciones, clases con métodos, referencias circulares, `Map`, `Set` ni `Date`. Se actualiza **sin mutar** (`{ ...estado, ... }`).

```ts
Estado  { version: number; jugador: Jugador; mundo: Mundo }

Jugador { nombre: string;            // lo elige el jugador
          sobrenombre: string;       // id del sobrenombre
          vida, vidaMax, fuerza, ingenio: number;
          oro, tripulacion, tripulacionMax, comida: number;
          fama, famaObjetivo: number;
          diasSinComer: number;      // contador único del grupo
          inventario: Articulo[]; capacidadInventario: number;
          seguidores: Seguidor[] }   // máximo 3

Mundo   { mapaId: string | null;
          posicion: { col, fila } | null;
          dia: number;
          banderas: Record<string, boolean | number | string>;   // hechos generales
          marcas: { col, fila, evento }[];                       // cosas colocadas en hexágonos
          pilaEventos: { evento, paso }[];
          puertosVisitados: string[];                            // ids de puertos principales
          estadoDados: number }                                  // dados.obtenerEstado()

Seguidor { id:string; tipo: string; nombre: string; ataque: number;          // ataque = daño que hace si acierta
           resistencia, resistenciaMaxima: number;                // resistencia = su vida
           habilidades: Habilidad[] }

Articulo { id, nombre, descripcion; tipo: 'pasivo' | 'activo';
           usosMaximos, usosRestantes: number }   // pasivos permanecen; activos se descartan al agotarse

Habilidad { id, nombre, descripcion; tipo: 'pasiva' | 'activa' }  // sin cooldowns
```

- No hay interfaz `Personaje` separada: el protagonista es `Jugador`.
- **`banderas` vs `marcas`:** banderas = hechos generales (hex de barco agotado, audiencia vetada...); marcas = elementos en coordenadas concretas (un tesoro marcado).
- La **definición del mapa** (`data/`) no cambia durante la partida; lo que cambia va en `mundo`. El guardado almacena el id del mapa, no el mapa.

**Por decidir (antes del sprint indicado):**
- `Mundo`: ¿modo `'barco' | 'tierra'`, `posicionBarco` (dónde queda atracado al ir a pie) y **bodega** (oro y objetos guardados en el barco, que no cuentan para "lo que llevas encima")? Antes del Sprint 5/9.
- `Articulo`/`Habilidad` guardan nombre y descripción dentro del estado. Mejor: **catálogo en `data/`** y en el estado solo `{ id, usosRestantes }`, para que corregir un texto no deje partidas antiguas con la versión vieja. Antes de crear el primer objeto real (Sprint 6).

### 3.5 Acciones y efectos
- Una acción (p. ej. `pescar`) calcula **qué consigue** y lo devuelve como **efectos** (`Efecto[]`, p. ej. "+8 comida"). No suma nada por su cuenta. Mira el estado solo para lo que necesita (bonificadores, ubicación...).
- **`aplicarEfectos(estado, efectos)` es el ÚNICO sitio que modifica el estado:** aplica topes (tripulación máx. 40, comida ≥ 0, vida sin superar su valor original, inventario de 5), reglas especiales (el contable, el afortunado) y detecta la derrota. Así esas reglas se escriben una sola vez.

### 3.6 Decisiones obligatorias desde el día uno
1. **Estado serializable** (ver 3.4).
2. **Dados con semilla (seeded PRNG)**, nunca `Math.random()`: partidas reproducibles, depuración por semilla y, a futuro, verificación en servidor. Incluye los porcentajes (deserción, motín): usar un método de `Dados`.
3. **`banderas` y `marcas`** en el estado y **modificadores por identificador de tirada** (sección 7).

### 3.7 Guardado
- **Autoguardado** al final de cada turno (localStorage o IndexedDB; valorar `navigator.storage.persist()`).
- **Exportar/importar** la partida como JSON.
- Campo **`version`** para migrar partidas antiguas.
- Posibles ranuras múltiples. "Meditar" del monasterio puede reconvertirse en guardado manual o conservarse como limitación (pendiente decidir).

### 3.8 Cambios respecto al juego de papel (decididos por el autor)
- **Eventos aleatorios:** no existen las tablas de terreno de coordenadas (2d6 columna/fila). Cada terreno tiene una **lista de eventos (unos 30-40) entre los que se elige uno al azar**, con **pesos** (por defecto, cada repetición del libro = +1; si el autor prefiere probabilidades iguales, peso 1). Igual para el evento nocturno.
- **Combate naval:** se sustituirá por un minijuego de habilidad. Provisionalmente, pares/impares (contrato en la sección 8).
- **Sobrenombre:** se elige con **`1d11` (uniforme)**, no con 2d6, o a elección. Las características con `1d3` (equivale al 1d6 del papel).
- **Seguidores:** **sin inventario propio y sin necesidad de comer**. Su "ataque" es el daño que hacen al acertar. Descansar los cura.
- **Comida:** una sola reserva por turno para todo el grupo (ver 4.6).
- **Objetivo:** 10 de fama **y** haber visitado los 3 puertos principales de cada mapa (ver sección 6).
- **El veneno no existe** de momento. **Las notas azules del PDF se ignoran.**

---

## 4. Reglas del juego (papel, con los cambios digitales ya aplicados)

### 4.1 Turno
Cada turno = un día, con tres fases en orden:
1. **Acción** (una sola, según el tipo de hexágono). Puede encadenar eventos que deben resolverse **todos** antes de pasar a la siguiente fase.
2. **Comida** (obligatoria).
3. **Alojamiento** (depende de dónde estés).

### 4.2 Creación de personaje

**Sobrenombre** (digital: `1d11` uniforme o elegir; los 11 están en `data/personaje/sobrenombres.json` con `id`, `nombre`, `descripcion` y `ajustes`):

| Sobrenombre | Efecto |
|---|---|
| El maldito | Empieza con un amuleto maldito (evento E027) |
| El conformista | Solo necesita 8 de fama para ganar (`ajustes`: famaObjetivo −2) |
| El nativo | Descansa gratis en aldeas; +1 al solicitar audiencias en aldeas (cuenta como "seguidor nativo" para varias reglas) |
| El fuerte | +1 Fuerza, +2 espacios de inventario (`ajustes` definidos) |
| El navegante | Avanza 2 hexes al viajar en barco |
| El superviviente | En jungla espesa no necesita comer y avanza 2 hexes |
| El influyente | +1 en buscar información; +1 en solicitar audiencia en puertos y guaridas pirata |
| El afortunado | Puede evitar la muerte una vez |
| El contable | Cada vez que gana oro, gana 2d6 más |
| El hermano | Empieza con un seguidor aleatorio gratuito. Si el seguidor muere, se pierde la partida |
| El heredero | Empieza con un objeto mágico de la lista del evento E037 (no puede salir el ídolo, el 12) |

Solo los `ajustes` numéricos (fuerte, conformista) están implementados. Los efectos especiales **no se simulan** hasta que existan los sistemas que necesitan.

**Características** (digital `1d3`): 1 *Fuerte* (Ingenio 2, Fuerza 4); 2 *Equilibrado* (3/3); 3 *Inteligente* (Ingenio 4, Fuerza 2).
**Chequeo de Fuerza o Ingenio:** tirar 1d6 y sacar el valor de la característica **o menos**. Los piden algunos eventos.
**Valores iniciales:** Vida 15 · Oro 50 · Tripulación 40 (también el máximo) · Comida 5 reservas · Fama 0 · famaObjetivo 10 · capacidad de inventario 5.

### 4.3 Inventario y seguidores
- **Inventario del jugador: 5 objetos** (tesoros y objetos especiales). En el **barco se guardan todos los que se quiera** (no significa que estén a salvo). **Comida y oro tienen su propio contador.**
- **Seguidores [digital]:** máximo 3. Datos: tipo, nombre, **ataque** (daño al acertar), **resistencia** (vida) y habilidades. Salvo indicación, resistencia 10 y ataque 2. **Sin inventario y sin necesidad de comer.** Atacan en combate. Al descansar se curan igual que el jugador.

### 4.4 Tipos de hexágono
Playa, jungla, jungla profunda, costa, alta mar, puerto, aldea, monasterio, naufragio, ruinas, barco, abundancia (+ guarida pirata). Modelo de datos en la sección 6.

### 4.5 Acciones (solo una por turno; según hexágono)
Viajar · Buscar información (puertos y aldeas) · Descansar y cazar/pescar · Contratar seguidores o tripulación (puertos) · Vender/comprar comida (puertos y aldeas) · Solicitar audiencia (puertos, aldeas, guaridas pirata) · Enterrar tesoro (tierra, jungla, playa) · Visitar monasterio · Investigar naufragio · Registrar ruinas. Algunos objetos y seguidores añaden acciones (Artista, Carpintero).

**Viajar (cualquier hex):**
- Mueve **1 hexágono en cualquier dirección** (el navegante y el superviviente permiten más).
- Tras moverse, **1d6: par → evento; impar → nada**.
- Si hay evento: **en digital**, se elige un evento de la **lista ponderada del terreno** (color) del hexágono de destino.
- **Hex de barco:** la primera vez que se entra **no se tira**; se agota (pasa a alta mar normal) y se lee **E008**.
- **Hex de abundancia:** pescar es más eficaz (E005).
- **Adentrarse en tierra:** se puede desembarcar en jungla, playa o puerto; **no se puede atracar en jungla profunda**. Al llegar a tierra desde el barco viajando, **no se tira evento**. Se anota dónde queda el barco; los seguidores acompañan siempre. **Volver al barco** automáticamente si se tienen tantas reservas de comida como hexágonos hay hasta el barco (se descartan), o turno a turno viajando.

**Buscar información (3d6).** En puerto se pueden gastar 5 de oro para +1 al dado (hasta 3 veces). En aldea, +1 con seguidor nativo o sobrenombre "el nativo".

| 3d6 | Resultado |
|---|---|
| 3 | Te roban: pierdes la mitad del oro que llevas |
| 4 | No pasa nada |
| 5 | Haces amigos: la próxima vez que busques información o contrates en este hex, +1 |
| 6 | Cubil de contrabandistas vacío: puedes saquearlo (+50 oro); no se puede repetir en este hex (salvo con "bigote falso") |
| 7 | Bob el vendedor ambulante: comprar en la tabla de E017 |
| 8 | Cartógrafo: E079 |
| 9-12 | Taberna clandestina: E081 |
| 13 | Bruja vudú: E066 |
| 14 | Mercado de esclavos: E082 |
| 15 | Contrabandista: E083 |
| 16 | Subasta secreta: E084 |
| 17 | Rumores sobre un lugar, se dibuja en un mapa: E024 |
| 18 | Alguacil, audiencia con el gobernador: E042 |

**Contratar tripulación o seguidores (en puerto; una cosa u otra, nunca ambas).**
- *Discurso (1d6):* 1 multa de 1d6 de oro (si no se tiene, E023) · 2 nadie hace caso · 3 +5 tripulación · 4 +1d6 · 5 +2d6 · 6 +3d6.
- *Con oro:* tirar 1d6×5 = marineros disponibles; cada 1 de oro pagado = +1 tripulación.
- *Seguidores (2d6)* [sin inventario ni comida]. Por defecto resistencia 10 y ataque 2:

| 2d6 | Seguidor | Notas |
|---|---|---|
| 2-3 | Pirata anciano retirado | Gratis. Resistencia 6 |
| 4 | Cocinero (30 oro) | **Habilidad por rehacer** (la original, "todo el grupo come con 1 reserva", ya no aplica) |
| 5 | Hombre nativo (45 oro, se compra su libertad) | Resistencia 12. Seguidor nativo: descanso gratis en aldeas, +1 audiencias en aldeas |
| 6 | Forzudo (25 oro) | Ataque 3 |
| 7 | Artista (35 oro) | Ataque 1. Acción en puertos **Mendigar**: +2d6 oro, luego 1d6: con 1 te descubre un guardia (E057) |
| 8 | Cartógrafo | E079 |
| 9 | Barbero-cirujano (40 oro) | +1 al solicitar audiencia; cura 2 PV al descansar en vez de 1 |
| 10 | Navegante (30 oro) | Avanza 2 hexes por mar |
| 11 | Carpintero (40 oro) | No ataca (pero puede ser atacado). Acción en el barco **Reparar**: 10 oro → +1d6 tripulación |
| 12 | Pirata experto (60 oro) | Resistencia 12, ataque 3 |

**Descansar y cazar/pescar.** El **jugador** elige **una**: descansar, pescar o cazar. (Pescar y cazar son solo del jugador.)
- *Descansar:* en puerto o aldea no pasa nada. En el barco, 1d6: con 1-2 se elige un evento de la lista del terreno (costa o alta mar). En otro hex, 1d6: con 1-2, evento de la lista de **eventos nocturnos**. **Cura 1 PV al jugador y a los seguidores** (si no hubo combate); no supera el valor original. El barbero-cirujano cura 2.
- *Pescar:* en hex de agua o adyacente a agua. Aplicar bonificadores y tirada (el PDF dice **2d6**, pero la tabla va de 1 a 6; ver sección 5): 1 nada · 2-3 → 8 reservas · 4-5 → 12 · 6 → 15 (**reservas de comida**).
- *Cazar:* en hex de tierra sin puerto ni aldea. Tirada (PDF: **2d6**, tabla de 1 a 6): 1 nada · 2-3 +10 reservas y −1 PV · 4-5 +10 reservas · 6 +15 reservas.
- Las cantidades de pesca/caza estaban pensadas para un grupo que gastaba una reserva por miembro: **hay que reequilibrarlas** (sección 5).

**Comprar y vender comida (puertos y aldeas).** 1d6: 1 alguien que solo compra · 2-3 alguien que solo vende · 4-6 mercado (compra y venta). En puertos: comprar a 2 de oro la reserva, vender a 1. En aldeas no aceptan monedas: objeto normal = 4 reservas, objeto mágico = 10 reservas (con seguidor nativo se puede usar oro como en los puertos).

**Solicitar audiencia (1d6).**
- *Gobernador (puerto):* 1 guardia te reconoce (E057) y no puedes repetir en este puerto · 2-3 denegada hoy, mañana +1 (no acumulable, solo al día siguiente) · 4 atiende su hija (E044) · 5-6 permitida (E042).
- *Jefe de aldea:* +1 con seguidor nativo, amuleto kalinago o sobrenombre "el nativo". 1 ofendes y no puedes volver · 2 no se permite · 3 denegada hoy, mañana +1 · 4-6 permitida (E043).
- *Capitán pirata (guarida):* +1 por cada 2 puntos de fama. 1-2 ofendes y no puedes volver · 3 no se permite · 4+ permitida (E045).
- Otros modificadores: barbero-cirujano +1, influyente +1 en puertos y guaridas, nativo +1 en aldeas.

**Visitar monasterio (una de tres):** *Rezar* (descartar maldición, amuleto vudú o amuleto maldito; se pierden sus facultades) · *Descansar* (10 de oro por personaje: recupera toda la vida de ese personaje) · *Meditar* (guardar partida). Descansar gratis en la fase de alojamiento si se está en un monasterio.

**Investigar naufragio (1d6):** 1-2 barco maldito (1d6: 1-3 superar E078; 4 *corregido por el autor en su versión*; 5-6 superar E085), al superarlo 1d6×10 de oro y un tesoro (E036) · 3 guarida pirata (E038) · 4-5 hogar de alguien (1d6: 1 E086, 2 E071, 3 E076, 4 E072, 5 E083, 6 E075) · 6 restos antiguos (E053 y E021).

**Enterrar tesoro (tierra, jungla, playa; no agua, puerto ni aldea):** 100 de oro = **1 de Fama**. Añadiendo un objeto mágico: +1 fama adicional (máximo 2 por entierro). No se puede enterrar solo un objeto mágico.

**Registrar ruinas (2d6):** 2 E022 · 3 E049 · 4 E053 dos veces · 5 E078 y, si se supera, cofre E021 · 6-7 ciudad pirata neutral: E038 yendo directo al punto 3 · 8-9 E040 · 10 gruta E088 · 11 lámpara mágica: 1d6, con 3+ lee E045 · 12 recibes "el ídolo antediluviano" (si ya lo tienes, E037).

### 4.6 Fase de comida [digital]
- Cada turno se gasta **1 reserva de comida** (o **1 de oro** en puerto/aldea) y con eso come **todo el grupo**: jugador, seguidores y tripulación.
- **Si no se come:** `diasSinComer` (contador único) sube. Cada **seguidor se marcha** con probabilidad **`10 + 10 × diasSinComer` %** (20% el primer día, 30% el segundo...; tope 100%) y, con la misma fórmula, puede haber **motín de la tripulación** (es un evento, ver sección 8). Tiradas **independientes** (una por seguidor y otra para el motín), con un método de `Dados`, no con `Math.random()`.
- **Inanición del jugador** (acumulativa; se restaura al comer): **−1 al dado de ataque** y **−1 PV** por día. (En papel también reducía la capacidad de carga a la mitad: por decidir si se mantiene.) Si la vida fuera a ser 0 por la fase de comida: 1d6, con 1 muere, con 2+ vive un día más.

### 4.7 Fase de alojamiento
- **En el barco (hex de mar):** se omite.
- **En puerto:** habitación 2 de oro/noche, hasta 2 personajes. Si no se alquila: noche en la calle, sin eventos nocturnos pero **no cuenta como descanso**, y por cada seguidor 1d6: con 1-2 deserta.
- **En aldea:** con seguidor nativo o sobrenombre "el nativo" se descansa como en el barco; con amuleto kalinago se puede entregar para dormir gratis siempre. Si no, 1d6 (+1 por cada objeto entregado como regalo): 1 ofendes (chequeo de Ingenio: éxito → noche a la intemperie pero puedes seguir en la aldea; fallo → debes irte, próximo turno obligatoriamente viajar, y si vuelves mueres) · 2 duermes a la intemperie con tirada de evento nocturno · 3 duermes a las afueras sin evento nocturno pero sin descanso, seguidores 1d6 (1-2 deserta) · 4-7 descansas · 8+ descansas y un nativo se une (seguidor nativo).
- **A la intemperie:** 1d6, con 1-2 evento nocturno (lista ponderada de eventos nocturnos). La deserción de seguidores también ocurre por dormir a la intemperie o sin alojamiento, con la tirada de arriba.

### 4.8 Combate
Por rondas hasta que un bando huye o es eliminado. **El daño se aplica a la vez.** Cada ronda se emparejan luchadores (si un bando supera al otro, uno puede enfrentarse a varios). Todos lanzan 1d6 y restan daño a la resistencia del rival.
- **Jugador:** 1 falla · 2-5 daño igual al dado · 6 daño 6 y vuelve a tirar acumulando; si en algún momento sale 1, falla todo el ataque (daño 0).
- **Enemigos y seguidores (solo ataque y resistencia):** 1-2 falla · 3-5 daño = su ataque · 6 su ataque +1.
- Resistencia 0 = muere. Si el jugador llega a 0, pierde la partida. Si ambos caen a la vez, el jugador asestó el golpe de gracia y se queda con 1 PV.
- **Huida (tras cualquier ronda; no se puede huir de combates dentro del barco):** el jugador tira 1d6, con 4+ huye. Si falla, los enemigos **no pueden fallar** su próximo ataque.

### 4.9 Combate naval (papel; se sustituirá por un minijuego, vale como versión provisional)
Barcos enemigos con **Daño** (tripulación que pierdes por cada fallo tuyo) y **Resistencia** (aciertos necesarios).
1. **Apuntar:** declarar "pares" o "impares". 2. **Disparar:** 1d6. Acierto si coincide (resistencia −1); fallo: pierdes tripulación igual al Daño. 3. Repetir hasta derrotarlo o retirarse.
- Al ganar se puede organizar una fiesta (E007; puede salir bien o mal).
- Huir en cualquier momento, pero **obliga a leer E006** (daño en la bodega).

### 4.10 Cómo se gana fama
Eventos concretos del libro (derrotar a un enemigo poderoso, lugar legendario, navegar de forma extraordinaria...), la acción Enterrar tesoro, y conseguir un objeto mágico.

### 4.11 Referencias a eventos vistas en las reglas (aún sin contenido)
E001 (inicio), E005 (pesca en abundancia), E006 (daño en la bodega), E007 (fiesta), E008 (hex de barco), E017 (Bob el vendedor), E021 (cofre), E022, E023 (multa sin oro / herido grave), E024 (rumores/dibujar lugar), E027 (amuleto maldito), E036 (tesoro de barco maldito), E037 (lista de objetos mágicos), E038 (guarida pirata), E040, E042-E045 (audiencias), E049, E053 (cadáveres), E057 (guardia), E066 (bruja vudú), E071-E072, E075-E076, E078, E079 (cartógrafo), E081-E086, E088.

---

## 5. Dudas y fallos detectados en las reglas

| Tema | Estado |
|---|---|
| Inventario 5 vs 10 | **Resuelto:** 5 objetos; en el barco, ilimitado. Comida y oro aparte |
| Pesca: unidad | **Resuelto:** reservas de comida |
| Inanición y "valor de ataque" | **Resuelto:** el jugador ataca 1d6, −1 por día de inanición |
| Naufragio, falta el 4 | **Resuelto** por el autor en su versión |
| Chequeos de Fuerza | **Resuelto:** 1d6 ≤ Fuerza |
| Notas azules / veneno | **Ignorar** |
| Pesca y caza: el PDF dice 2d6 pero las tablas van de 1 a 6 | **Pendiente:** ¿1d6 (errata) o reescribir la tabla para 2d6? |
| Reequilibrar pesca/caza y precio de la comida | **Pendiente:** ahora una reserva alimenta a todo el grupo, así que las cantidades de papel (8-15) son demasiado generosas |
| Cocinero | **Pendiente:** su habilidad original ya no aplica; darle otra o quitarlo |
| Inanición: ¿capacidad de carga a la mitad? | **Pendiente decidir** |
| Victoria: ¿se gana al cumplir las dos condiciones o al entrar en un puerto después? Supuestos: "visitado" = entrar en el hex; el conformista también debe visitar los 3; el puerto de inicio cuenta si es principal | **Pendiente** (sprint de la condición de victoria) |
| "Meditar" / guardado como mecánica | **Pendiente decidir** |
| Dónde empieza el jugador | No indicado; cada mapa declara su casilla de inicio |
| Motín: la tabla pegada tiene dos filas "1" (la segunda será el 2) y la opción 3 ("Te escondes") no dice si da modificador | **Pendiente** al programar el evento |

---

## 6. Mapa

### Modelo de datos: terreno y rasgo son cosas distintas
El color del hexágono es el **terreno**; el icono dibujado encima es el **rasgo**. Un hexágono siempre tiene terreno y casi siempre carece de rasgo.

```ts
type Terreno = "alta_mar" | "costa" | "jungla" | "jungla_profunda" | "playa";
type Rasgo = "puerto" | "aldea" | "monasterio" | "naufragio"
           | "ruinas" | "barco" | "abundancia" | "guarida_pirata";

interface Hexagono { col: number; fila: number; terreno: Terreno; rasgo?: Rasgo; }
```

- **El terreno decide la lista de eventos aleatorios** al viajar (aunque haya icono de puerto, se usa el color). También decide agua/tierra y dónde se puede atracar.
- **El rasgo decide qué acciones hay disponibles.**
- Hay **5 listas de eventos por terreno + 1 de eventos nocturnos** (ponderadas, sección 7).
- Los rasgos **cambian durante la partida** (el hex de barco se agota): la definición del mapa es fija y lo que cambia va en `estado.mundo`.

### Puertos principales (condición de victoria)
Cada mapa declara **3 puertos principales** (concretos, entre los varios puertos que tiene); el resto son puertos normales que no cuentan para la victoria. `mundo.puertosVisitados` guarda sus ids. La `ui` debe mostrar el progreso ("Puertos 1/3") y señalarlos en el mapa.

### El mapa prototipo
- **30 columnas × 20 filas** (etiquetas `col.fila`: de 000.000 a 029.019), ~600 hexágonos.
- Hexágonos de **punta plana (flat-top)** con columnas impares desplazadas media casilla hacia abajo. Convertir por dentro a coordenadas axiales/cúbicas para vecinos y distancias (referencia: guía de hexágonos de Red Blob Games).
- Colores: alta mar (azul oscuro), costa (azul claro), jungla (verde claro), jungla profunda (verde oscuro), playa (amarillo).
- Rasgos: puerto (ancla) sobre playa/jungla, aldea (hachas cruzadas) sobre jungla profunda, monasterio (iglesia) sobre jungla, naufragio sobre playa, ruinas (castillo) sobre jungla profunda, barco y abundancia (pez) sobre agua. La calavera de 009.000 probablemente es una guarida pirata (confirmar).

### Varios mapas, sin generador aleatorio
El autor creará **2 o 3 mapas a mano**; al empezar una partida se elige uno (aleatorio con la semilla del juego, y/o menú).

```
data/mapas/<id>.json → { id, nombre, columnas, filas, inicio: {col,fila},
                         puertosPrincipales: [{col,fila} x3], hexagonos: [...] }
```
Ningún código debe asumir 30×20. Al cargar un mapa, comprobar que tiene exactamente 3 puertos principales y que cada uno es de verdad un puerto.

### Origen de los datos: Worldographer
Los mapas se dibujan con **Worldographer**. Su archivo `.wxx` es (según documentación de librerías de terceros para la versión 1.73) **XML comprimido en gzip y codificado en UTF-16**, con *tiles* (terreno) y *features* (iconos). Plan: **un script que convierta el `.wxx` al JSON del mapa**, reutilizable; hay que verificarlo con el archivo real (pendiente). Al dibujar: un único tipo de terreno por color y un icono distinto, siempre el mismo, por rasgo.

---

## 7. Tablas de dados y listas de eventos con pesos

Casi todas las acciones son **tablas de dados**, y deben ser **datos, no código**.

1. **Por rangos** (suma de dados): pesca, caza, información, reclutar, ruinas, naufragio, audiencias...
2. **Lista ponderada de eventos** (sustituye a las cuadrículas de terreno del papel): una lista por terreno y otra de eventos nocturnos, con pesos.

```json
{ "terreno": "jungla", "eventos": [
    { "evento": "E031", "peso": 3 }, { "evento": "E012", "peso": 1 }, { "evento": "E077", "peso": 2 } ] }
```
Al ser una lista, se puede evitar el mismo evento dos veces seguidas, retirar los de una sola vez, o exigir condiciones.

```json
{ "id": "pesca", "dado": "2d6", "modificadores": ["pesca"], "filas": [
    { "min": 1, "max": 1, "texto": "No pescas nada" },
    { "min": 2, "max": 3, "efectos": [{ "tipo": "comida", "cantidad": 8 }] },
    { "min": 8, "max": 8, "evento": "E079" } ] }
```

Una sola función genérica en `core` (Sprint 3): tira el dado, aplica modificadores, busca la fila y devuelve **efectos** o un **evento**. Los efectos son datos con vocabulario común (oro, comida, tripulación, vida, fama, objeto, seguidor, bandera...). Si un evento referenciado aún no existe, el juego muestra "evento EXXX pendiente".

### Modificadores por identificador
Sobrenombres, seguidores y objetos suman bonificadores (nativo, barbero-cirujano, influyente, navegante...). Para evitar `if`s sueltos: **cada tirada tiene un identificador** (`buscar_info`, `audiencia_aldea`, `audiencia_puerto`, `mover_barco`, `pesca`, `caza`...) y cada sobrenombre/seguidor/objeto **declara sus modificadores sobre esos identificadores**.

---

## 8. Sistema de eventos (diseño; aún no se programa)

Un **evento** es una mini-historia compuesta de **pasos con nombre**. Un paso tiene texto, puede tener `efectos`, y **una** forma de continuar:

| Tipo de paso | Qué hace |
|---|---|
| `continuar` | pasa a otro paso |
| `opciones` | el jugador elige (con `requiere` opcional: oro, objeto, bandera...) |
| `tirada` | tira un dado; la fila elegida da efectos, texto, salto o fin |
| `chequeo` | 1d6 ≤ Fuerza/Ingenio con salida de éxito y de fallo |
| `combate` / `combate_naval` | lanza un combate; devuelve `victoria`, `huida` o `derrota` |
| `especial` | llama a una función registrada por nombre |
| `fin` | termina el evento |

Combinan patrones: solo tirada (la cabaña de la jungla), solo decisión, o decisión + tirada (la cueva: ¿explorar o ignorar?; si exploras, el dado decide qué hay).

### Pila de eventos
La pila va **dentro del estado serializable** (`mundo.pilaEventos`, para que el autoguardado funcione a mitad de un evento). Cada marco guarda `{ evento, paso }`. Dos saltos:
- **`ir_evento` (sin vuelta):** el evento actual se sustituye por el nuevo (la pila no crece). Ej.: taberna → pelea con un borracho.
- **`llamar_evento` (con vuelta):** el actual queda en pausa, se resuelve el otro y se vuelve al paso indicado, que puede depender del resultado (`al_volver: { victoria, huida, derrota }`).
- Al terminar un evento se saca de la pila. **Pila vacía = fase de acción terminada → fase de comida.** Límite de profundidad (p. ej. 20) para detectar bucles.
- Una fila de tabla con `"evento": "E0XX"` es un `ir_evento` o `llamar_evento`.
- **Pila ≠ "resuelto":** la pila es temporal; las **banderas del mundo** son permanentes. No mezclarlas.

### El combate no es un evento
En papel hay un evento por enemigo; en digital el combate es una **herramienta de `core`** a la que cada evento pasa enemigos y que devuelve un resultado. Los enemigos van en un **bestiario** (`data/enemigos.json`) por id; los únicos de un evento pueden ir inline. "Un pirata débil, fuerte o dos" es una tirada cuyas filas lanzan combates distintos. Opciones del bloque: `enemigos`, `puede_huir` (falso dentro del barco)... La huida fallida y la participación de seguidores son reglas de `core`. El **estado del combate en curso** va en el estado serializable.

**Contrato del combate naval (para sustituirlo por un minijuego):** el paso recibe el barco enemigo y devuelve `victoria`, `huida` o `derrota` más la tripulación perdida; huir enlaza con E006. Cómo se juegue por dentro es indiferente al resto. Empezar con pares/impares y cambiarlo después por el minijuego (componente de Angular, probablemente canvas). Aviso a futuro: un minijuego de habilidad no es reproducible con semilla, así que ese tramo no se podría verificar en servidor si hay ranking.

### Reglas especiales (~10% de eventos raros)
Cada una es una **función registrada por nombre**, en su propio archivo y con su test; el JSON solo la referencia (`{ "tipo": "especial", "nombre": "marcar_tesoro_en_mapa" }`). **Regla de oro: toda regla especial guarda su información en banderas y marcas del estado serializable.** Puntos de enganche:
1. **Estado del mundo extensible:** `banderas` y `marcas` por hexágono.
2. **Disparadores por hexágono:** al entrar, si el hex tiene una marca con evento, se lanza antes de la tirada de viaje (mapa del tesoro → cofre, hex de barco, pistas tipo E024).
3. **Modificadores por identificador de tirada** (sección 7).
4. **Condiciones y efectos con nombre** (`requiere`).

El mapa del tesoro no toca el mapa de `data/`: solo añade una marca a `estado.mundo.marcas`, y la `ui` pinta el mapa más las marcas.

### Evento conocido: "Motín a bordo" (lo lanza la fase de comida; se programará en el Sprint 11-12)
Buen caso de prueba: junta decisión, chequeo y tirada, y llama a otros eventos.
- **Elegir una opción y después tirar 1d6:**
  1. Ir a por el líder: chequeo de Fuerza (éxito: +1 a la tirada; fallo: −2 PV).
  2. Convencer con la palabra: chequeo de Ingenio (éxito: +1; fallo: −1).
  3. Esconderse (¿modificador? por definir).
- **Tirada:** 1 te pasan por la quilla (1d6, con 5+ sobrevives y lees E023; si no, mueres) · 2 motín violento, quedas gravemente herido (E023) · 3 ganas pero pierdes 2d6 de tripulación y lees E006 · 4 mediación: acuerdo temporal · 5 tu apoyo es decisivo, las cosas mejoran; puedes organizar una fiesta (E007) · 6 unificas las facciones: +1 punto de fama.

---

## 9. Orden general de trabajo

Los eventos van **después** del núcleo (detalle en el documento de sprints del autor):
1. ✅ Dados con semilla.
2. 🔄 Estado serializable y creación de personaje/partida.
3. Resolvedor de tablas por rangos, listas ponderadas y modificadores por identificador.
4. Efectos y `aplicarEfectos`.
5. Ciclo de turno: comida (hambre, deserción, motín) y alojamiento.
6. Seguidores, objetos y acciones sin eventos (pescar, cazar, comida, reclutar, descansar, enterrar tesoro).
7. Combate normal y naval provisional.
8. Guardado (autoguardado, exportar/importar, versión).
9. Mapa (conversión `.wxx` → JSON, SVG), viajar y condición de victoria.
10. Motor de eventos y primeros eventos reales (3-4 variados) para validar el formato.
11. Contenido, interfaz pulida, minijuego naval y, más adelante, backend.

Hasta el punto 8 no hace falta ni mapa ni libro de eventos. El 9 necesita el `.wxx`.

## 10. Pendiente del autor

- Archivo **`.wxx`** del mapa prototipo y confirmar el icono de calavera.
- **Pesca y caza:** ¿1d6 o 2d6?, y reequilibrar cantidades y precio de la comida.
- Rehacer la habilidad del **cocinero** (o quitarlo) y decidir la **capacidad de carga** en la inanición.
- Asignar **eventos a cada terreno y a los nocturnos**, con pesos o iguales.
- **Libro de eventos**, empezando por 3-4 muestras variadas (tirada, decisión, combinado, con llamada y vuelta, y una con regla especial como el mapa del tesoro).
- Tabla de objetos mágicos (E037), lista de objetos y estadísticas de enemigos y barcos.
- Decidir "Meditar", el momento exacto de la **victoria** y el diseño del **minijuego naval**.
- Decisiones de modelo pendientes (sección 3.4): `id` de `Seguidor`, modo barco/tierra y bodega, catálogo de objetos en `data/`.