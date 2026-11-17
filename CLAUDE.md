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
  - `Articulo`/`ArticuloLlevado` se renombran a `Objeto`/`ObjetoLlevado` (mismo vocabulario que el juego).
- **Sprint 4: completado (efectos y estado ampliado).**
  - ✅ Catálogo de objetos: `data/objetos.json` (5 ejemplos: ídolo dorado, mano de mono, amuleto del destino, brújula mágica, amuleto kalinago), cargador `core/catalogos/cargar-objetos.ts` (`OBJETOS`, `obtenerObjeto(id)`) y revisor `validar-objeto.ts` (`validarObjetos`: ids repetidos o mal escritos, activos con usos y pasivos sin ellos, espacios ≥ 1, precio ≥ 1, `magico` booleano, bonificadores).
  - ✅ Catálogo de condiciones: `core/catalogos/condicion.ts` (`Condicion`, `CATEGORIAS_CONDICION`), `data/condiciones.json` (maleficio del pirata, el mal, escorbuto, tormenta, lluvias), cargador `cargar-condiciones.ts` y revisor `validar-condicion.ts`. La revisión de bonificadores es compartida: `core/modificadores/validar-modificadores.ts`.
  - ✅ Vocabulario de efectos ampliado (`tablas/efecto.ts`): características `fuerza`, `ingenio`, `vidaMax` (nunca bajan de 1) y `ganar_objeto`, `perder_objeto`, `poner_condicion` (turnos opcionales, con dados), `quitar_condicion` (por id o por categoría), `perder_turnos`, `bandera`. `validarTabla` comprueba que objetos y condiciones existen en su catálogo y avisa de campos que sobran.
  - ✅ `calcularModificador(jugador, idTirada, catalogos?)` suma sobrenombre + objetos que lleva + condiciones activas + "por cada X de fama" (`AJUSTES.bonificadorPorFama`, de momento `audiencia_guarida: 2`).
  - ✅ `aplicarEfectos(estado, efectos, dados, catalogos?)` en `core/efectos/`: devuelve `{ estado, cambios }` (ver sección 3.5). Nuevo `mundo.finPartida` (`core/estado/fin-partida.ts`).
- **Sprint 5: completado (ciclo de turno: comida, inanición y descanso).** Decisiones y reglas en la sección 3.10; reglas de comida y descanso en 4.6 y 4.7.
  - ✅ Fase del turno en el estado: `core/estado/fase.ts` (`FASES`: `inicio`, `accion`, `comida`, `descanso`) y `mundo.fase`. `VERSION_ESTADO` sigue en 1 (aún no hay guardado).
  - ✅ Fichas de condición completas (`core/catalogos/condicion.ts`): `prohibe` (`PROHIBICIONES`), `ajustes` (`AJUSTES_DE_CONDICION`), `cadaTurno` (`efectos` y/o `tabla`) y `alLlegar` (`lugar`, y opcionalmente `efectos` y `evento`). El revisor lo comprueba todo, incluidos los efectos (`validarEfecto` se exporta desde `validar-tabla.ts`) y que la tabla exista.
  - ✅ Condiciones del juego (`data/condiciones.json`): maleficio del pirata, el mal, pistas sobre la criatura, escorbuto, hambre, tormenta y lluvias. Tablas diarias en `data/tablas/`: `el-mal`, `escorbuto`, `tormenta-continua`, `lluvias-persisten`. Id de tirada nuevo: `el_mal`.
  - ✅ Efectos: campo `siNoHay` en los efectos con destino `seguidor_azar` (efectos de reemplazo si no hay seguidores). Sus dados se tiran siempre, se usen o no.
  - ✅ Consultas (`core/condiciones/consultas.ts`): `estaProhibido`, `condicionesQueProhiben`, `famaObjetivoActual`, `comidaPorDia`. Solo calculan; no guardan nada.
  - ✅ `core/turno/`: `iniciarTurno` (amanecer), `comer` + `opcionesDeComida`, `descansar` + `opcionesDeDescanso` (cierra el día: `dia + 1`, fase `inicio`), `lugar.ts` (`LUGARES`) y un test de día completo. `core/personaje/vinculo-nativo.ts` (`tieneVinculoNativo`).
  - ✅ Estado: `Seguidor.inseparable?`. Cambio nuevo `seguidor_se_marcha`. `data/ajustes.json`: `precioTaberna` (5), `precioPosada` (5), `precioMonasterio` (7), `probabilidadEventoNocturno` (33).
  - **La fase de acción sigue siendo un hueco:** `iniciarTurno` deja el día en `accion` y todavía nada lo pasa a `comida`; lo harán las acciones del Sprint 6.
- **Tests:** tras el paso 8 del Sprint 6, a Claude le pasan 827 en 44 archivos (sin `app.spec.ts`; al autor le deberían salir 829 en 45).

**Siguiente:** Sprint 6 (seguidores, objetos y acciones sin eventos, sección 9). El plan detallado por sprints lo mantiene el autor en un documento aparte.

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
- **Con Claude (desde el Sprint 5):** Claude edita los archivos directamente en el PC del autor, pero **no hace commits ni push** (los hace el autor, y pide el comando si lo necesita). Para cada paso: plan → visto bueno → cambios → el autor lanza `ng test --watch=false` → siguiente paso.

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
- Los tests (`.spec.ts`) van junto al código. Las subcarpetas de `core/` se crean cuando toca su sprint. Existen ya: `core/dados/`, `core/estado/`, `core/personaje/`, `core/partida/`, `core/tablas/` (con `rangos/` y `listas-eventos/`), `core/modificadores/`, `core/ajustes/`, `core/catalogos/` (formatos, cargadores y revisores de catálogo: `objeto.ts`, `condicion.ts`, `habilidad.ts`), `core/efectos/` (`aplicarEfectos` y `Cambio`), `core/condiciones/` (consultas sobre las condiciones activas) y `core/turno/` (las fases del día: `iniciar-turno.ts`, `comer.ts`, `descansar.ts`, `lugar.ts`), `core/amuleto-maldito/` (tablas del amuleto maldito y `recibirAmuletoMaldito`); datos en `data/personaje/`, `data/tablas/`, `data/eventos-terreno/`, `data/objetos.json`, `data/condiciones.json` y `data/ajustes.json`.
- **Para añadir contenido:** cada cargador (`cargar-tablas.ts`, `cargar-listas-eventos.ts`, `cargar-objetos.ts`, `cargar-condiciones.ts`) explica arriba cómo añadir contenido nuevo (objetos y condiciones: solo escribir la ficha en su JSON). Los tests de los cargadores pasan el revisor por **todo** el contenido automáticamente.

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
          fase: 'inicio' | 'accion' | 'comida' | 'descanso';     // momento del día (core/estado/fase.ts)
          banderas: Record<string, boolean | number | string>;   // hechos generales
          marcas: { col, fila, tipo: 'evento' | 'tesoro_enterrado', evento? }[];   // cosas en casillas concretas
          pilaEventos: { evento, paso }[];
          puertosVisitados: string[];                            // ids de puertos principales
          estadoDados: number;                                   // dados.obtenerEstado()
          finPartida: { resultado: 'victoria' | 'derrota';       // null mientras se juega
                        motivo: 'vida' | 'tripulacion' | 'seguidor' | 'evento' } | null;
          accionEnCurso: AccionEnCurso | null;    // acción a medias: mercado, marineros o seguidor en espera (Sprint 6)
          nochePagada: boolean }                  // el grupo tiene pagada la noche en el monasterio; vuelve a false al acabar el día

Seguidor { id: string; tipo: string; nombre: string; ataque: number;   // ataque = daño que hace si acierta
           resistencia, resistenciaMaxima: number;                     // resistencia = su vida
           habilidades: string[];                                      // ids del catálogo de habilidades
           inseparable?: boolean }                                     // true = nunca se marcha por su cuenta (sí puede morir)

ObjetoLlevado   { id: string; usosRestantes?: number }   // en la partida solo esto; el resto, del catálogo
CondicionActiva { id: string; turnosRestantes?: number } // sin turnos = hasta que algo la quite

// Catálogos (core/catalogos/, datos en data/): lo que no cambia durante la partida
Objeto    { id, nombre, descripcion; imagen?; tipo: 'pasivo' | 'activo'; usosMaximos?; espacios? (1);
            cuandoSeUsa? ('accion' | 'evento' | 'combate'; solo activos); alUsar? (efectos al usarlo; solo activos);
            precioVenta (obligatorio, mágicos incluidos); magico? (+1 fama al conseguirlo); modificadores?; otorga? }
Habilidad { id, nombre, descripcion; imagen?; tipo: 'pasiva' | 'activa'; modificadores? }  // sin cooldowns
Condicion { id, nombre, descripcion; imagen?; categoria: 'maldicion' | 'bendicion' | 'enfermedad' | 'clima' | 'otra';
            modificadores?;                       // bonificadores a tiradas mientras dura
            prohibe?: Prohibicion[];              // 'viajar' | 'solicitar_audiencia' | 'enterrar_tesoro' | 'nuevos_seguidores'
            ajustes?: { famaObjetivo?, comidaPorDia? };   // reglas que cambian mientras dura (se suman a la regla normal)
            cadaTurno?: { efectos?, tabla? };     // qué pasa cada amanecer (lo ejecuta iniciarTurno)
            alLlegar?: { lugar: 'tierra' | 'puerto' | 'aldea' | 'naufragio'; efectos?; evento? } }   // al llegar, SE QUITA (y puede pasar algo)
