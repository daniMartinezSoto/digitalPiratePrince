# Pirate Prince (versión digital): contexto del proyecto

> Documento de traspaso y guía para cualquier IA que ayude con el proyecto (Claude Code, ChatGPT...). Va en la raíz del repositorio como `CLAUDE.md`. Las reglas y el mapa están en `docs/`. **Hay que mantenerlo al día** cuando se tomen decisiones nuevas.

---

## 0. Estado actual del proyecto

**Repositorio:** https://github.com/daniMartinezSoto/digitalPiratePrince (público, rama `main`). Ruta local: `C:\DigitalPiratePrince\digital-pirate-prince`.

**Entorno:** Windows 11 · Node `v26.13.0` · npm `11.20.0` · Angular CLI `22.2.6` · Angular 22 con **standalone components y signals**, SCSS, routing, sin SSR · tests con **Vitest `5.1.0`** (`ng test --watch=false`) · `"resolveJsonModule": true`.

**Progreso**
- **Sprint 0: completado.** Proyecto, tests, Git/GitHub y estructura `core/ data/ store/ ui/`.
- **Sprint 1: completado (dados).** `core/dados/` contiene `Generador` (mulberry32: `siguiente()`, `obtenerEstado()`), `tirar(expresion, generador)` y `ResultadoTirada { dados, total }` (admite cualquier número de dados y caras con multiplicador opcional: `1d6`, `2d6`, `1d6x5`, `1d11`...) y la clase `Dados` (envuelve un `Generador`; **una única instancia por partida**). `Dados` **no es un signal ni forma parte del estado**: solo se guarda su número interno en `mundo.estadoDados`.
- **Sprint 2: completado (estado y personaje).** Interfaces en `core/estado/`, datos en `data/personaje/`, `crearPersonaje(nombre, dados)` en `core/personaje/` y `crearPartida(semilla, nombre)` en `core/partida/crear-partida.ts`, que devuelve `{ estado, dados }` y guarda `dados.obtenerEstado()` en `mundo.estadoDados` DESPUÉS de crear el personaje. Constante `VERSION_ESTADO = 1`.
- **Sprint 3: completado (tablas, listas ponderadas y modificadores).** Las funciones devuelven resultados y efectos; **no modifican el estado** (eso es `aplicarEfectos`, Sprint 4).
  - ✅ Paso 1: `Dados` ya tiene `entero(min, max)`, `probabilidad(p)` y `elegirPonderado(lista)`. Cada uno consume **exactamente un** número del generador (protege la reproducibilidad).
  - ✅ Paso 2: tipos: `core/tablas/efecto.ts` (`RECURSOS`, `TipoRecurso`, `CantidadDefinicion`, `EfectoDefinicion`, `Efecto`; compartido con los futuros eventos), `core/tablas/rangos/tabla.ts` (`Fila` con `min`, `max`, `texto?`, `efectos?`, `evento?`, `libro?`; `Tabla` con `id`, `dado`, `filas`) y `rangos/resultado-tabla.ts` (`ResultadoTabla`, ver sección 7).
  - ✅ Paso 3: `resolverTabla(tabla, modificador, dados): ResultadoTabla` en `core/tablas/rangos/resolver-tabla.ts`, con 22 tests. Tira `tabla.dado`, suma el modificador, recorta al rango de la tabla, lanza error si hay hueco y resuelve las cantidades (`8`, `"2d6"`, `"1d6x10"`, `"-1d6"`). Orden fijo de consumo del generador: primero el dado de la tabla, luego cada efecto con dados en orden.
  - ✅ Paso 4: `calcularModificador(jugador, idTirada)` en `core/modificadores/` (solo sobrenombres por ahora), con 10 tests. `id-tirada.ts` define `IDS_TIRADA`, `IdTirada` y `Modificadores`. Cada sobrenombre de `sobrenombres.json` tiene un campo `modificadores` (`{}` si no da nada); influyente y nativo lo tienen relleno. Los tests también validan el JSON (tiradas existentes, bonificadores enteros).
  - ✅ Paso 5a: tablas reales en `data/tablas/` (`buscar-informacion.json`, `pesca.json`, `caza.json`). Cargador `rangos/cargar-tablas.ts` (`TABLAS`, `obtenerTabla(id)`) y revisor `rangos/validar-tabla.ts` (`validarTabla(tabla): string[]`, errores en castellano, todos a la vez: huecos, solapes, filas que no cubren exactamente lo que saca el dado, tipos/cantidades/ids mal escritos, filas vacías). `core/dados/tirada.ts` exporta `rangoDeTirada("3d6") → { min: 3, max: 18 }`.
  - ✅ Paso 5b: listas de eventos con pesos en `data/eventos-terreno/` (`alta-mar`, `costa`, `jungla`, `jungla-profunda`, `playa`, `nocturnos`), sacadas de las cuadrículas del papel (repeticiones = peso; cada lista suma 36). Código en `core/tablas/listas-eventos/`: `lista-eventos.ts`, `elegirEvento(lista, dados)`, `eventoAleatorio(lista, porcentaje, dados): string | null`, revisor y cargador (`LISTAS_EVENTOS`, `obtenerListaEventos(id)`). `data/ajustes.json` + `core/ajustes/ajustes.ts`: números equilibrables sin tocar código (de momento `probabilidadEventoAlViajar: 50`).