```

- No hay interfaz `Personaje` separada: el protagonista es `Jugador`.
- **`banderas` vs `marcas`:** banderas = hechos generales (hex de barco agotado, audiencia vetada...); marcas = elementos en coordenadas concretas (un tesoro marcado).
- La **definición del mapa** (`data/`) no cambia durante la partida; lo que cambia va en `mundo`. El guardado almacena el id del mapa, no el mapa.
- **Catálogos (decidido):** igual que los sobrenombres, objetos, habilidades y condiciones viven en catálogos de `data/` y la partida solo guarda el `id` y lo que cambia (usos, turnos). Así, corregir un texto o un dibujo vale para todas las partidas. `data/objetos.json` y `data/condiciones.json` existen desde el Sprint 4; la lógica de usos y descarte, en el Sprint 6.
- **La ficha describe; la regla se programa en su sprint.** Que la brújula mueva 1 hex más o que la mano de mono evite un evento se programa con el mapa o los eventos, igual que los sobrenombres.
- **Condiciones = solo lo que dura.** Lo que pasa una vez ("tu oro se convierte en ceniza", "quédate con 1 PV") son efectos normales. La **categoría** existe porque las reglas hablan de categorías ("el monasterio, la biblia o la bruja quitan **una maldición**"). Lo que el libro marca "(maldición)", como el mal está a bordo, va en `maldicion`.
- **Imágenes (decidido):** `imagen` es opcional en objetos y condiciones. Sin dibujo, la interfaz muestra un **icono de reserva por categoría** (calavera = maldición, nube = clima...). Las condiciones activas se verán como iconos en la partida.
- **Bodega descartada:** comida y oro son contadores únicos, se esté en el barco o no. La comida tiene máximo (`AJUSTES.comidaMaxima`); el oro, no. (En papel cada 100 de oro ocupaban un hueco: aquí no.)

**Barco y monigote (decidido, se programa en el Sprint 9):** al desembarcar, el barco se queda en su hexágono de agua y aparece un monigote a pie; al volver al hexágono del barco, el monigote desaparece y se vuelve a controlar el barco. Para eso `Mundo` guardará **dónde está el barco** (`posicionBarco`): si el jugador está en esa casilla, va a bordo; si no, a pie. No hace falta guardar un "modo". E001 empieza a pie, así que hace falta desde el principio del juego.

### 3.5 Acciones y efectos
- Una acción (p. ej. `pescar`) calcula **qué consigue** y lo devuelve como **efectos** (`Efecto[]`, p. ej. "+8 comida"). No suma nada por su cuenta. Mira el estado solo para lo que necesita (bonificadores, ubicación...).
- **`aplicarEfectos(estado, efectos, dados, catalogos?)` es el ÚNICO sitio que modifica el estado** (implementado en `core/efectos/aplicar-efectos.ts`). No toca el estado recibido: copia, cambia la copia y devuelve `{ estado, cambios }`. Aplica los efectos en orden:
  - Topes: vida ≤ `vidaMax`, tripulación ≤ `tripulacionMax`, comida ≤ `AJUSTES.comidaMaxima`. **Ningún recurso baja de 0; las características (fuerza, ingenio, vidaMax) nunca bajan de 1.** Subir `vidaMax` no cura; bajarla por debajo de la vida baja la vida.
  - Operaciones: `mitad` redondea hacia abajo (15 → 7); `maximo` sube al máximo; `todo` deja a 0.
  - Destinos (solo vida): `todos` = jugador y cada seguidor; `seguidor_azar` elige con los dados; un seguidor a 0 de resistencia muere y sale del grupo. `seguidor_elegido` da error hasta el motor de eventos (Sprint 10).
  - **`siNoHay` (Sprint 5):** un efecto a `seguidor_azar` puede llevar los efectos que pasan en su lugar si no hay ningún seguidor (escorbuto: muere un seguidor; si no tienes, −1d6 de tripulación). Sin `siNoHay`, no pasa nada.
  - Objetos: solo entran si caben (cuenta `espacios`); los activos entran con `usosMaximos`; **los mágicos dan +1 de fama**. Si no cabe, no entra (elegir qué tirar: Sprint 6). Perder un objeto quita uno si lo tienes.
  - Condiciones: **no se duplican** (se queda la que dure más; sin turnos = para siempre). Quitar por categoría quita **una, la más antigua**.
  - Turnos perdidos se suman a `fasesAccionPerdidas`; las banderas se apuntan en `mundo.banderas` (solo banderas generales; las de un hex concreto, Sprint 9).
  - **El contable:** cada vez que GANA oro (sumar positivo; no fijar) gana 2d6 más.
  - **Fin de partida:** vida o tripulación a 0 → derrota; `ganar_partida` / `perder_partida` → victoria / derrota por evento. Se apunta en `mundo.finPartida` y **los efectos que quedan ya no se aplican**. Qué se hace después (pantalla, guardado) es de sprints posteriores. La victoria normal (fama + puertos) llega con el mapa (Sprint 9).
- **El afortunado (decidido):** evita la muerte **una vez, solo en combate** (se queda con 1 PV). Se programa en el combate (Sprint 7), no en `aplicarEfectos`.
- **Excepción: la contabilidad del turno (Sprint 5).** Las funciones de `core/turno/` cambian por su cuenta (siempre devolviendo una copia) lo que es del propio turno y no un efecto de juego: `mundo.fase`, `mundo.dia`, `mundo.estadoDados`, gastar una fase de acción perdida, restar turnos a las condiciones, `diasSinComer` y los seguidores que se marchan por hambre. Todo lo demás (recursos, condiciones, objetos, fin de partida) sigue pasando por `aplicarEfectos`.
- **El chivato (`Cambio`, `core/efectos/cambio.ts`):** lista de **cambios reales** (con la tripulación en 38 y máximo 40, un +5 produce "de 38 a 40"; si no cambia nada, no se apunta). Tipos: `recurso` (con `motivo` opcional: `contable`, `objeto_magico`), `resistencia_seguidor`, `seguidor_muerto`, `seguidor_se_marcha` (se va por su cuenta; no es morir), `objeto_ganado`, `objeto_no_cabe`, `objeto_perdido`, `condicion_puesta`, `condicion_quitada`, `turnos_perdidos`, `bandera`, `fin_partida`. **Son datos, no mensajes:** la interfaz los convierte en notificaciones. Los mensajes narrativos pertenecen a los eventos; efectos y tablas no llevan mensajes.

### 3.6 Decisiones obligatorias desde el día uno
1. **Estado serializable** (ver 3.4).
2. **Dados con semilla (seeded PRNG)**, nunca `Math.random()`: partidas reproducibles, depuración por semilla y, a futuro, verificación en servidor. Incluye los porcentajes (deserción, motín): usar `dados.probabilidad(p)`.
3. **`banderas` y `marcas`** en el estado y **modificadores por identificador de tirada** (sección 7).

### 3.7 Guardado
- **Autoguardado** al final de cada turno (localStorage o IndexedDB; valorar `navigator.storage.persist()`).
- **Exportar/importar** la partida como JSON.
- Campo **`version`** para migrar partidas antiguas.
- Posibles ranuras múltiples. **"Meditar" del monasterio desaparece (decidido en el Sprint 5):** no se guarda la partida en los monasterios.
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
- **Objetos:** catálogo con dibujo (`imagen`), `espacios` (1 por defecto; p. ej. el ídolo dorado 4), `precioVenta` (todos lo tienen), permanentes o con usos. **Vender objetos** será parte de la acción "Ir al mercado", solo en puertos (Sprint 6, paso 6). **En las aldeas no se cambian objetos por nada.**
- **Seguidores sin inventario:** solo dan habilidades y combaten. Las reglas del libro sobre su inventario o sobre cargarlos (E039, E070...) se reescriben en cada evento.
- **Bonificadores "por cada X de fama"** (audiencia con el capitán pirata, E038, E058, E074, E080): `calcularModificador` los admitirá (Sprint 4).
- **Dados:** se admite `+N`; `1d6x1d6` se descarta y se sustituye por algo parecido (`2d6x3`).
- **Botones en las tiradas de evento** (Sprint 10): toda tirada de evento pasa por un mismo punto con el botón "Tirar dados"; si el jugador tiene un objeto que lo permite, aparecen "Evitar evento" (mano de mono) o "Elegir resultado" (amuleto del destino: se avisa de que normalmente un número más alto es mejor, sin enseñar las opciones). Cada objeto declara en el catálogo **cuándo se puede usar**.
- **Escritura fácil de eventos:** "vuelve a tirar", "tira dos veces", "lee el punto X", "elige 2 de estas opciones" deben tener atajos fáciles y su revisor (Sprint 10).
- **Apuestas e inversiones** (E081, E082, E083): paso "elige una cantidad" del motor de eventos; los efectos posteriores podrán usar esa cantidad (Sprint 10). No requiere cambios ahora.
- **Combate** (Sprint 7): enemigos con habilidades especiales (curarse, revivir, atacar dos veces, recibir menos daño, acertar solo con 5-6), número de enemigos al azar, recompensa por enemigo, combate no mortal ("vuelves con 1 PV"), ataque por sorpresa.
- **Mapa** (Sprint 9): movimientos forzados (E009, E028, E043), hexágonos bloqueados (E047) o convertidos en aldea o puerto (E004, E038, E055), sitios apuntados a distancia y dirección (E024, E060) y qué pasa si caen fuera del mapa. **Hexágonos bloqueados (decidido):** se guardan como marcas en `mundo.marcas` (con un tipo: evento, bloqueado...) y viajar no deja entrar en ellos. **Ofender a una aldea bloquea su hexágono** (mismo sistema que el camino bloqueado de E047), tanto con el jefe de aldea como al intentar dormir en ella; si estás dentro al ofenderla, tienes que salir (el siguiente turno, obligatoriamente viajar).
- **En papel todo es un evento; en digital no (MUY IMPORTANTE).** En papel "lee E0XX" es la única forma de mandar al jugador a otra página. En digital cada E### se convierte en lo que realmente es: **evento** (historia con decisiones), **tabla** (solo una tirada: E036 Tesoro, E037 Tesoro mágico), **combate** (pelea con un guardia → combate con su enemigo), **efectos** (algo que pasa y ya) o **tienda** (E017 Bob). Esto decide **qué se programa y cuándo**: una tabla no espera al motor de eventos. **Clasificación E001-E090 hecha:** borrador de Claude en el proyecto de Claude: `claude/clasificacion-libro-eventos.md` (no va a GitHub). El autor se fía del criterio de sprints y tipos del borrador y se revisa sobre la marcha. Decisiones del autor (15-nov):
  - **E023 Arrestado = condición "en prisión"** que bloquea el juego: mientras dura no puedes viajar ni hacer acciones; cada turno aparece el evento de la cárcel (con su imagen) y hay que resolverlo para que el juego vuelva a la normalidad.
  - **Combate = herramienta + bestiario:** los eventos lanzan "combate + enemigo(s)" según lo que pase.
  - **E070 Sol abrasador:** se quita lo de cargar seguidores (no tienen inventario); se reescribe.
  - **E041 Deseo:** primer evento real del motor de eventos.
  - **Tipo "Especial"** = regla única que no encaja en tabla, combate, condición ni pasos normales de evento (p. ej. E067: cuatro tiradas seguidas; E052: tantos chequeos como plantas). No tiene que ver con cómo se llega al evento.

### 3.10 Decisiones del Sprint 5 (ciclo de turno)

**El día (`core/turno/`).** Cada función comprueba que la partida está en SU fase (si no, error: evita, p. ej., dos amaneceres el mismo día), no toca el estado recibido y apunta `mundo.estadoDados` al terminar. Devuelven **datos, no mensajes**, y los eventos que lanzan salen como **eventos pendientes** (ids), hasta que exista el motor de eventos.

| Fase | Función | Qué hace | Deja la fase en |
|---|---|---|---|
| `inicio` | `iniciarTurno(estado, dados)` | Las condiciones activas actúan; se gasta una fase de acción perdida si la hay | `accion` (o `comida` si la acción está perdida) |
| `accion` | *(Sprint 6)* | La acción del jugador y sus eventos | `comida` |
| `comida` | `comer(estado, eleccion, lugar, dados)` | Come o pasa hambre | `descanso` |
| `descanso` | `descansar(estado, eleccion, lugar, dados)` | Duerme; puede saltar un evento nocturno; **cierra el día** | `inicio` del día siguiente |

- **El lugar es un dato suelto** hasta que exista el mapa: `barco` (a bordo, en mar), `puerto`, `aldea`, `monasterio` o `intemperie` (playa, jungla, jungla profunda). Lo dice quien llama; después lo calculará el mapa.
- **Opciones para la interfaz:** `opcionesDeComida` y `opcionesDeDescanso` dicen qué se puede elegir, cuánto cuesta y si llega el oro. **Una opción que no se puede pagar sale igual, pero desactivada** (decisión del autor).

**Amanecer (`iniciarTurno`).** Recorre las condiciones que había al amanecer, **de la más antigua a la más nueva**. Cada una: (a) sus efectos fijos de `cadaTurno`, (b) su tirada diaria en su tabla y (c) si tiene turnos contados, uno menos (a 0 se quita; el último día todavía actúa). Devuelve un **parte** por condición (dados, texto de la fila, cambios reales).
- Una condición que otra se ha llevado esa mañana ya no hace nada. Las que aparecen durante la mañana empiezan a contar al día siguiente.
- Si la partida termina a mitad (vida o tripulación a 0), se para ahí.
- **Bonificador de la tirada diaria:** si la tabla tiene un id de tirada con su mismo nombre (`el_mal`), se suman los bonificadores del jugador; si no, se tira sin bonificador.
- Las condiciones actúan **antes** de mirar si hay acción: "las lluvias persisten" quita la acción de ese mismo día.

**Condiciones: cómo se quitan.** Por una fila de su tabla (`quitar_condicion`), por turnos, por categoría (monasterio, bruja, biblia: "una maldición") o **al llegar a un lugar** (`alLlegar`).
- **"Al llegar" es un patrón del juego:** al llegar a ese tipo de lugar, la condición se quita y, si la ficha lo dice, da unos efectos o lanza un evento. Hoy solo lo usa el escorbuto (se cura al tocar tierra). Servirá para: carta de la hija del gobernador (E035: puerto → audiencia con +1), mensaje del nativo (aldea → seguidor nativo), mensaje del náufrago (naufragio → seguidor), esclavos por vender (E008: puerto → +100 de oro), "el poder de la amistad" (E074: puerto → seguidor gratis). Cada una con su icono mientras se lleva. Quien avisa de la llegada es viajar (Sprint 9).
- **Los ajustes se calculan, no se guardan:** `famaObjetivoActual(jugador)` = la del personaje + lo que digan sus condiciones. `jugador.famaObjetivo` no cambia nunca; así no hay nada que deshacer al quitarse la condición. **La interfaz debe usar las funciones de `core/condiciones/consultas.ts`, no leer el campo directamente.**
- **Las prohibiciones solo se declaran:** cada acción las hará cumplir cuando exista (viajar: Sprint 9; audiencias y seguidores: Sprint 6; ganar oro: en `aplicarEfectos`, con el amuleto maldito).

**Decisiones del autor sobre las condiciones del libro:**
- **El mal está a bordo (E018):** actúa también estando a pie. Cada amanecer −1 de tripulación y tirada en su tabla. La fila 4 da "pistas sobre la criatura" (+1 en la tirada, **una sola vez**; las condiciones acumulables se descartan mientras solo las use este evento). Al expulsar a la criatura (filas 5 y 6) se quitan el mal y las pistas. Falta el "+1 con seguidor nativo o bruja vudú" (bonificadores de seguidores, Sprint 6).
- **Tormenta (E034):** prohíbe viajar; cada amanecer 1d6, con 1-2 continúa.
- **Lluvias (E068):** al amanecer siguiente, 1d6: con 4+ "las lluvias persisten, pierdes tu fase de acción" (se pierde la acción de ese día); en los dos casos la condición se quita (al día siguiente despeja seguro). El resfriado no se vuelve a tirar: es del evento.
- **Escorbuto (E033):** tabla diaria; fila 1: muere un seguidor al azar o, si no hay, −1d6 de tripulación. Se cura al tocar tierra (te reabasteces de fruta) y no vuelve al zarpar.
- **Trampa (E029) y secuestro (E042) sin seguidores:** se coge el resultado anterior de la tabla o se vuelve a tirar (al escribir esas tablas, Sprint 6).
- **Eventos de una sola vez por partida:** el mal está a bordo solo puede salir una vez (y otros que el autor decidirá). Si sale en el dado de otro evento y ya ocurrió, se coge el resultado siguiente o se vuelve a tirar. Listas de terreno: Sprint 9; eventos que mandan a otros: motor de eventos.
- **Seguidores inseparables:** `Seguidor.inseparable` = nunca se marcha por su cuenta (sí puede morir). Lo serán el seguidor del hermano y los que el libro dice que "te acompañarán siempre" (E014, E023, E035, E041). Se asigna al crear cada seguidor (Sprint 6).

**Pendiente para el Sprint 6 (decidido en este sprint):**
- **Condiciones otorgadas:** un objeto, un sobrenombre o un seguidor podrá declarar "mientras me tengas, tienes esta condición". No se guardan: se calculan. Hace falta para el **amuleto maldito** (sus maldiciones duran mientras se lleva) y para el **vínculo nativo**.
- **Vínculo nativo con icono:** el autor quiere que el jugador vea que lo tiene y qué le da. Hoy es la función `tieneVinculoNativo` (sobrenombre "el nativo", amuleto kalinago o un seguidor de tipo `nativo`, **nombre de tipo provisional**), escrita en un solo sitio. Los +1 de aldea **se siguen sumando** entre fuentes, así que los bonificadores se quedan en cada fuente y la condición llevará solo las reglas de sí o no.
- **Imágenes:** `imagen` es opcional en las fichas; ninguna condición la usa aún. Propuesta de carpeta: `public/condiciones/...` (sin decidir).

### 3.11 Decisiones del Sprint 6 (en curso)

**Seguidores (catálogo, paso 1 hecho).** Fichas en `data/seguidores.json` (formato `core/catalogos/tipo-seguidor.ts`) y habilidades en `data/habilidades.json`. `crearSeguidor(idTipo, seguidoresActuales, dados, { inseparable? })` en `core/seguidores/` fabrica el seguidor (no lo mete en el grupo ni cobra).
- **El cocinero se sustituye por el pescador** (30 de oro): cada vez que consigues pescar algo, +1 reserva; si no pescas nada, no da nada. Se programa con la acción de pescar.
- **El carpintero se sustituye por el mono amaestrado** (40 de oro, resistencia 3, ataque 0 = no ataca): al buscar información en un puerto roba 1d6 de oro; con un 1 lo pillan y pagas 1d6 de multa. Se programa con la acción de buscar información.
- **La bruja vudú es evento Y seguidor:** el evento es la cabaña (E066); el seguidor `bruja_vudu` solo llega por eventos (ficha sin `precio`). `precio: 0` = gratis (pirata anciano); sin `precio` = no se contrata en puertos.
- **El cartógrafo no es un seguidor del catálogo:** el resultado de la tabla de contratar lleva a su evento, y allí quizá se contrata.
- **Tipo `nativo` confirmado** (nombre "Nativo kalinago"). Su habilidad da +1 en `audiencia_aldea`, `buscar_info_aldea` y `el_mal`; la bruja vudú, +1 en `el_mal`.
- **Nombres propios:** `data/nombres-seguidores.json` tiene tres listas del autor: `hombres` y `mujeres` (nombres de pirata, 60 + 60) y `nativos` (56, hombres y mujeres juntos). Un seguidor normal coge su nombre de `hombres` + `mujeres`, todo junto. La ficha de un tipo puede pedir otras listas con el campo `nombres`: **la bruja vudú, `["mujeres"]`** (siempre es mujer) y **el nativo, `["nativos"]`**. Al crearlo se elige uno al azar (gasta UN número del generador); si ya lo lleva alguien del grupo, se coge el siguiente de la lista. Cargador: `core/seguidores/nombres.ts` (`LISTAS_DE_NOMBRES`, `nombresDe`).
- **Id del seguidor en la partida:** tipo + número (`forzudo_1`, `forzudo_2`).
- **Efecto `ganar_seguidor` (paso 2 hecho):** `{ "tipo": "ganar_seguidor", "seguidor": "nativo", "inseparable"?: true }`. `aplicarEfectos` llama a `crearSeguidor` y lo mete en el grupo. No entra si una condición prohíbe `nuevos_seguidores` (se mira primero) o si el grupo está lleno (`AJUSTES.maximoSeguidores`, 3). Cambios nuevos: `seguidor_se_une`, `seguidor_no_se_une` (motivo `grupo_lleno` o `prohibido`) y `seguidor_despedido`.
- **Grupo lleno: despedir para hacer sitio.** El juego pregunta ANTES "¿despides a alguien para que entre el nuevo?"; si el jugador elige a uno, el efecto lleva `despedir: "<id del seguidor en la partida>"` (no se escribe nunca en el JSON: el revisor lo rechaza), ese se va y entra el nuevo. Si dice que no, el nuevo no entra. **A un inseparable no se le puede despedir** (el hermano no puede librarse así de perder). Consultas para la interfaz en `core/seguidores/consultas.ts`: `grupoLleno`, `seguidoresDespedibles`.
- **El hermano (paso 2b hecho):** al crear el personaje empieza con un seguidor de un tipo al azar entre **TODOS** los de `data/seguidores.json` (se contraten o no; misma probabilidad), gratis, **inseparable y vital**. Cuenta para el máximo de 3. Gasta dos números del generador (tipo y nombre), solo con ese sobrenombre.
- **`Seguidor.vital`:** si muere, el jugador pierde la partida (`finPartida.motivo: 'seguidor'`). Es distinto de `inseparable`. Lo comprueba `aplicarEfectos` al morir un seguidor; el combate (Sprint 7) debe respetarlo también.
- **`data/seguidores.json` es el catálogo de TODOS los seguidores**, vengan de contratar o de eventos. La tabla de contratar (2d6) será una tabla aparte que apunta a sus ids.
- **Bonificadores de seguidores:** `calcularModificador` suma las habilidades de los seguidores. **Todo suma, también lo repetido** (dos nativos = +2): el autor quiere que el juego tenga combinaciones locas.

**Condiciones vigentes (paso 3 hecho): apuntadas, partes y otorgadas.** `condicionesVigentes(jugador)` y `tieneCondicion(jugador, id)` en `core/condiciones/condiciones-vigentes.ts` devuelven TODAS las condiciones que afectan al jugador ahora, sin repetir. **Las reglas miran siempre esa lista** (consultas, `calcularModificador`, prohibiciones), no `jugador.condiciones`.
- **Apuntadas:** las de `jugador.condiciones` (tormenta, escorbuto, el amuleto maldito).
- **Otorgadas:** campo `otorga` (lista de ids de condición) en la ficha de un sobrenombre, un objeto o una habilidad. Se tienen mientras se tenga la fuente; **no se guardan, se calculan**. Si llega por varias fuentes, sale una vez. El revisor comprueba que existen.
- **Vínculo nativo = condición `vinculo_nativo`** (categoría `otra`), otorgada por "el nativo", el amuleto kalinago y la habilidad `guia_nativo` del seguidor nativo (ya no se mira el nombre del tipo). `tieneVinculoNativo` sigue existiendo. Los +1 de aldea se quedan en cada fuente y suman.
- **Partes:** `CondicionActiva.partes` = condiciones que una apuntada lleva DENTRO; funcionan mientras dure y se van con ella. Efecto: `{ "tipo": "poner_condicion", "condicion": "amuleto_maldito", "partes": [...] }`.
- **Amuleto maldito (decidido por el autor): es UNA condición "maldición-bendición"** (`amuleto_maldito`, categoría `maldicion`) con dos partes: la bendición y la maldición que tocaron en los dados. **Cuenta como maldición:** monasterio, bruja o cualquier "quitar una maldición" se la llevan ENTERA (se pierde también lo bueno; la única excepción es el deseo, que pasa una vez). **No es un objeto ni ocupa hueco del inventario.** Si ya tienes uno, el nuevo se ignora.
- **Maldiciones del amuleto en `data/condiciones.json`:** `hambre_insaciable` (+1 comida al día), `ambicion_desmedida` (+2 fama objetivo), `hedor_nauseabundo` (prohíbe nuevos seguidores), `rechazo_a_la_autoridad` (prohíbe audiencias), `avaricioso` (prohíbe enterrar tesoros) y `muy_mala_suerte` (ficha escrita; el −3 se activa cuando existan las tablas de objetos).
- **Avaricioso sustituye a odio al dinero (decidido por el autor, 17-nov):** prohíbe la acción enterrar tesoro (prohibición nueva `enterrar_tesoro`, que reemplaza a `ganar_oro`); al recibirla no pasa nada más. Odio al dinero y su código se han quitado.
- **Amuleto maldito completo (paso 5a hecho, 17-nov).**
  - **Bendiciones** en `data/condiciones.json` (categoría `bendicion`): `fuerza_letal` (+1 fuerza), `super_cerebro` (+2 ingenio), `gran_fortaleza` (+4 vida máxima), `piel_de_piedra` (solo la ficha; la regla, en el combate del Sprint 7) y `carisma` (+1 seguidor; **sustituye a "alma del fénix", eliminada**). El 6 es el **deseo**: no es una condición sino el evento `deseo`, pendiente hasta el Sprint 10 (el amuleto lleva solo la maldición).
  - **Tablas del amuleto:** `data/amuleto-maldito.json` (`bendiciones` y `maldiciones`; el dado elige la POSICIÓN en la lista, 1d6 con 6 resultados). Cada resultado lleva `condicion` o `evento` y, opcional, `alRecibir` (efectos de una sola vez: gran fortaleza cura del todo). Código en `core/amuleto-maldito/`: formato, cargador (`AMULETO_MALDITO`) y revisor (`validarAmuletoMaldito`: condición o evento, que exista y sea de su categoría, efectos y campos que sobran).
  - **`recibirAmuletoMaldito(estado, dados)`**: si ya lleva uno, no recibe otro (no tira dados) y devuelve el aviso `condicion_no_puesta` (motivo `ya_la_tiene`; la interfaz dirá "No puedes recibir otro amuleto maldito: ya llevas uno"). `aplicarEfectos` avisa igual si un `poner_condicion` con `partes` intenta poner un segundo amuleto. Una condición normal repetida (otra tormenta) no avisa: se queda la que dure más; si no, tira los dos dados (gasta dos números), pone `amuleto_maldito` con sus partes y aplica `alRecibir`, todo por `aplicarEfectos`. Devuelve `{ estado, cambios, tiradas, eventos }`.
  - **Los stats se calculan:** ajustes de condición nuevos `fuerza`, `ingenio`, `vidaMax`, `maximoSeguidores` y consultas `fuerzaActual`, `ingenioActual`, `vidaMaxActual`, `maximoSeguidoresActual` (`core/condiciones/consultas.ts`). La hoja (`jugador.fuerza`...) guarda solo su valor; un "+1 de fuerza" de un evento cambia la hoja y se suma al del amuleto. `aplicarEfectos` usa `vidaMaxActual` como tope de vida y `maximoSeguidoresActual` para el grupo; `grupoLleno` también.
  - **Al quitar una condición o perder un objeto** (`ajustarALosTopes` en `aplicarEfectos`): si la vida pasa del tope nuevo, baja; si sobran seguidores, se marcha uno al azar (los inseparables no entran en el sorteo; si todos lo son, no se va nadie). Cambio `seguidor_se_marcha` con `motivo: 'carisma_perdido'`.
  - **`el_maldito`**: `crearPartida` le da el amuleto al empezar (aquí y no en `crearPersonaje`, porque pasa por `aplicarEfectos`, que trabaja con el estado). `Partida` tiene un campo nuevo `eventos` (el deseo, si toca). `estadoDados` se apunta después del amuleto.
  - Tests en `core/amuleto-maldito/amuleto-maldito.spec.ts` (47). Semillas de "el maldito": 7 (deseo + hedor), 45 (carisma + ambición), 87 (gran fortaleza + avaricioso).
- **Objetos (paso 5b hecho, 17-nov).**
  - **Cuándo se usa cada objeto activo:** campo `cuandoSeUsa` en la ficha (`MOMENTOS_DE_USO`): `accion` (al empezar la fase de acción, antes de elegir; **no gasta la acción** y se pueden usar varios), `evento` (botón al tirar los dados de un evento: mano de mono, amuleto del destino; Sprint 10) y `combate` (botón junto a "Atacar"; Sprint 7). Solo `accion` está programado. Campo `alUsar`: efectos al usarlo, escritos como los de las tablas. El revisor exige `cuandoSeUsa` en los activos y prohíbe `cuandoSeUsa`/`alUsar` en los pasivos.
  - **Precio obligatorio** (`precioVenta`) en todos los objetos, mágicos incluidos (provisionales: ídolo 800, brújula 100, mano de mono 80, amuleto del destino 60, kalinago 40). Vender no quita la fama del objeto mágico.
  - **`core/objetos/`:** `usarObjeto(estado, posicion, dados)` (solo en fase `accion` y con objetos de `accion`; gasta un uso, aplica `alUsar`; a 0 usos se tira solo), `tirarObjeto(estado, posicion, dados)` (cualquier fase, gratis) y consultas `espaciosOcupados`, `espaciosLibres`, `espaciosQueFaltan`, `cabeObjeto`, `objetosUsablesAhora`. Los objetos del inventario se señalan por su **posición** (0 = el primero).
  - **Elegir qué tiras si no cabe** (como `despedir`): el juego pregunta antes y añade `tirar: [posiciones]` al `ganar_objeto` (puede ser más de uno: el ídolo ocupa 4). Si tirándolos cabe, se tiran y entra; si no, no se tira nada y no entra. `tirar` no se escribe en el JSON.
  - **Efectos internos** (`EFECTOS_INTERNOS`, no se escriben en el JSON; el revisor los rechaza): `gastar_uso` y `tirar_objeto`. Cambios nuevos: `objeto_tirado`, `objeto_usado` (con `usosRestantes`) y `objeto_agotado`.
  - **Amuleto kalinago:** solo bonificadores y vínculo nativo (ya no se entrega en la aldea para dormir gratis).
- **Acción "Ir al mercado" (paso 6 hecho, 17-nov; `core/mercado/`).** Solo en puertos. **Lo que gasta el día es entrar**; dentro, cada cosa es un botón aparte y se pulsa tantas veces como se quiera hasta "Salir del mercado" (decisión del autor: nada de "todo en un clic").
  - `irAlMercado(estado, sitio, dados)`: saca el objeto del rastrillo de hoy (1 número del generador) y lo guarda en `mundo.accionEnCurso` (`{ tipo: 'mercado', rastrillo: { objeto, precio } | null }`), para que no cambie durante la visita y sobreviva a un guardado. Mientras está dentro, ni otra acción, ni volver a entrar, ni usar objetos (`comprobarQueSePuedeActuar` lo impide).
  - Botones: `comprarComida` y `venderComida` (1 reserva por clic; `AJUSTES.precioComprarComida` 5 y `precioVenderComida` 2), `venderObjeto(posicion)` (uno a uno, a su `precioVenta`; efecto interno `vender_objeto` y cambio `objeto_vendido`), `comprarEnRastrillo(tirar?)` (si no cabe, se pregunta qué tira; si ni así cabe, ni se compra ni se cobra) y `salirDelMercado` (fase `comida`). `opcionesDelMercado` dice a la interfaz qué está activo y por qué no (`sin_oro`, `comida_al_maximo`, `sin_comida`).
  - Vender cuenta como ganar oro: el contable gana sus 2d6 en cada venta.
  - **Sin tirada de papel** ("hoy solo hay alguien que compra"): siempre se puede comprar y vender comida. **No hay tienda fija:** objetos solo en el rastrillo (o en eventos como el emporio de Bob). En las aldeas no hay mercado.
  - **Rastrillo:** `data/rastrillo.json` (`objetos: [{ objeto, peso, precio }]`, elegido con pesos). El revisor exige que cueste más que su `precioVenta`. Provisional: los 4 objetos sin el ídolo, a precio doble.
  - **Mejoras del barco (RECORDAR AL AUTOR EN EL SPRINT DEL COMBATE NAVAL):** se conseguirán en el rastrillo, en el emporio de Bob y en eventos; no ocupan inventario (como las bendiciones: probablemente condiciones de una categoría nueva `mejora`). Su efecto depende de cómo sea el combate naval (quizá con minijuego), así que no se ha programado nada.
- **Acciones a medias: `mundo.accionEnCurso` (paso 7, 17-nov).** Las acciones de varios pasos (primero se tira o se entra, después el jugador decide) guardan lo que salió en un único campo (`AccionEnCurso` en `core/estado/mundo.ts`): `{ tipo: 'mercado', rastrillo }`, `{ tipo: 'marineros', disponibles }` o `{ tipo: 'seguidor', seguidor, precio }`. Así no se puede volver a tirar hasta que guste y un guardado a mitad lo conserva. Mientras hay una, `comprobarQueSePuedeActuar` y `usarObjeto` dan error ("hay una acción a medias").
- **REGLA DE LA INTERFAZ (decidida por el autor):** una acción que no se puede usar SIEMPRE se ve, desactivada (más clara) y con el motivo. `AccionDisponible` lleva `motivo` y, si es por una condición, `condiciones` (ids: "no puedes: Hedor nauseabundo"). Vale para todo el juego.
- **Contratar (paso 7 hecho, 17-nov; `core/contratar/contratar.ts`).** Solo en puertos. Tres formas, cada una una ACCIÓN distinta en `accionesDisponibles` (cada día, solo una):
  - **`dar_discurso`** (`darDiscurso`): 1d6 en `data/tablas/discurso.json` (id de tirada `discurso`): 1 multa de 1d6 de oro · 2-3 nadie te hace caso · 4 +1d6 de tripulación · 5 +1d6+3 · 6 +1d6+6 (confirmado por el autor). **Multa sin oro suficiente:** te quitan todo el oro y evento pendiente `arrestado` (E023).
  - **`contratar_marineros`**: `contratarMarineros` tira los disponibles (`AJUSTES.marinerosDisponibles`, "1d6x3+4") y `pagarMarineros(cantidad)`: **el jugador elige cuántos** (no está obligado a contratar a todos los disponibles), de 0 al máximo (`opcionesDeMarineros`: lo que hay, lo que puede pagar y lo que le cabe) a `AJUSTES.precioMarinero` (2). Desactivada con la tripulación al máximo o sin oro ni para uno.
  - **`buscar_seguidor`**: `buscarSeguidor` tira 2d6 en `data/tablas/contratar-seguidor.json` (id de tirada `contratar_seguidor`; 2-3 pirata anciano gratis, 4 pescador, 5 nativo, 6 forzudo, 7 artista, 8 cartógrafo = evento pendiente `cartografo`, 9 barbero, 10 navegante, 11 mono, 12 pirata experto; precios del catálogo). Después `contratarSeguidor(despedir?)` o `rechazarSeguidor`; `opcionesDelSeguidor` dice si llega el oro y si hay que despedir. Con el grupo lleno y sin despedir, no entra ni paga. Desactivada con hedor nauseabundo (motivo `prohibido` con la condición) o con el grupo lleno de inseparables.
- **Monasterio (paso 8 hecho, 17-nov; `core/monasterio/monasterio.ts`).** Dos acciones, solo en monasterios (motivo `solo_monasterio` fuera):
  - **`rezar`**: te purificas: se quitan **TODAS** las maldiciones apuntadas (el amuleto maldito entero, el mal está a bordo, el maleficio del pirata...). Desactivada con `sin_maldiciones` ("No tienes ninguna maldición").
  - **`descansar_en_monasterio`** (`descansarEnMonasterio(estado, sitio, dados)`): **descansa todo el grupo o nadie** (decidido por el autor: más simple y entendible). Cuesta `AJUSTES.precioDescansarMonasterio` (20) + `precioDescansarMonasterioPorSeguidor` (5) por cada seguidor (`precioDescansoEnMonasterio`); el jugador y cada seguidor recuperan **toda** la vida (con gran fortaleza, hasta 19). Desactivada con `nadie_herido` ("Nadie necesita descansar") o `sin_oro`.
  - **El precio incluye dormir allí esa noche:** queda `mundo.nochePagada = true`; en la fase de descanso en el monasterio solo sale una opción, `techo_todos` gratis (sin eventos nocturnos y con su posibilidad de dormir genial). `descansar` lo vuelve a `false` al acabar el día.
- **Enterrar tesoro (paso 9 hecho, 17-nov; `core/acciones/enterrar-tesoro.ts`).** Acción `enterrar_tesoro`: −`AJUSTES.oroAlEnterrarTesoro` (100) de oro, +1 de fama. Solo en tierra salvaje (lugar `intemperie`: playa, jungla, jungla profunda). **Sin objeto mágico** (decidido por el autor) y **nada se desentierra**. **Un tesoro por casilla:** queda una marca `tesoro_enterrado` en `mundo.marcas` (las marcas tienen ya `tipo`: `evento` o `tesoro_enterrado`); en esa casilla sale desactivada con `tesoro_ya_enterrado` ("Ya has enterrado un tesoro aquí"). `Sitio` lleva un `hex` opcional (lo dará el mapa); sin él no se puede comprobar ni marcar. Desactivada también con `prohibido` (avaricioso, con la condición) o `sin_oro`.
- **SIGUIENTE PASO, 10:** buscar información. Después: audiencias, naufragio y ruinas, dormir en la aldea y mendigar (artista).
- **Cómo comprueba Claude los tests sin `ng test`:** compila `src/app/core` con `tsc` a una carpeta temporal fuera del repo (commonjs) y carga los `.spec.js` con un corredor mínimo que usa el `expect` de `vitest/dist/index.js`. No incluye `app.spec.ts` (por eso le salen 2 tests menos que al autor). La comprobación oficial sigue siendo el `ng test --watch=false` del autor.
- **Límite conocido:** al amanecer (`iniciarTurno`) solo actúan las condiciones apuntadas; las partes y las otorgadas no ejecutan `cadaTurno` (hoy ninguna lo tiene).

**Fase de acción (paso 4 hecho): `core/acciones/`.** Molde común en `accion.ts`: `comprobarQueSePuedeActuar` → lo suyo + `aplicarEfectos` → `cerrarFaseDeAccion` (fase `comida`). Todas devuelven `ResultadoAccion { estado, cambios, tirada?, eventos }`. El sitio es un dato suelto hasta el mapa: `Sitio { lugar, juntoAlAgua? }`. `accionesDisponibles(estado, sitio)` da todas las acciones; las que no se pueden, desactivadas con motivo.
- **Pescar** (`pescar.ts`): a bordo o en tierra junto al agua. Tabla nueva (decidida por el autor): 1 nada · 2-3 → 3 · 4-5 → 5 · 6 → 7 reservas (viviendo solo de pescar, 1 día de cada 4; simulado en 60 días de mar. Con 2/4/6 era 1 de cada 3 y al autor le pareció pesado). Cada seguidor pescador da +1 **solo si se pesca algo**.
- **Cazar** (`cazar.ts`): solo en tierra salvaje (`intemperie`). 1 nada · 2-3 → 4 y −1 PV · 4-5 → 5 · 6 → 8 (algo más que pescar, pero con riesgo).
- **Acción "Reposar" (decidida por el autor; se llama así, en el juego y en el código, para no confundirla con la FASE de descanso, que es dormir):** acción independiente (en papel era "descansar" e iba unida a cazar/pescar). Pasas el día recuperándote: **+2 PV** (`AJUSTES.curaAlReposar`) al jugador y a cada seguidor, **+1 por cada barbero-cirujano** (su punto extra es SOLO con esta acción, no durmiendo). **Riesgo** (`AJUSTES.probabilidadEventoAlReposar`, 20 %): a bordo, lista nueva `descuido_a_bordo` (`data/eventos-terreno/descuido-a-bordo.json`: perdidos, rocas, vientos fuertes, polizón, imprevisto, traición y, con poco peso, motín, sirenas, monstruo y tormenta; puede salir algo bueno); a la intemperie, la lista de nocturnos; **en puerto, aldea y monasterio no hay riesgo**.
- **Dormir genial (decidido por el autor):** en la fase de descanso ya no se cura siempre. A bordo o bajo techo hay un `AJUSTES.probabilidadDormirGenial` (50 %) de "Has dormido genial (+1 PV)"; **una tirada para todo el grupo**. `descansar` devuelve `haDormidoGenial`. A la intemperie no se tira. Así la acción Reposar tiene más sentido.
- **Ajustes de habilidad:** `Habilidad.ajustes` (`curaAlReposar`, `reservasAlPescar`), sumados con `ajusteDeSeguidores(jugador, regla)` (`core/seguidores/consultas.ts`). Reglas de seguidor en datos, sin `if`s.
- **Economía de la comida (decidido por el autor):** `comidaMaxima` 12; `precioTaberna` 4; **comprar una reserva costará al menos 5 de oro** (paso de comprar y vender comida). Objetivo de diseño: que de vez en cuando haga falta pescar o cazar, salvo golpe de suerte.

**Límites contra el abuso de acciones (decidido por el autor; se guardan por sitio, así que la memoria por hexágono llega con el mapa, Sprint 9).**
- **Audiencias: una concedida por sitio y por partida.** En cuanto te conceden la audiencia en un puerto, aldea o guarida, acabe como acabe, la acción "solicitar audiencia" queda **bloqueada** en ese sitio para el resto de la partida (sale desactivada). Si te la deniegan ("hoy no, mañana +1") puedes volver a intentarlo. Ofender sigue como estaba (no puedes volver; en la aldea, además, se bloquea el hexágono).
- **Buscar información: cada dos turnos.** Tras buscar, al día siguiente no se puede (para no llamar la atención); al otro, sí. La acción sale desactivada con el aviso "Buscar información (falta 1 día para poder usarla)". El número va en `data/ajustes.json` para equilibrarlo jugando. Los resultados de una sola vez por sitio (el cubil de contrabandistas) siguen siéndolo.

---

## 4. Reglas del juego (papel, con los cambios digitales ya aplicados)

> Nota: en este apartado, los códigos `E###` son referencias al libro de eventos de papel. En el código y los JSON se usarán ids con nombre (ver 3.8).

### 4.1 Turno
Cada turno = un día, con cuatro fases en orden (`mundo.fase`):
1. **Inicio** [digital]: amanece y actúan las condiciones activas (tormenta, el mal está a bordo...). Si hay fases de acción perdidas, se gasta una y se salta la acción.
2. **Acción** (una sola, según el tipo de hexágono). Puede encadenar eventos que deben resolverse **todos** antes de pasar a la siguiente fase.
3. **Comida** (obligatoria).
4. **Descanso** (antes "alojamiento"; depende de dónde estés). Al terminar empieza el día siguiente.

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
| El afortunado | Evita la muerte una vez **en combate** (se queda con 1 PV; Sprint 7) |
| El contable | Cada vez que gana oro, gana 2d6 más (no es un modificador de tirada: se aplica en `aplicarEfectos`) |
| El hermano | Empieza con un seguidor aleatorio gratuito. Si el seguidor muere, se pierde la partida |
| El heredero | Empieza con un objeto mágico de la lista del evento E037 (no puede salir el ídolo, el 12) |

Implementados: los `ajustes` numéricos (fuerte, conformista), los `modificadores` (influyente, nativo) y el contable (en `aplicarEfectos`). Los efectos especiales **no se simulan** hasta que existan los sistemas que necesitan.

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