- **Ajustes antes del Sprint 4 (hechos tras leer el libro de eventos, ver sección 3.9):**
  - Dados: `tirar` y `rangoDeTirada` aceptan `+N` (`"1d6+1"`, `"1d6x10+5"`: primero multiplica, luego suma).
  - Efectos generales en `tablas/efecto.ts`: `operacion` (`sumar` por defecto, `fijar`, `mitad`, `maximo`, `todo`), `destino` (`jugador` por defecto, `todos`, `seguidor_azar`, `seguidor_elegido`; solo para la vida) y `ganar_partida` / `perder_partida`. Desaparece `perder_mitad_oro` (el robo de buscar información es ahora `{ "tipo": "oro", "operacion": "mitad" }`). `resolverTabla` copia el efecto y solo convierte la cantidad; `validarTabla` revisa todo lo nuevo.
  - Estado: el inventario guarda `ObjetoLlevado { id, usosRestantes? }`; nuevos `jugador.condiciones: CondicionActiva[]` (`{ id, turnosRestantes? }`) y `jugador.fasesAccionPerdidas`. Los seguidores guardan sus habilidades por id. `Objeto` y `Habilidad` pasan a `core/catalogos/` como formato de catálogo (`imagen`, `espacios`, `precioVenta`, `magico`, `modificadores`).
  - `data/ajustes.json`: `comidaMaxima` (20, provisional).
- **Tests:** 137 pasan en 14 archivos.

**Siguiente:** Sprint 4 (efectos y estado ampliado, ver sección 9). Decisiones detalladas en las secciones 3.9 y 7. El plan detallado por sprints lo mantiene el autor en un documento aparte.

---

## 1. Qué es el proyecto

Adaptación a videojuego de **Pirate Prince**, un juego de aventuras **en solitario de papel y lápiz** del autor (Daniel Martínez Soto, v0.1 Alpha, inspirado en *Barbarian Prince* de Arnold Hendrick). El jugador es un joven pirata con un barco heredado que quiere hacerse una leyenda.

- Un solo jugador, por turnos, muy basado en texto.
- Única interfaz gráfica "mecánica": un **mapa de hexágonos** por el que te mueves.
- Cada turno es un día. Se elige **una acción** según el hexágono, se resuelve con dados y tablas, y puede encadenar **eventos** (textos con decisiones, tiradas, combates, objetos...).
- **Objetivo:** conseguir **10 puntos de Fama** y haber visitado los 3 puertos principales (3 puertos concretos de los varios que hay). **Se pierde** si la vida del personaje o la tripulación del barco llegan a 0.
- El autor puede **cambiar reglas al digitalizar**: lo que en papel existe para ahorrar cuentas o guiar al jugador puede automatizarse o simplificarse.

En `docs/`: el PDF de reglas (24 páginas; **no incluye el libro de eventos**) y el mapa prototipo (hecho con Worldographer). El archivo `.wxx` del mapa está pendiente de añadir.

**Libro de eventos:** `EVENTOS.pdf` (E001-E090, cuadrículas de terreno y hoja de personaje) está **en el proyecto de Claude, no en el repositorio** (el repo es público y el libro es contenido del autor; no subirlo a GitHub). Es la versión de papel: **si el libro o el PDF de reglas no coinciden con este documento, manda este documento.**

## 2. Sobre el autor y cómo trabajar con él

- Programador web junior; nunca ha hecho aplicaciones ni juegos. Trabaja con **Angular** y PHP en backend; quiere aprender **Spring** más adelante.
- Idioma: español. **Quiere entender y controlar cada pieza del proyecto**: explicar el porqué de cada decisión, con ejemplos de su juego, en pasos pequeños y sin jerga innecesaria. Si algo no se entiende, reformularlo más simple (con ejemplos del juego, sin código) en vez de añadir detalle técnico, y no seguir hasta que lo haya entendido.
- Proponer antes de construir (plan del paso antes de escribir código; tests primero cuando se acuerde así). Si una regla del PDF es ambigua o parece un error, **preguntar** en vez de decidir en silencio.
- **Convención de nombres:** código y carpetas en español (`pescar`, `estado`, `jugador`, `mundo`, `core`...). Los nombres propios de Angular (`signal`, `Injectable`...) quedan en inglés.
- Ir de uno en uno: un paso, `ng test --watch=false`, y solo entonces el siguiente. No adelantar sprints.
- Al terminar cada sprint: commit, push y actualizar la sección 0.

---

## 3. Decisiones tomadas