**Buscar información (3d6).** En puerto se pueden gastar 5 de oro para +1 al dado (hasta 3 veces). En aldea, +1 con seguidor nativo, sobrenombre "el nativo" o amuleto kalinago (se suman).
- **[Digital, decidido por el autor] En las aldeas nativas, buscar información usa su PROPIA tabla** (`buscar_informacion_aldea`, 3d6, mismos rangos), con resultados con ambiente de aldea. La tabla de abajo queda **solo para puertos**. El contenido lo escribirá el autor (borrador de ideas de Claude en el proyecto de Claude: `claude/borrador-buscar-informacion-aldea.md`; no va a GitHub). Los ids de tirada `buscar_info_puerto` y `buscar_info_aldea` ya separan los bonificadores.

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

**Comprar y vender comida (puertos y aldeas).** 1d6: 1 alguien que solo compra · 2-3 alguien que solo vende · 4-6 mercado (compra y venta). En puertos: comprar a 2 de oro la reserva, vender a 1. ~~En aldeas: objetos por comida~~ **[Digital] eliminado: en las aldeas no se cambian objetos por nada.** Comprar y vender comida pasa a la acción "Ir al mercado" (Sprint 6, paso 6).

**Solicitar audiencia (1d6).**
- *Gobernador (puerto):* 1 guardia te reconoce (E057) y no puedes repetir en este puerto · 2-3 denegada hoy, mañana +1 (no acumulable, solo al día siguiente) · 4 atiende su hija (E044) · 5-6 permitida (E042).
- *Jefe de aldea:* +1 con seguidor nativo, amuleto kalinago o sobrenombre "el nativo". 1 ofendes y no puedes volver · 2 no se permite · 3 denegada hoy, mañana +1 · 4-6 permitida (E043).
- *Capitán pirata (guarida):* +1 por cada 2 puntos de fama. 1-2 ofendes y no puedes volver · 3 no se permite · 4+ permitida (E045).
- Otros modificadores: barbero-cirujano +1, influyente +1 en puertos y guaridas, nativo +1 en aldeas.