### 3.1 Stack
- **Solo frontend. No hay backend.** El guardado es local en el navegador. Un backend (cuentas, ranking, nube; quizá con Spring o Supabase/Firebase) queda para el futuro, pero el diseño debe permitirlo.
- **Angular** (standalone + signals). No se usa Vite aparte.
- **Mapa en SVG** (un polígono por hexágono).
- **Tests unitarios desde el principio** para `core/`.
- El contenido del juego (eventos, enemigos, tablas, mapas) son **JSON en `data/`**, de solo lectura y empaquetados con el juego. No se usa base de datos.

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
- Los tests (`.spec.ts`) van junto al código. Las subcarpetas de `core/` se crean cuando toca su sprint. Existen ya: `core/dados/`, `core/estado/`, `core/personaje/`, `core/partida/`, `core/tablas/` (con `rangos/` y `listas-eventos/`), `core/modificadores/`, `core/ajustes/`, `core/catalogos/` (formatos de catálogo: `objeto.ts`, `habilidad.ts`); datos en `data/personaje/`, `data/tablas/`, `data/eventos-terreno/` y `data/ajustes.json`.
- **Para añadir contenido:** cada cargador (`cargar-tablas.ts`, `cargar-listas-eventos.ts`) explica arriba cómo añadir un JSON nuevo (crearlo, importarlo, añadirlo a la lista). Los tests de los cargadores pasan el revisor por **todo** el contenido automáticamente.

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
          inventario: ObjetoLlevado[]; capacidadInventario: number;   // huecos; un objeto puede ocupar varios
          seguidores: Seguidor[];    // máximo 3
          condiciones: CondicionActiva[];   // maldiciones, bendiciones, enfermedades, tormenta...
          fasesAccionPerdidas: number }     // turnos en los que se pierde la acción (se come igual)

Mundo   { mapaId: string | null;
          posicion: { col, fila } | null;
          dia: number;
          banderas: Record<string, boolean | number | string>;   // hechos generales
          marcas: { col, fila, evento }[];                       // cosas colocadas en hexágonos
          pilaEventos: { evento, paso }[];
          puertosVisitados: string[];                            // ids de puertos principales
          estadoDados: number }                                  // dados.obtenerEstado()

Seguidor { id: string; tipo: string; nombre: string; ataque: number;   // ataque = daño que hace si acierta
           resistencia, resistenciaMaxima: number;                     // resistencia = su vida
           habilidades: string[] }                                     // ids del catálogo de habilidades

ObjetoLlevado   { id: string; usosRestantes?: number }   // en la partida solo esto; el resto, del catálogo
CondicionActiva { id: string; turnosRestantes?: number } // sin turnos = hasta que algo la quite

// Catálogos (core/catalogos/, datos en data/): lo que no cambia durante la partida
Objeto    { id, nombre, descripcion; imagen?; tipo: 'pasivo' | 'activo'; usosMaximos?; espacios? (1);
            precioVenta? (sin él no se vende); magico? (+1 fama al conseguirlo); modificadores? }
Habilidad { id, nombre, descripcion; imagen?; tipo: 'pasiva' | 'activa'; modificadores? }  // sin cooldowns
```

- No hay interfaz `Personaje` separada: el protagonista es `Jugador`.
- **`banderas` vs `marcas`:** banderas = hechos generales (hex de barco agotado, audiencia vetada...); marcas = elementos en coordenadas concretas (un tesoro marcado).
- La **definición del mapa** (`data/`) no cambia durante la partida; lo que cambia va en `mundo`. El guardado almacena el id del mapa, no el mapa.
- **Catálogos (decidido):** igual que los sobrenombres, objetos, habilidades y condiciones viven en catálogos de `data/` y la partida solo guarda el `id` y lo que cambia (usos, turnos). Así, corregir un texto o un dibujo vale para todas las partidas. Los catálogos con contenido (`data/objetos.json`, `data/condiciones.json`) llegan en el Sprint 4; la lógica de usos y descarte, en el Sprint 6.
- **Bodega descartada:** comida y oro son contadores únicos, se esté en el barco o no. La comida tiene máximo (`AJUSTES.comidaMaxima`); el oro, no. (En papel cada 100 de oro ocupaban un hueco: aquí no.)

**Por decidir (antes del sprint indicado):**
- `Mundo`: ¿modo `'barco' | 'tierra'` y `posicionBarco` (dónde queda atracado al ir a pie)? E001 empieza a pie, así que hace falta desde el principio del juego. Antes del Sprint 5/9.

### 3.5 Acciones y efectos
- Una acción (p. ej. `pescar`) calcula **qué consigue** y lo devuelve como **efectos** (`Efecto[]`, p. ej. "+8 comida"). No suma nada por su cuenta. Mira el estado solo para lo que necesita (bonificadores, ubicación...).
- **`aplicarEfectos(estado, efectos)` es el ÚNICO sitio que modifica el estado:** aplica topes (tripulación máx. 40, comida máx. `AJUSTES.comidaMaxima`, vida sin superar su máximo, huecos del inventario), reglas especiales (el contable, el afortunado, +1 de fama al conseguir un objeto mágico), añade y quita condiciones, suma fases de acción perdidas y detecta victoria y derrota. Así esas reglas se escriben una sola vez.
- **Ningún recurso baja de 0.** Si tienes 15 de oro y pierdes 20, te quedas con 0 (el oro nunca es negativo; en E001, con −20, te quedas en 30 o en 0). Si la vida o la tripulación llegan a 0, se pierde la partida.
- **Sprint 4:** `aplicarEfectos` debe devolver también **información de los cambios reales** (con la tripulación en 38 y máximo 40, un efecto de +5 produce realmente +2). Los mensajes mecánicos se generan a partir de esos cambios; los narrativos pertenecen a los eventos. Los efectos y las tablas no llevan mensajes de este tipo.

### 3.6 Decisiones obligatorias desde el día uno
1. **Estado serializable** (ver 3.4).
2. **Dados con semilla (seeded PRNG)**, nunca `Math.random()`: partidas reproducibles, depuración por semilla y, a futuro, verificación en servidor. Incluye los porcentajes (deserción, motín): usar `dados.probabilidad(p)`.
3. **`banderas` y `marcas`** en el estado y **modificadores por identificador de tirada** (sección 7).

### 3.7 Guardado
- **Autoguardado** al final de cada turno (localStorage o IndexedDB; valorar `navigator.storage.persist()`).
- **Exportar/importar** la partida como JSON.
- Campo **`version`** para migrar partidas antiguas.
- Posibles ranuras múltiples. "Meditar" del monasterio puede reconvertirse en guardado manual o conservarse como limitación (pendiente decidir).
- **Sin decidir todavía (el autor lo está sopesando):** cómo encaja el guardado con un diseño tipo roguelike (sin volver atrás). Revisar esta sección antes del Sprint 8.

### 3.8 Cambios respecto al juego de papel (decididos por el autor)
- **Eventos aleatorios:** no existen las tablas de terreno de coordenadas (2d6 columna/fila). Cada terreno tiene una **lista de eventos (unos 30-40) entre los que se elige uno al azar**, con **pesos** (por defecto, cada repetición del libro = +1; si el autor prefiere probabilidades iguales, peso 1). Igual para el evento nocturno.
- **Ids de eventos con nombre:** en digital los eventos se identifican por un id descriptivo (`taberna_clandestina`), no por el número del libro (`E081`). Los `E###` que aparecen en este documento son solo la **referencia al libro de papel**.
- **Combate naval:** se sustituirá por un minijuego de habilidad. Provisionalmente, pares/impares (contrato en la sección 8).
- **Sobrenombre:** se elige con **`1d11` (uniforme)**, no con 2d6, o a elección. Las características con `1d3` (equivale al 1d6 del papel).
- **Seguidores:** **sin inventario propio y sin necesidad de comer**. Su "ataque" es el daño que hacen al acertar. Descansar los cura.
- **Comida:** una sola reserva por turno para todo el grupo (ver 4.6).
- **Objetivo:** 10 de fama **y** haber visitado los 3 puertos principales de cada mapa (ver sección 6).
- **El veneno no existe** de momento. **Las notas azules del PDF se ignoran.**

### 3.9 Decisiones tras leer el libro de eventos
**Criterio general:** lo que sale en muchos eventos se diseña como sistema; lo que sale una sola vez se resuelve con una **regla especial** de ese evento (sección 8), sin complicar el sistema. Si una regla rara obliga a ensuciar el sistema, el autor puede cambiarla por otra.

- **Efectos generales:** sumar, fijar, mitad, al máximo y todo; a quién afectan (jugador, todos, seguidor al azar o elegido); ganar y perder la partida (muertes, "pierdes la partida", y las **victorias alternativas** de la isla misteriosa E025 y la ciudad perdida E050). *(Formato ya implementado: sección 7.)*
- **Condiciones activas (lo más importante):** maldiciones, bendiciones, enfermedades, tormenta, lluvias, escorbuto, "el mal está a bordo"... son **un solo sistema**. Cada condición está en `data/condiciones.json` y declara: **bonificadores** (campo `modificadores`, como los sobrenombres), **prohibiciones** (no solicitar audiencias, no conseguir oro, no viajar...), **cambios de regla** (fama objetivo 12, 2 reservas de comida al día...), **qué pasa al empezar cada turno** (normalmente llamar a un evento con su tirada) y **cómo se quita** (monasterio, bruja, biblia, cuando amaina, tras N turnos...). Se aplican y se quitan cuando toca, **avisando siempre al jugador**.
- **Fases de acción perdidas** (E006, E007, E009, E013, E029...): contador en el estado; ese turno no hay acción, pero se gasta comida.
- **Eventos aplazados descartados** ("lee E018 al principio del siguiente turno"): se llama al evento directamente.
- **Objetos:** catálogo con dibujo (`imagen`), `espacios` (1 por defecto; p. ej. el ídolo dorado 4), `precioVenta`, permanentes o con usos. **Vender objetos** será una acción en puertos y aldeas (Sprint 6).
- **Seguidores sin inventario:** solo dan habilidades y combaten. Las reglas del libro sobre su inventario o sobre cargarlos (E039, E070...) se reescriben en cada evento.
- **Bonificadores "por cada X de fama"** (audiencia con el capitán pirata, E038, E058, E074, E080): `calcularModificador` los admitirá (Sprint 4).
- **Dados:** se admite `+N`; `1d6x1d6` se descarta y se sustituye por algo parecido (`2d6x3`).
- **Botones en las tiradas de evento** (Sprint 10): toda tirada de evento pasa por un mismo punto con el botón "Tirar dados"; si el jugador tiene un objeto que lo permite, aparecen "Evitar evento" (mano de mono) o "Elegir resultado" (amuleto del destino: se avisa de que normalmente un número más alto es mejor, sin enseñar las opciones). Cada objeto declara en el catálogo **cuándo se puede usar**.
- **Escritura fácil de eventos:** "vuelve a tirar", "tira dos veces", "lee el punto X", "elige 2 de estas opciones" deben tener atajos fáciles y su revisor (Sprint 10).
- **Apuestas e inversiones** (E081, E082, E083): paso "elige una cantidad" del motor de eventos; los efectos posteriores podrán usar esa cantidad (Sprint 10). No requiere cambios ahora.
- **Combate** (Sprint 7): enemigos con habilidades especiales (curarse, revivir, atacar dos veces, recibir menos daño, acertar solo con 5-6), número de enemigos al azar, recompensa por enemigo, combate no mortal ("vuelves con 1 PV"), ataque por sorpresa.
- **Mapa** (Sprint 9): movimientos forzados (E009, E028, E043), hexágonos bloqueados (E047) o convertidos en aldea o puerto (E004, E038, E055), sitios apuntados a distancia y dirección (E024, E060) y qué pasa si caen fuera del mapa.