**Visitar monasterio (dos acciones; programadas en el Sprint 6, sección 3.11):** *Rezar* (te purificas: se quitan **todas** las maldiciones, el amuleto maldito incluido) · *Descansar* (**todo el grupo: 20 de oro + 5 por seguidor**; todos recuperan toda la vida y esa noche duermen allí sin volver a pagar). **"Meditar" ya no existe.** Sin haber descansado, dormir en el monasterio en la fase de descanso **se paga** (ver 4.7).

**Investigar naufragio (1d6):** 1-2 barco maldito (1d6: 1-3 superar E078; 4 *corregido por el autor en su versión*; 5-6 superar E085), al superarlo 1d6×10 de oro y un tesoro (E036) · 3 guarida pirata (E038) · 4-5 hogar de alguien (1d6: 1 E086, 2 E071, 3 E076, 4 E072, 5 E083, 6 E075) · 6 restos antiguos (E053 y E021).

**Enterrar tesoro [digital, Sprint 6]:** solo en playa, jungla o jungla profunda. 100 de oro = **1 de Fama**. Sin objetos mágicos. Un tesoro por casilla, y no se desentierra.

**Registrar ruinas (2d6):** 2 E022 · 3 E049 · 4 E053 dos veces · 5 E078 y, si se supera, cofre E021 · 6-7 ciudad pirata neutral: E038 yendo directo al punto 3 · 8-9 E040 · 10 gruta E088 · 11 lámpara mágica: 1d6, con 3+ lee E045 · 12 recibes "el ídolo antediluviano" (si ya lo tienes, E037).