---

## 4. Reglas del juego (papel, con los cambios digitales ya aplicados)

> Nota: en este apartado, los códigos `E###` son referencias al libro de eventos de papel. En el código y los JSON se usarán ids con nombre (ver 3.8).

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
| El contable | Cada vez que gana oro, gana 2d6 más (no es un modificador de tirada: se aplica en `aplicarEfectos`) |
| El hermano | Empieza con un seguidor aleatorio gratuito. Si el seguidor muere, se pierde la partida |
| El heredero | Empieza con un objeto mágico de la lista del evento E037 (no puede salir el ídolo, el 12) |

Solo los `ajustes` numéricos (fuerte, conformista) están implementados. Los efectos especiales **no se simulan** hasta que existan los sistemas que necesitan.

**Características** (digital `1d3`): 1 *Fuerte* (Ingenio 2, Fuerza 4); 2 *Equilibrado* (3/3); 3 *Inteligente* (Ingenio 4, Fuerza 2).
**Chequeo de Fuerza o Ingenio:** tirar 1d6 y sacar el valor de la característica **o menos**. Los piden algunos eventos.
**Valores iniciales:** Vida 15 · Oro 50 · Tripulación 40 (también el máximo) · Comida 5 reservas · Fama 0 · famaObjetivo 10 · capacidad de inventario 5.

### 4.3 Inventario y seguidores
- **Inventario del jugador: 5 huecos** (tesoros y objetos especiales; un objeto puede ocupar varios). [Digital] **Sin bodega**: no hay almacén aparte en el barco. **Comida y oro tienen su propio contador** (la comida con máximo).
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
- *Pescar:* en hex de agua o adyacente a agua. Aplicar bonificadores y tirada (el PDF dice 2d6, pero la tabla va de 1 a 6: **por defecto 1d6**, ver sección 5): 1 nada · 2-3 → 8 reservas · 4-5 → 12 · 6 → 15 (**reservas de comida**).
- *Cazar:* en hex de tierra sin puerto ni aldea. Tirada (PDF: 2d6, tabla de 1 a 6: **por defecto 1d6**): 1 nada · 2-3 +10 reservas y −1 PV · 4-5 +10 reservas · 6 +15 reservas.
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
- **Si no se come:** `diasSinComer` (contador único) sube. Cada **seguidor se marcha** con probabilidad **`10 + 10 × diasSinComer` %** (20% el primer día, 30% el segundo...; tope 100%) y, con la misma fórmula, puede haber **motín de la tripulación** (es un evento, ver sección 8). Tiradas **independientes** (una por seguidor y otra para el motín), con `dados.probabilidad(p)`, no con `Math.random()`.
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

### 4.11 Referencias al libro de eventos vistas en las reglas (aún sin contenido)
Códigos del libro de papel; en digital cada uno tendrá un id con nombre (ver 3.8). E001 (inicio), E005 (pesca en abundancia), E006 (daño en la bodega), E007 (fiesta), E008 (hex de barco), E017 (Bob el vendedor), E021 (cofre), E022, E023 (multa sin oro / herido grave), E024 (rumores/dibujar lugar), E027 (amuleto maldito), E036 (tesoro de barco maldito), E037 (lista de objetos mágicos), E038 (guarida pirata), E040, E042-E045 (audiencias), E049, E053 (cadáveres), E057 (guardia), E066 (bruja vudú), E071-E072, E075-E076, E078, E079 (cartógrafo), E081-E086, E088.

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
| Pesca y caza: el PDF dice 2d6 pero las tablas van de 1 a 6 | **Por defecto 1d6** (es solo un dato del JSON, fácil de cambiar). Pendiente de confirmar por el autor |
| Reequilibrar pesca/caza y precio de la comida | **Pendiente:** ahora una reserva alimenta a todo el grupo, así que las cantidades de papel (8-15) son demasiado generosas. Se ajusta jugando |
| Cocinero | **Pendiente:** su habilidad original ya no aplica; darle otra o quitarlo |
| Inanición: ¿capacidad de carga a la mitad? | **Pendiente decidir** |
| Victoria: ¿se gana al cumplir las dos condiciones o al entrar en un puerto después? Supuestos: "visitado" = entrar en el hex; el conformista también debe visitar los 3; el puerto de inicio cuenta si es principal | **Pendiente** (sprint de la condición de victoria) |
| "Meditar" / guardado como mecánica | **Pendiente decidir** |
| Dónde empieza el jugador | **Resuelto:** cada mapa declara su casilla de inicio; en el prototipo, 009.000 a pie (E001) |
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
- Hexágonos de **punta plana (flat-top)** con columnas impares desplazadas media casilla hacia abajo (se mantienen: el mapa ya está dibujado así y en SVG da igual). Sus **6 direcciones son N, NE, SE, S, SO y NO** (no existen E ni O); las tablas de dirección del libro usan 1.SE, 2.S, 3.NE, 4.SO, 5.NO, 6.N. Convertir por dentro a coordenadas axiales/cúbicas para vecinos y distancias (referencia: guía de hexágonos de Red Blob Games).
- Colores: alta mar (azul oscuro), costa (azul claro), jungla (verde claro), jungla profunda (verde oscuro), playa (amarillo).
- Rasgos: puerto (ancla) sobre playa/jungla, aldea (hachas cruzadas) sobre jungla profunda, monasterio (iglesia) sobre jungla, naufragio sobre playa, ruinas (castillo) sobre jungla profunda, barco y abundancia (pez) sobre agua. La calavera (dos huesos cruzados) de 009.000 es la **casilla de inicio** (E001): el jugador empieza a pie, debe ir al puerto 006.002 a recuperar su barco y allí tira la tabla del albacea.

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
2. **Lista ponderada de eventos** (sustituye a las cuadrículas de terreno del papel): una lista por terreno y otra de eventos nocturnos, con pesos. Se elige con `dados.elegirPonderado(lista)`.