### 4.6 Fase de comida [digital, programada en el Sprint 5: `core/turno/comer.ts`]
- **Comer es obligatorio.** Cada día hace falta **1 reserva de comida** (más con condiciones como "hambre insaciable": `comidaPorDia`) y con eso come **todo el grupo**: jugador, seguidores y tripulación.
- **El jugador elige** entre gastar sus **reservas** o **pagar con oro**, donde se pueda:
  - **Puerto:** comer en la **taberna**, `AJUSTES.precioTaberna` (5) de oro por cada reserva que haría falta.
  - **Aldea:** los nativos **no aceptan monedas**; solo si el jugador tiene **vínculo nativo** (sobrenombre "el nativo", amuleto kalinago o un seguidor nativo) puede intercambiar oro por comida, al mismo precio.
  - **Resto:** solo reservas.
  - Si se puede pagar pero no llega el oro, la opción sale desactivada.
- **Si las reservas no llegan:** gasta las que tiene y pasa hambre igual.
- **Hambre (inanición):** `diasSinComer` (contador único) sube y aparece la **condición "hambre"** (con su icono), que se quita al comer.
  - **Vida:** pierde tantos PV como días lleva sin comer (1, 2, 3...). Si eso le dejaría sin vida: **1d6, con 1 muere; con 2+ se queda con 1 PV** y vive un día más.
  - **Seguidores:** cada uno se marcha con probabilidad **`10 + 10 × diasSinComer` %** (20 % el primer día, 30 % el segundo...; tope 100 %). Los **inseparables** no se marchan nunca.
  - **Motín:** con esa misma probabilidad (es un evento, ver sección 8; de momento se devuelve como evento pendiente `motin`, también estando a pie).
  - Tiradas **independientes**, con `dados.probabilidad(p)`.
  - **Dado de ataque:** −1 por día sin comer, **tope −3** (sale de `diasSinComer`; se programa con el combate, Sprint 7. Con −3 "solo aciertas con un 6, y haces 6 de daño": afinar entonces).
  - En papel también reducía la capacidad de carga a la mitad: por decidir si se mantiene.
- Al comer del todo, `diasSinComer` vuelve a 0. Comer no cura.

### 4.7 Fase de descanso [digital, programada en el Sprint 5: `core/turno/descansar.ts`]
Antes "alojamiento". **"Taberna" es donde se come en un puerto; "posada", donde se duerme en un puerto.** Dormir bien **cura 1 PV**; dormir a la intemperie no cura. **Nadie deserta por dormir al raso** (regla de papel eliminada).

| Lugar | Opciones | Coste | Cura |
|---|---|---|---|
| Barco (hex de mar) | A bordo | Gratis | +1 PV al jugador y a sus seguidores |
| Puerto | Posada solo el jugador | `precioPosada` (5) | +1 PV solo al jugador |
| | Posada para todos (si hay seguidores) | 5 por personaje | +1 PV a todos |
| | Intemperie | Gratis | Nada. **En un puerto no hay eventos nocturnos** |
| Monasterio | Igual que el puerto | `precioMonasterio` (7) por personaje | Igual |
| | Intemperie | Gratis | Nada; puede haber evento nocturno |
| Playa, jungla, jungla profunda | Intemperie | Gratis | Nada; puede haber evento nocturno |
| Aldea | Intemperie | Gratis | Nada; puede haber evento nocturno |
| | Convencer a los aldeanos de que te dejen dormir en la aldea | — | **Sprint 6**, con su tabla (hay que retocarla) |

- **Evento nocturno:** a la intemperie, salvo en un puerto: `AJUSTES.probabilidadEventoNocturno` (33 %, el "1-2 en 1d6" del papel), elegido de la lista ponderada de eventos nocturnos.
- Solo se curan los que duermen bajo techo (o a bordo).
- **Tabla de papel para dormir en la aldea (a retocar en el Sprint 6):** con vínculo nativo se descansa como en el barco. Si no, 1d6 (+1 por cada objeto entregado como regalo, **a revisar**: en las aldeas ya no se cambian objetos por nada): 1 ofendes (chequeo de Ingenio: éxito → noche a la intemperie pero puedes seguir en la aldea; fallo → debes irte y la aldea queda bloqueada) · 2 duermes a la intemperie con tirada de evento nocturno · 3 duermes a las afueras sin evento nocturno pero sin descanso · 4-7 descansas · 8+ descansas y un nativo se une (seguidor nativo). Las deserciones de esa tabla se eliminan.

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
| Inanición y "valor de ataque" | **Resuelto:** el jugador ataca 1d6, −1 por día de inanición (tope −3) |
| Naufragio, falta el 4 | **Resuelto** por el autor en su versión |
| Chequeos de Fuerza | **Resuelto:** 1d6 ≤ Fuerza |
| Notas azules / veneno | **Ignorar** |
| Pesca y caza: el PDF dice 2d6 pero las tablas van de 1 a 6 | **Por defecto 1d6** (es solo un dato del JSON, fácil de cambiar). Pendiente de confirmar por el autor |
| Reequilibrar pesca/caza y precio de la comida | **Pendiente:** ahora una reserva alimenta a todo el grupo, así que las cantidades de papel (8-15) son demasiado generosas. Se ajusta jugando |
| Cocinero | **Pendiente:** su habilidad original ya no aplica; darle otra o quitarlo |
| Inanición: ¿capacidad de carga a la mitad? | **Pendiente decidir** |
| Victoria: ¿se gana al cumplir las dos condiciones o al entrar en un puerto después? Supuestos: "visitado" = entrar en el hex; el conformista también debe visitar los 3; el puerto de inicio cuenta si es principal | **Pendiente** (sprint de la condición de victoria) |
| "Meditar" / guardado como mecánica | **Resuelto (Sprint 5):** "meditar" desaparece; no se guarda en monasterios |
| El mal está a bordo, fila 5: el −1d6 de tripulación puede dejarte a 0 y hacerte perder aunque derrotes a la criatura | **Pendiente:** hoy está como en el libro |
| Motín estando a pie, lejos del barco | **Pendiente:** hoy puede saltar siempre; se ajustará al escribir el evento |
| Dónde empieza el jugador | **Resuelto:** cada mapa declara su casilla de inicio; en el prototipo, 009.000 a pie (E001) |
| Motín: la tabla pegada tiene dos filas "1" (la segunda será el 2) y la opción 3 ("Te escondes") no dice si da modificador | **Pendiente** al programar el evento |
| Amuleto kalinago: el libro (E036) dice +2 en audiencia y buscar información en aldeas; las reglas, +1 en audiencia | **Resuelto:** +1 en `audiencia_aldea` y +1 en `buscar_info_aldea` |
| Ídolo dorado: ¿mágico? | **Resuelto:** no (no da fama). Idea apuntada: "objetos legendarios" que den fama sin ser mágicos |
| Lira de las sirenas (E037, "+2 fama") | **Resuelto:** 2 de fama en total (+1 por mágica y +1 del evento) |
| El afortunado | **Resuelto:** solo en combate (ver 3.5) |

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