```json
{ "terreno": "jungla", "eventos": [
    { "evento": "cabana_en_la_jungla", "peso": 3 }, { "evento": "cueva", "peso": 1 } ] }
```
Al ser una lista, se puede evitar el mismo evento dos veces seguidas, retirar los de una sola vez, o exigir condiciones (aún no implementado; el formato lo permite).

**Formato real** (`data/eventos-terreno/<terreno>.json`): `{ "id": "jungla", "eventos": [{ "evento": "cabana", "peso": 2, "libro": "E058" }, ...] }`. El mismo evento escrito dos veces es un **error** (se sube el peso). `eventoAleatorio(lista, porcentaje, dados)` decide primero si pasa algo (gasta 1 número) y, si pasa, elige con pesos (gasta otro). Al **viajar** se usa la lista del **terreno de destino** con `AJUSTES.probabilidadEventoAlViajar` (Sprint 9). Servirá también para descansar en el barco y dormir a la intemperie.

**Ids de eventos ya asignados** (código del libro → id): E002 `islote`, E003 `piratas_hostiles`, E004 `aldea`, E008 `barco`, E009 `vientos_fuertes`, E010 `vientos_favorables`, E011 `imprevisto`, E012 `rocas`, E013 `perdidos`, E014 `objeto`, E015 `sirenas`, E016 `polizon`, E017 `bob_vendedor_ambulante`, E018 `el_mal`, E019 `motin`, E020 `pandemia`, E024 `rumores`, E026 `monstruo`, E028 `tierra`, E030 `traicion`, E031 `escondite`, E033 `escorbuto`, E034 `tormenta`, E035 `botella`, E038 `guarida_pirata`, E039 `nido`, E040 `ruinas`, E042 `alguacil`, E046 `nativos_hostiles`, E047 `bloqueado`, E048 `manantial`, E051 `explorador`, E052 `plantas_carnivoras`, E053 `esqueleto`, E054 `ritual`, E055 `nativos`, E056 `golem`, E058 `cabana`, E059 `picadura`, E061 `jaguar`, E062 `arenas_movedizas`, E063 `campamento`, E064 `dinosaurio`, E065 `marina`, E066 `bruja_vudu`, E067 `puente`, E068 `lluvias`, E069 `pantano`, E070 `sol`, E071 `pescador`, E072 `piratas_perdidos` (en barco: bote a la deriva; en tierra: deambulando; es el mismo evento), E074 `tesoro_enterrado`, E075 `ermitano`, E078 `pirata_maldito`, E079 `cartografo`, E080 `misioneros`, E081 `taberna_clandestina`, E082 `mercado_de_esclavos`, E083 `contrabandista`, E084 `subasta_secreta`, E085 `piratas_esqueleto`, E086 `fugitivo`, E087 `carruaje`, E088 `cueva`, E089 `cangrejo`, E090 `volcan`. Las listas son orientativas: faltan eventos y están sin equilibrar.

### Implementado en `core/tablas/` (Sprint 3; tipos de tablas en `rangos/`, `efecto.ts` en la raíz)