**Ids de eventos ya asignados** (código del libro → id): E002 `islote`, E003 `piratas_hostiles`, E004 `aldea`, E008 `barco`, E009 `vientos_fuertes`, E010 `vientos_favorables`, E011 `imprevisto`, E012 `rocas`, E013 `perdidos`, E014 `objeto`, E015 `sirenas`, E016 `polizon`, E017 `bob_vendedor_ambulante`, E018 `el_mal`, E019 `motin`, E020 `pandemia`, E024 `rumores`, E026 `monstruo`, E028 `tierra`, E030 `traicion`, E031 `escondite`, E033 `escorbuto`, E034 `tormenta`, E035 `botella`, E038 `guarida_pirata`, E039 `nido`, E040 `ruinas`, E042 `audiencia_gobernador`, E046 `nativos_hostiles`, E047 `bloqueado`, E048 `manantial`, E051 `explorador`, E052 `plantas_carnivoras`, E053 `esqueleto`, E054 `ritual`, E055 `nativos`, E056 `golem`, E058 `cabana`, E059 `picadura`, E061 `jaguar`, E062 `arenas_movedizas`, E063 `campamento`, E064 `dinosaurio`, E065 `marina`, E066 `bruja_vudu`, E067 `puente`, E068 `lluvias`, E069 `pantano`, E070 `sol`, E071 `pescador`, E072 `piratas_perdidos` (en barco: bote a la deriva; en tierra: deambulando; es el mismo evento), E074 `tesoro_enterrado`, E075 `ermitano`, E078 `pirata_maldito`, E079 `cartografo`, E080 `misioneros`, E081 `taberna_clandestina`, E082 `mercado_de_esclavos`, E083 `contrabandista`, E084 `subasta_secreta`, E085 `piratas_esqueleto`, E086 `fugitivo`, E087 `carruaje`, E088 `cueva`, E089 `cangrejo`, E090 `volcan`. Las listas son orientativas: faltan eventos y están sin equilibrar.

### Implementado en `core/tablas/` (Sprint 3; tipos de tablas en `rangos/`, `efecto.ts` en la raíz)

```ts
// efecto.ts
export const RECURSOS = ['oro', 'comida', 'tripulacion', 'vida', 'fama', 'fuerza', 'ingenio', 'vidaMax'] as const;
export type TipoRecurso = (typeof RECURSOS)[number];
export const CARACTERISTICAS = ['fuerza', 'ingenio', 'vidaMax'];   // nunca bajan de 1: sin "todo" ni fijar a 0
export const OTROS_EFECTOS = ['ganar_objeto', 'perder_objeto', 'poner_condicion', 'quitar_condicion', 'perder_turnos', 'bandera'] as const;
export const OPERACIONES = ['sumar', 'fijar', 'mitad', 'maximo', 'todo'] as const;     // sin poner = sumar
export const RECURSOS_CON_MAXIMO = ['vida', 'tripulacion', 'comida'];                 // los únicos con "maximo"
export const DESTINOS = ['jugador', 'todos', 'seguidor_azar', 'seguidor_elegido'] as const;  // sin poner = jugador; solo vida
export const FINES_DE_PARTIDA = ['ganar_partida', 'perder_partida'] as const;
export type CantidadDefinicion = number | string;          // 8, -1  o  "2d6" / "1d6x10" / "1d6+1" / "-1d6" (el signo menos = se resta)
export type EfectoDefinicion =                             // tal como se escribe en el JSON
  | { tipo: TipoRecurso; operacion?: 'sumar' | 'fijar'; cantidad: CantidadDefinicion; destino?: Destino }
  | { tipo: TipoRecurso; operacion: 'mitad' | 'maximo' | 'todo'; destino?: Destino }  // dependen del estado: aplicarEfectos
  | { tipo: FinDePartida }
  | { tipo: 'ganar_objeto' | 'perder_objeto'; objeto: string }                     // id del catálogo de objetos
  | { tipo: 'poner_condicion'; condicion: string; turnos?: CantidadDefinicion }     // sin turnos = hasta que algo la quite
  | { tipo: 'quitar_condicion'; condicion: string } | { tipo: 'quitar_condicion'; categoria: CategoriaCondicion }
  | { tipo: 'perder_turnos'; cantidad: CantidadDefinicion }
  | { tipo: 'bandera'; bandera: string };                                            // hecho general que el juego recuerda
export type Efecto = /* igual, pero con cantidades y turnos ya convertidos en números (+ ganar, − perder) */;

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
13. **El revisor de tablas comprueba los catálogos (Sprint 4):** un `objeto` o una `condicion` que no existe en su catálogo es un error ("mano_de_mona"). También avisa de campos que sobran en un efecto.

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
4. ✅ Efectos y estado ampliado: catálogos de objetos y condiciones, vocabulario de efectos, `calcularModificador` ampliado y `aplicarEfectos` con el chivato de cambios (sección 0 y 3.5).
   - ✅ Clasificación del libro de eventos (sección 3.9).
5. ✅ Ciclo de turno: inicio de turno, comida (hambre, deserción, motín) y descanso, con las fichas de condición completas (secciones 0 y 3.10).
6. Seguidores (efecto "se une un seguidor", catálogo de tipos, `inseparable`, bonificadores de seguidores), **condiciones otorgadas** por objetos, sobrenombres y seguidores (amuleto maldito, vínculo nativo con icono; sección 3.10), **pasar de la fase de acción a la de comida**, monasterio (rezar y descansar por 20 de oro), objetos (usos, descarte, vender en puertos y aldeas, elegir qué tirar si no cabe) y acciones sin eventos (pescar, cazar, comida, reclutar, descansar, enterrar tesoro). **Tablas que faltan** (cada una llega con su acción; las que mandan a eventos dependen de la clasificación del libro): contratar (discurso 1d6, con oro 1d6×5, seguidores 2d6), comprar/vender comida (1d6), audiencias (gobernador, jefe de aldea, capitán pirata), investigar naufragio (con subtablas), registrar ruinas (2d6), **dormir en la aldea** (1d6, a retocar; sección 4.7) y **buscar información en aldeas** (tabla propia, 3d6).
7. Combate normal (con habilidades especiales de enemigos, sección 3.9; el afortunado) y naval provisional.
8. Guardado (autoguardado, exportar/importar, versión).
9. Mapa (conversión `.wxx` → JSON, SVG), viajar (respetando `prohibe: viajar`, avisando de las llegadas para `alLlegar` y calculando el lugar para comida y descanso), `posicionBarco`, eventos de una sola vez en las listas de terreno, eventos que cambian el mapa y condición de victoria (con `famaObjetivoActual`).
10. Motor de eventos (punto único de tiradas con botones de objetos, atajos de escritura, paso "elige una cantidad", condiciones de ubicación) y primeros eventos reales (3-4 variados) para validar el formato.
11. Contenido, interfaz pulida, minijuego naval y, más adelante, backend.

Hasta el punto 8 no hace falta ni mapa ni libro de eventos. El 9 necesita el `.wxx`.

## 10. Pendiente del autor

- Archivo **`.wxx`** del mapa prototipo.
- **Erratas del libro de eventos:** E008 barco negrero, opción 1, dice E018 (es E082, confirmado); "2dx10", "2x6x10" y "2dx6x10" en E008, E082 y E087 son `2d6x10` (confirmado); E044 resultado 3-4 dice E041 (debería ser E042); E072 piratas neutrales 5-6 dice E023 (seguramente E038); E081 beber y bailar 5 dice E041 (¿E044?); "8" suelto en E020; doble "1" en E019; en las tablas de dirección, "E" debe ser "NO".
- Confirmar si el +1 del **influyente** al buscar información vale solo en puertos o también en aldeas.
- Decidir la **comida máxima** definitiva jugando (ahora 20).
- Confirmar **pesca y caza en 1d6** y, más adelante, reequilibrar cantidades y precio de la comida.
- Rehacer la habilidad del **cocinero** (o quitarlo) y decidir la **capacidad de carga** en la inanición.
- Completar y equilibrar las **listas de eventos por terreno** (ya pasadas del papel, faltan algunos eventos).
- **Libro de eventos**, empezando por 3-4 muestras variadas (tirada, decisión, combinado, con llamada y vuelta, y una con regla especial como el mapa del tesoro).
- Tabla de objetos mágicos (E037), lista de objetos y estadísticas de enemigos y barcos.
- Decidir cómo encaja el guardado con el diseño roguelike (sección 3.7), el momento exacto de la **victoria** y el diseño del **minijuego naval** (y con él, las **mejoras del barco**).
- Decidir qué **eventos solo pueden salir una vez por partida** (de momento, el mal está a bordo).
- Retocar la **tabla para dormir en la aldea** (sección 4.7).
- Equilibrar jugando los precios de `data/ajustes.json`: taberna (5), posada (5) y monasterio (7).
- Decidir los **nombres de los tipos de seguidor** (hoy el vínculo nativo busca el tipo `nativo`, provisional) y la carpeta de las imágenes.
- Decidir si la fila 5 de **El mal está a bordo** puede dejarte sin tripulación, y si el **motín** puede saltar estando a pie.
- Revisar sobre la marcha la **clasificación del libro de eventos** (`claude/clasificacion-libro-eventos.md` en el proyecto de Claude).
- Dibujos de objetos y condiciones (mientras tanto, iconos de reserva por categoría).
- Escribir la **tabla de buscar información en aldeas nativas** (3d6, mismos rangos que la de puertos).