```ts
// efecto.ts
export const RECURSOS = ['oro', 'comida', 'tripulacion', 'vida', 'fama'] as const;   // array para recorrerlo en el test de validación
export type TipoRecurso = (typeof RECURSOS)[number];
export const OPERACIONES = ['sumar', 'fijar', 'mitad', 'maximo', 'todo'] as const;     // sin poner = sumar
export const RECURSOS_CON_MAXIMO = ['vida', 'tripulacion', 'comida'];                 // los únicos con "maximo"
export const DESTINOS = ['jugador', 'todos', 'seguidor_azar', 'seguidor_elegido'] as const;  // sin poner = jugador; solo vida
export const FINES_DE_PARTIDA = ['ganar_partida', 'perder_partida'] as const;
export type CantidadDefinicion = number | string;          // 8, -1  o  "2d6" / "1d6x10" / "1d6+1" / "-1d6" (el signo menos = se resta)
export type EfectoDefinicion =                             // tal como se escribe en el JSON
  | { tipo: TipoRecurso; operacion?: 'sumar' | 'fijar'; cantidad: CantidadDefinicion; destino?: Destino }
  | { tipo: TipoRecurso; operacion: 'mitad' | 'maximo' | 'todo'; destino?: Destino }  // dependen del estado: aplicarEfectos
  | { tipo: FinDePartida };
export type Efecto = /* igual, pero con la cantidad ya convertida en número (+ ganar, − perder) */;

// tabla.ts
export interface Fila { min: number; max: number; texto?: string; efectos?: EfectoDefinicion[]; evento?: string }
export interface Tabla { id: string; dado: string; filas: Fila[] }   // sin modificadores: el id de tirada lo decide quien llama

// resultado-tabla.ts  (lo que devuelve resolverTabla)
export interface ResultadoTabla {
  dados: number[];      // dados sacados, para mostrarlos
  modificador: number;  // bonificador aplicado
  total: number;        // suma de dados + modificador (antes de recortar al rango de la tabla)
  texto?: string;       // texto de la fila, si lo tiene
  efectos: Efecto[];    // siempre una lista (vacía si no hay)
  evento?: string;      // id (con nombre) del evento al que salta, si lo hay
}
```

Ejemplo de tabla en JSON:

```json
{ "id": "pesca", "dado": "1d6", "filas": [
    { "min": 1, "max": 1, "texto": "No pescas nada" },
    { "min": 2, "max": 3, "efectos": [{ "tipo": "comida", "cantidad": 8 }] },
    { "min": 4, "max": 5, "efectos": [{ "tipo": "comida", "cantidad": 12 }] },
    { "min": 6, "max": 6, "efectos": [{ "tipo": "comida", "cantidad": 15 }] } ] }
```
Una fila puede llevar efectos, un evento o ambas cosas: `{ "min": 9, "max": 12, "evento": "taberna_clandestina" }`. Un evento **no es un efecto**: es un salto del motor de eventos.

### Decisiones del Sprint 3
1. **`resolverTabla(tabla, modificador, dados): ResultadoTabla` no recibe el estado.** Solo la tabla, un número y los `Dados`. Tira `tabla.dado`, suma el modificador, busca la fila, resuelve las cantidades con expresión de dados (`"2d6"` → un número) y devuelve el resultado.
2. **`calcularModificador(jugador, idTirada)` es una función aparte** que suma lo que aportan sobrenombre, seguidores y objetos. Lo puntual (p. ej. "+1 por pagar 5 de oro") se suma al número antes de llamar a `resolverTabla`.
3. **Ids de tirada específicos:** `buscar_info_puerto`, `buscar_info_aldea`, `audiencia_puerto`, `audiencia_aldea`, `audiencia_guarida`, `pesca`, `caza`. Sobrenombres, seguidores y objetos declaran sus modificadores sobre estos ids, en datos, sin `if`s sueltos. Primera versión solo con sobrenombres: *influyente* +1 en `buscar_info_puerto`, `audiencia_puerto` y `audiencia_guarida`; *nativo* +1 en `buscar_info_aldea` y `audiencia_aldea`.
4. **Resultado fuera de la tabla:** se recorta al primer o último rango (21 en una tabla que acaba en 18 se trata como 18). **Un hueco dentro de la tabla es un error**, no un silencio.
5. **Efectos con dados salen ya resueltos** (números concretos). Los que dependen del estado (`mitad`, `maximo`, `todo`) y los fines de partida se devuelven tal cual y los resuelve `aplicarEfectos` (Sprint 4). `resolverTabla` copia cada efecto tal cual y solo convierte la cantidad.
6. **Los JSON pierden los tipos al importarse** (`"tipo": "oro"` es un `string`). Se convierte con `as` en **un único cargador de tablas**, y un **test valida todas las tablas**: sin huecos ni solapes, tipos de efecto conocidos (`RECURSOS` + fines de partida), operación y destino válidos (cantidad solo en sumar/fijar, `maximo` solo en recursos con máximo, destino distinto de jugador solo para la vida, no fijar en negativo) e ids de evento con formato válido. Aún no se puede exigir que el evento exista.
7. **Ids de evento con nombre**, no con el número del libro. Opcional mientras se pasan los eventos: un campo `"libro": "E081"` solo para cotejar con el PDF, que se borra después.
8. **Dados del papel:** sumar dados cambia las probabilidades (los extremos son raros, a propósito). Mantener el dado de papel en tablas con resultados "normales" y "raros"; para resultados igual de probables, dado único (`1d7`, `1d8`...). **Las tablas siempre son con dado y rangos** (los bonificadores necesitan rangos); **los pesos son solo para las listas de eventos**. Añadir un resultado = partir una fila o cambiar `1d7` → `1d8` y añadir la fila; el revisor avisa si las filas no cubren exactamente lo que saca el dado.
9. **Pesca y caza:** 1d6 por defecto, con las cantidades del papel por ahora.
10. **Sin mensajes en efectos ni tablas** (ver 3.5), salvo el `texto` descriptivo de la fila.
11. **Perder se escribe con signo menos**, también con dados: `{ "tipo": "vida", "cantidad": -1 }` (caza) o `{ "tipo": "oro", "cantidad": "-1d6" }` (multa del discurso). `resolverTabla` quita el `-`, tira y devuelve la cantidad en negativo; `tirar()` no se toca. El código solo suma: **el JSON decide si se gana o se pierde**.
12. **Dados con suma:** `"1d6+1"` se admite en el dado de una tabla y en cantidades (primero multiplica, luego suma: `"1d6x10+5"`).

Si un evento referenciado todavía no existe, el juego muestra "evento X pendiente" para poder probar el flujo antes de tener el libro.

### Modificadores por identificador
Sobrenombres, seguidores y objetos suman bonificadores (nativo, barbero-cirujano, influyente...). Para evitar `if`s sueltos: **cada tirada tiene un identificador** y cada sobrenombre/seguidor/objeto **declara sus modificadores sobre esos identificadores**. Añadir un objeto es añadir datos.

```json
{ "id": "el_influyente", "modificadores": { "buscar_info_puerto": 1, "audiencia_puerto": 1, "audiencia_guarida": 1 } }
```
- Van ligados a **tiradas, no a tablas**: la misma tabla (buscar información) tiene bonificadores distintos en puerto y en aldea, y habrá tiradas que no son tablas (huida, chequeos).
- **No todo es un modificador de tirada.** El navegante y el superviviente cambian el alcance del movimiento: tendrán su propio campo (p. ej. `"movimiento": { "mar": 2 }`) en el Sprint 9. Muchas reglas concretas de sobrenombres, seguidores y eventos se irán resolviendo una a una cuando toque.
- **Duda abierta:** la descripción del influyente dice "+1 al buscar información" sin especificar dónde; ahora está programado solo en puertos (decisión 3). Confirmar con el autor.

---

## 8. Sistema de eventos (diseño; aún no se programa)

Un **evento** es una mini-historia compuesta de **pasos con nombre**, identificado por un id con nombre (`taberna_clandestina`). Un paso tiene texto, puede tener `efectos`, y **una** forma de continuar:

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
- Una fila de tabla con `"evento": "..."` es un `ir_evento` o `llamar_evento`.
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
2. ✅ Estado serializable y creación de personaje/partida.
3. ✅ Resolvedor de tablas por rangos, listas ponderadas y modificadores por identificador.
4. **Efectos y estado ampliado** (ajustes previos ya hechos, ver sección 0). Pasos: catálogos `data/objetos.json` y `data/condiciones.json` (formato, cargador, revisor y unos ejemplos del libro) → `calcularModificador` ampliado (condiciones activas, objetos que llevas, "por cada X de fama") → `aplicarEfectos` (operaciones, destinos, topes, nada baja de 0, comida máxima, añadir y quitar condiciones, fases perdidas, ganar o perder, +1 fama por objeto mágico) que devuelve la **lista de cambios reales** para avisar al jugador.
5. Ciclo de turno: inicio de turno (procesar condiciones activas: tiradas, duración, quitar las que terminan, avisos; saltar la acción si hay fases perdidas), comida (hambre, deserción, motín) y alojamiento.
6. Seguidores, objetos (usos, descarte, vender en puertos y aldeas) y acciones sin eventos (pescar, cazar, comida, reclutar, descansar, enterrar tesoro).
7. Combate normal (con habilidades especiales de enemigos, sección 3.9) y naval provisional.
8. Guardado (autoguardado, exportar/importar, versión).
9. Mapa (conversión `.wxx` → JSON, SVG), viajar, eventos que cambian el mapa y condición de victoria.
10. Motor de eventos (punto único de tiradas con botones de objetos, atajos de escritura, paso "elige una cantidad", condiciones de ubicación) y primeros eventos reales (3-4 variados) para validar el formato.
11. Contenido, interfaz pulida, minijuego naval y, más adelante, backend.

Hasta el punto 8 no hace falta ni mapa ni libro de eventos. El 9 necesita el `.wxx`.

## 10. Pendiente del autor

- Archivo **`.wxx`** del mapa prototipo.
- **Erratas del libro de eventos:** E044 resultado 3-4 dice E041 (debería ser E042); E072 piratas neutrales 5-6 dice E023 (seguramente E038); E081 beber y bailar 5 dice E041 (¿E044?); "8" suelto en E020; doble "1" en E019; en las tablas de dirección, "E" debe ser "NO".
- Confirmar si el +1 del **influyente** al buscar información vale solo en puertos o también en aldeas.
- Decidir la **comida máxima** definitiva jugando (ahora 20).
- Confirmar **pesca y caza en 1d6** y, más adelante, reequilibrar cantidades y precio de la comida.
- Rehacer la habilidad del **cocinero** (o quitarlo) y decidir la **capacidad de carga** en la inanición.
- Completar y equilibrar las **listas de eventos por terreno** (ya pasadas del papel, faltan algunos eventos).
- **Libro de eventos**, empezando por 3-4 muestras variadas (tirada, decisión, combinado, con llamada y vuelta, y una con regla especial como el mapa del tesoro).
- Tabla de objetos mágicos (E037), lista de objetos y estadísticas de enemigos y barcos.
- Decidir "Meditar", cómo encaja el guardado con el diseño roguelike (sección 3.7), el momento exacto de la **victoria** y el diseño del **minijuego naval**.
- Decisión de modelo pendiente (sección 3.4): modo barco/tierra y dónde queda el barco.
