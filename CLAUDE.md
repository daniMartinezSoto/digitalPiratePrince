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
  - `data/ajustes.json`: `comidaMaxima` (20, provisional; hoy 12).
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
  - ✅ Estado: `Seguidor.inseparable?`. Cambio nuevo `seguidor_se_marcha`. `data/ajustes.json`: `precioTaberna` (5; hoy 4), `precioPosada` (5), `precioMonasterio` (7), `probabilidadEventoNocturno` (33; desde el Sprint 7, por terreno).
  - **La fase de acción sigue siendo un hueco:** `iniciarTurno` deja el día en `accion` y todavía nada lo pasa a `comida`; lo harán las acciones del Sprint 6.
- **Sprint 6: completado (seguidores, objetos y acciones sin eventos, 17-18 nov).** Todas las decisiones y lo programado, en la sección 3.11: seguidores y el hermano, condiciones vigentes (apuntadas, partes, otorgadas), amuleto maldito completo, objetos (usar, tirar, elegir qué tirar, precios), y las acciones pescar, cazar, reposar, ir al mercado (con rastrillo), contratar (discurso, marineros, seguidor), monasterio (rezar, descansar), enterrar tesoro, buscar información (puertos, aldeas y guaridas), solicitar audiencia, la guarida pirata (dados y pulso), investigar naufragio, registrar ruinas y mendigar; además dormir en la aldea (chequeo de Ingenio) y los chequeos.
- **Sprint 8: completado (guardado, 19-nov).** Decisiones y plan en la sección 3.7.
  - ✅ Paso 1 (19-nov): formato de la partida guardada y semilla en el estado. `mundo.semilla` (la rellena `crearPartida`; no cambia nunca). Carpeta nueva `core/guardado/`: `guardarPartida(estado)` (estado → texto), `leerPartida(texto)` (nunca rompe: `{ ok: true, estado }` o `{ ok: false, motivo }` con `no_se_puede_leer`, `no_es_una_partida` o `version_futura`), `tieneFormaDePartida` (solo la forma, no los catálogos), adaptadores por versión (`ADAPTADORES`, vacío; `adaptarPartida` los encadena y sube la versión) y `dadosDePartida(estado)`. 38 tests en `guardado.spec.ts`.
  - ✅ Paso 2 (19-nov): la crónica, en `core/guardado/cronica.ts`. `EntradaCronica` (semilla, nombre, sobrenombre, retrato, días, fama, oro, resultado, motivo y `fecha` como texto ISO que pone el store), `crearEntradaCronica(estado, fecha)` (error si la partida no ha terminado), `ordenarCronica` y `anadirACronica` (fama, luego oro y, si empatan, **la más antigua arriba**, decidido por el autor), `guardarCronica` (`{ version: VERSION_CRONICA, entradas }`; la crónica tiene su propia versión) y `leerCronica` (nunca rompe; una ficha estropeada se descarta y se quedan las buenas: `{ ok: true, entradas, descartadas }`). `fin-partida.ts` exporta ahora `RESULTADOS_DE_PARTIDA` y `MOTIVOS_DE_FIN`. 24 tests en `cronica.spec.ts`. **Para el paso 4:** si `leerCronica` falla, el store NO debe escribir encima (perdería el historial).
  - ✅ Paso 3 (19-nov): el almacén (el "cajón" donde se deja el texto). `core/guardado/almacen.ts`: interfaz `Almacen` con tres botones síncronos (`leer(clave)` → texto o `null`; `escribir(clave, texto)` → `true`/`false`; `borrar(clave)`) y `CLAVES_DE_GUARDADO` (`pirate-prince.partida`, `pirate-prince.cronica`). `AlmacenEnMemoria` (de mentira, para tests; `fallarAlEscribir` y `fallarAlLeer` fingen que el navegador se niega). **Primera carpeta `store/`:** `store/almacen-local.ts` con `AlmacenLocal` (localStorage, cada botón en `try/catch`: nunca rompe) y `pedirGuardadoPersistente()` (`navigator.storage.persist()`; `false` si no se admite o falla). El día de la nube habrá otro almacén con los mismos botones, pero asíncronos (y el store con ellos). 21 tests (9 en memoria, 12 del navegador con jsdom).
  - ✅ Paso 4 (19-nov): **el store, el primero del proyecto** (`store/juego.store.ts`, `JuegoStore`, servicio de Angular `providedIn: 'root'`). Signals de solo lectura `estado` (null = no hay partida; si ha terminado, la hoja final para la pantalla de resultados), `cronica`, `avisos` y `hayPartidaEnCurso`; los `Dados` aparte. **Al arrancar:** `pedirGuardadoPersistente()`, lee la crónica y la partida (si está estropeada o es de una versión futura: copia de seguridad en `pirate-prince.partida.estropeada`, aviso `partida_no_recuperada`). **`nuevaPartida(nombre, retrato?, semilla?)`** (error si hay una en curso; sin semilla, `semillaAlAzar()`: el único uso del azar del navegador). **`ejecutar((estado, dados) => regla(...))`: la puerta única de todas las acciones**; guarda en el acto (sin `effect`, de forma síncrona), apunta él mismo `mundo.estadoDados` y, si la regla da error, deja la partida y los dados como estaban; devuelve el resultado completo. **`abandonar()`** (decidido por el autor): derrota con el motivo nuevo **`abandono`** (`core/partida/abandonar-partida.ts`). **Al terminar** (ganar, morir o abandonar): ficha a la crónica con la fecha del `RELOJ` y partida fuera del almacén. **Crónica estropeada:** copia en `pirate-prince.cronica.estropeada` y crónica nueva; si ni la copia se puede hacer, no se escribe encima en toda la sesión. Avisos: `no_se_pudo_guardar`, `partida_no_recuperada`, `cronica_estropeada` (`descartarAvisos()`). Piezas cambiables para tests (`InjectionToken`): `ALMACEN`, `RELOJ`, `GENERAR_SEMILLA`. **Semilla de 6 cifras** (decidido por el autor): `core/partida/semilla.ts` (`SEMILLA_MAXIMA` 999.999, `esSemillaValida`). 40 tests nuevos (27 del store con `TestBed`, 13 de abandonar y semilla).
- **Pantalla de pruebas (en curso, tras el Sprint 8; decidido por el autor el 19-nov):** interfaz fea a propósito (sin estilos) para ver funcionar las reglas antes del mapa (Sprint 9). Reglas de la interfaz en la sección 3.2.
  - ✅ Paso 1 (19-nov): crear personaje y ver la hoja. Carpeta `ui/` nueva: `ui/rutas.ts` (`RUTAS`: `/` y direcciones desconocidas → `/partida` si hay partida en curso, si no `/nueva-partida`; guardias `sinPartidaEnCurso` y `conPartida`; `app.routes.ts` solo las reexporta), `ui/pantallas/nueva-partida/` (nombre, retrato, semilla opcional comprobada con `esSemillaValida`, avisos en pantalla y la crónica), `ui/pantallas/partida/` (día y fase, avisos del guardado con "Entendido", Abandonar con confirmación, "PARTIDA TERMINADA" y botón Nueva partida) y `ui/componentes/hoja-personaje/` (solo pinta). Consulta nueva en `core/personaje/hoja-de-personaje.ts` (`hojaDePersonaje(jugador)`: la hoja lista para enseñar, con nombres de los catálogos y fuerza, ingenio, vida máxima y fama objetivo de las consultas). `app.html` es solo `<router-outlet />` (fuera la bienvenida de Angular; `app.spec.ts` rehecho). Ayudas de test en `ui/probar-pantallas.ts` (`prepararJuego`, `abrir`, `escribir`, `pulsar`). **Vigilante:** `npm run vigilar` (`scripts/vigilar-core.mjs`) falla si algún archivo de `core/` importa Angular, `store/` o `ui/` (es un script aparte porque `ng test` corre como un navegador).
  - ✅ Arreglos tras probarla el autor (19-nov): **sobrenombres en femenino** con el retrato de mujer (campo `nombreFemenino` en `sobrenombres.json`: "La maldita", "La hermana", "La heredera"...; la hoja lo usa); la descripción del afortunado dice "solo en combate"; **las partes del amuleto se ven como "Hedor nauseabundo (Amuleto maldito)"** en vez de con su categoría (`dentroDe` en la hoja): el amuleto es una sola maldición con dos efectos dentro. Con la semilla 7 el lado bueno es el **deseo**, que es un evento (pendiente hasta el Sprint 10), así que solo se ve la maldición; la semilla 45 enseña los dos lados (carisma + ambición desmedida).
  - **El heredero empieza sin objeto** porque falta la tabla de objetos mágicos (E037). Decidido por el autor (19-nov): se queda así hasta que exista la tabla (nada provisional).
  - ✅ Paso 2 (19-nov): el día con botones. `ui/ubicacion.ts` (`Ubicacion`: lugar, terreno, junto al agua, rasgo y una casilla inventada col/fila; `sitioDe`), componentes `donde-estas` (los selectores provisionales hasta el mapa), `panel-del-dia` (botones según la fase: "Empezar el día" = `iniciarTurno`; todas las acciones de `accionesDisponibles` con su motivo; las de un clic funcionan, las de varios pasos salen con "llega en el paso 3"; comer y dormir con sus precios) y `registro` (lo que pasa, lo más nuevo arriba). Servicio `ui/servicios/registro.ts` (solo de la pantalla, no se guarda). Textos de pantalla en `ui/textos/` (`textos.ts`: nombres de acciones, lugares, comida y descanso, `textoDeMotivo`, `describirCambio`, `describirTirada`; `lineas-del-registro.ts`). Al empezar partida, el registro apunta la semilla y los eventos pendientes (el deseo). Buscar información va sin sobornos de momento.
  - ✅ Arreglos tras probar el paso 2 (19-nov, decididos por el autor): **el superviviente consigue la comida él solo en la jungla y en la jungla profunda** (las dos): elección de comida nueva `superviviente` (`SOBRENOMBRE_SUPERVIVIENTE`, `TERRENOS_DEL_SUPERVIVIENTE` en `core/turno/comer.ts`; `opcionesDeComida` y `comer` reciben el `terreno` opcional; botón "Conseguir comida (Superviviente)"). **Las condiciones enseñan lo que implican** (su descripción del catálogo, entre paréntesis; más adelante, al pasar el ratón). Pagar la comida con oro en la aldea solo con vínculo nativo: era correcto (el autor tenía un seguidor nativo). Textos: motivos "Solo en puertos y guaridas" y "Solo en puertos, guaridas y aldeas" (las guaridas también valen), fase con su nombre ("acción"), sobrenombre con nombre bonito en la crónica (`nombreDeSobrenombre` en `hoja-de-personaje.ts`), descripción del superviviente sin "él" y "Amanece. Ninguna condición hace nada.".
  - ✅ Decidido por el autor (19-nov): **los puertos y las guaridas cuentan siempre como junto al agua** para pescar (`sePuedePescar`; en la pantalla ya no sale la casilla "junto al agua" allí). **El superviviente en la jungla ve los dos botones** (conseguir comida y comer de las reservas): el autor no quiere quitar opciones al jugador.
  - **Jugador automático (19-nov):** Claude jugó ~500.000 días de partidas al azar (todas las acciones, también las de varios pasos, objetos, comida y descanso, en todos los lugares), 11.000 combates y 5.500 combates navales con las funciones reales, comprobando en cada paso: recursos y vida dentro de sus topes, guardar y leer idéntico, `estadoDados` al día, que lo que sale "disponible" funciona y lo "desactivado" da error, que el estado no se modifica por dentro (objetos congelados), que los cambios (el chivato) cuadran con el estado final y que las fases avanzan bien. **Cero fallos.** El script vive en la máquina de Claude (no en el repo).
  - ✅ Paso 3 (19-nov): las acciones de varios pasos y los sobornos. Componentes nuevos `mercado` (comprar y vender comida, vender cada objeto, rastrillo con casillas para marcar qué se tira si no cabe, salir), `marineros` (elegir cuántos), `seguidor-en-espera` (ficha del que se ofrece, contratar despidiendo a uno si el grupo está lleno, rechazar) y `mesa-de-dados` (apostar hasta levantarse). El panel del día enseña solo la acción a medias mientras dura (y sigue dentro al recargar), y pide antes la apuesta del pulso y los sobornos de buscar información en un puerto (con "Cancelar"). Servicio nuevo `ui/servicios/jugar.ts` (`Jugar.hacer`: `store.ejecutar` + registro; si la regla falla, apunta ERROR). Textos nuevos para mercado, apuestas, pulso y monos. **Fallo encontrado por los tests:** los ids de seguidor se reutilizan (despides a `forzudo_1` y el nuevo forzudo vuelve a ser `forzudo_1`), así que el registro nombraba mal al despedido; ahora los textos reciben los nombres de antes y de después (`NombresDeSeguidores`). El reaprovechamiento de ids es así en `core/` (no es un fallo de reglas).
  - ✅ Pedido por el autor (19-nov): **el nombre del seguidor se ve antes de contratarlo** ("Cornelius Sinvergüenza (Pirata experto)"): `buscarSeguidor` lo sortea ya (`sortearNombreDeSeguidor` en `core/seguidores/crear-seguidor.ts`, gasta un número) y lo guarda en `SeguidorEnEspera.nombre`; `opcionesDelSeguidor` lo devuelve; `contratarSeguidor` lo pasa en el efecto `ganar_seguidor` (campo interno nuevo `nombre`, no se escribe en el JSON; el revisor ya lo rechaza) y `crearSeguidor` acepta `opciones.nombre` (entonces no tira dados). Partidas guardadas con un seguidor esperando sin nombre: se sortea al contratar. **Trampas de prueba** (`ui/componentes/trampas/`, desplegable en la pantalla de partida; no existirán en el juego): −10 tripulación, +100 oro, comida a 0, +5 comida, −5 vida, vida al máximo, +1 fama, darse un objeto, ponerse o quitarse una condición y darse un seguidor, todo con `aplicarEfectos`. (La tripulación inicial, 40, está escrita en `crear-personaje.ts`; para probar se usan las trampas.)
  - ✅ **Máximo de seguidores: 2** (3 con carisma), decidido por el autor el 20-nov (`data/ajustes.json`, `maximoSeguidores`; los tests del amuleto y de la pantalla, ajustados). Relacionado con la duda abierta de "seguidores demasiado fuertes en combate" (sección 10, opción c).
  - **Victoria, decidido por el autor (20-nov): se gana al LLEGAR a cualquier puerto con las dos cosas ya cumplidas** (10 de fama, o la objetivo actual, y los 4 puertos principales visitados): un regreso triunfal. El conformista también necesita los 4 puertos. Se programa en el paso 4 (puerto elegido a mano) y de verdad con el mapa.
  - **Victoria (aclarado al autor el 19-nov):** llegar a 10 de fama todavía no hace ganar porque falta la otra mitad, los puertos; la victoria normal se programa con el mapa (Sprint 9). **Decidido: 4 puertos principales** (Tortuga, Port Royal, La Habana y Nassau, uno por esquina). Propuesta para el paso 4: elegir en "¿dónde estás?" qué puerto es, apuntarlo en `mundo.puertosVisitados`, enseñar "Puertos 1/4" y ganar al cumplir las dos cosas. El momento exacto ya está decidido (línea de arriba).
  - **Hueco detectado:** la pantalla de pruebas todavía no deja **usar ni tirar objetos** (`usarObjeto`, `tirarObjeto`: el ungüento no se puede usar). Va en el paso 4.
  - **Siguiente (paso 4):** el combate en texto (combate de prueba normal y naval, con la pantalla del combate; plan ya presentado al autor) y el viaje parcheado (elegir a mano el terreno de destino).
- **Sprint 7: completado (combate normal y naval, 18-19 nov).** Decisiones en las secciones 3.12 (normal) y 3.13 (naval).
  - ✅ Paso 1: bestiario. Ficha `core/catalogos/enemigo.ts` (`id`, `nombre`, `descripcion?`, `imagen?`, `ataque`, `resistencia`, `libro?`), `data/enemigos.json` (34 enemigos de combate del libro, con sus números), cargador `cargar-enemigos.ts` (`ENEMIGOS`, `obtenerEnemigo`) y revisor `validar-enemigo.ts`.
  - ✅ Paso 2: tiradas de ataque en `core/combate/ataque.ts` (carpeta nueva): `ataqueDelJugador(castigo, dados)`, `ataqueBasico(ataque, castigo, dados, noPuedeFallar?)` (enemigos y seguidores), `castigoPorHambre(diasSinComer)` (tope `AJUSTES.castigoHambreMaximo`, 3) y `reducirDano(dano, reduccion)` (mínimo 1 si acierta). Devuelven `TiradaDeAtaque { dados, acierta, danoSinCastigo, castigoHambre, dano }`. Piel de piedra en datos: ajuste de condición nuevo `reduccionDano` (la ficha `piel_de_piedra` lleva 1) y consulta `reduccionDanoActual(jugador)`. Ayuda solo para tests: `core/dados/dados-trucados.ts` (`dadosTrucados([6, 6, 1])` saca esos números en orden; `restantes()`).
  - ✅ Paso 3: emparejamiento en `core/combate/emparejamiento.ts`: `Objetivos` (`Record<id, id>`: quién ataca a quién), `emparejar(aliados, enemigos, dados)`, `reemparejar(objetivos, aliadosVivos, enemigosVivos, dados)` y `atacantesDe(objetivos, id)`. Cada elección al azar gasta un número (ninguno si solo hay una opción); orden fijo: aliados y luego enemigos.
  - ✅ Paso 4: el combate en `core/combate/combate.ts`: `iniciarCombate(estado, pedidos, dados)` (pedidos `{ enemigo, cantidad?, ataque?, resistencia? }`; enemigos `enemigo_1`, `enemigo_2`... con nombre numerado solo si se repite el tipo), `atacar(estado, dados)` (una ronda; devuelve `{ estado, sucesos, cambios }`), `cerrarCombate(estado)` y las consultas `aliadosQueLuchan`, `enemigosVivos`. Estado: `mundo.combate: CombateEnCurso | null` (`core/estado/combate.ts`: `enemigos`, `objetivos`, `ronda`, `resultado`). Mientras hay combate, todo lo demás da error o sale desactivado (motivo `combate_en_curso`). Id de tirada nuevo `ataque` (bonificador al daño; el maleficio del pirata lleva −1). Efecto interno nuevo `herir_seguidor`. Bandera `afortunado_usado`.
  - ✅ Paso 5: huida. `huir(estado, dados)` (1d6, con 4+ termina en `huida`; si falla, `combate.noPuedenFallar` y en la próxima ronda los enemigos aciertan siempre, suceso `enemigos_no_fallan`), `opcionesDeCombate(estado)` (botones Atacar y Huir; Huir desactivado con `primera_ronda`, `acabas_de_fallar` o `no_se_puede_huir`) y opción `{ puedeHuir: false }` en `iniciarCombate` (combates dentro del barco, algunos eventos). Tras fallar hay que pelear otra ronda antes de volver a intentarlo.
  - ✅ Paso 6: habilidades de enemigos, opciones de combate, objetos de combate y recompensas (detalle en la sección 3.12). Bestiario con `categoria` (`humano`, `animal`, `no_muerto`, `criatura`) y `habilidades`. Objetos con `enCombate` y siete fichas nuevas (estoque, lanza kalinago, ron, pistola de chispa y de gran calidad, bomba de humo, poción mágica). `usarObjetoEnCombate`; `cerrarCombate(estado, dados)` devuelve `{ estado, resultado, cambios, eventos }`. Retrato del jugador: `jugador.retrato` (`hombre` | `mujer`), `crearPartida(semilla, nombre, retrato?)`.
  - ✅ Equilibrio tras las simulaciones (18-nov, decidido por el autor): **vida inicial 18** (antes 15; los tests antiguos con cuentas de 15 PV fijan `vida: 15, vidaMax: 15` en su estado de prueba). **Evento nocturno por terreno, en porcentajes:** `AJUSTES.probabilidadEventoNocturno` = `{ playa: 25, jungla: 25, jungla_profunda: 35 }` (`TERRENOS_AL_RASO` y `TERRENO_POR_DEFECTO` = jungla en `core/turno/lugar.ts`; `descansar(..., hex?, terreno?)`: el terreno lo dará el mapa en el Sprint 9). **Tienda de campaña** (`tienda_de_campana`: pasivo, 2 huecos, venta 20, en el rastrillo a 40; también irá al emporio de Bob): elección nueva `tienda` al dormir fuera de puertos y del barco; todo el grupo duerme bajo techo (puede dormir genial) y el evento nocturno baja `AJUSTES.reduccionEventoNocturnoTienda` (10) puntos. Su descripción no da porcentajes.
  - ✅ Seguidores (decidido por el autor, 19-nov): **todos combaten salvo que se diga lo contrario**. `ataque` y `resistencia` pasan a ser **obligatorios** en `data/seguidores.json` (el revisor los exige) y están escritos en todas las fichas; los que no los tenían ya usaban 2 y 10 por defecto, y ahora se ve. **Números reales del JSON (confirmados por el autor el 19-nov):** pescador, barbero-cirujano y navegante 1/10; bruja vudú 2/10. El mono sigue con ataque 0 (no entra en combate).
  - Repaso de encuentros con 18 PV hecho (informe `claude/equilibrio-combate.md`). **Decidido por el autor (19-nov), a aplicar al escribir cada evento (Sprint 10):** E087 carruaje: 3 guardias 2/6 y, si superas el chequeo de Ingenio, uno cae al empezar (quedan 2) · E082: 2 esclavistas 1/8 · E054 ritual: 3 nativos 1/5 · E065: agente 2/8 (antes 2/10) · E015: dos sirenas 2/6. **Ya cambiado en el bestiario:** el esqueleto de E053 pasa de 1/10 a 2/7 (de fácil a medio: daba un tesoro casi gratis). Los grupos van en cada evento; el agente y las sirenas se cambiarán con `ataque`/`resistencia` del pedido o en el bestiario cuando se escriban.
  - ✅ Combate naval, diseño decidido (19-nov, sección 3.13): duelo de cañones 1d6 contra 1d6, abordar a mitad de resistencia y huir con E006. Bob no se puede atacar.
  - ✅ Naval, paso 1: catálogo de barcos (`core/catalogos/barco.ts`, `data/barcos.json` con 8 barcos, cargador y revisor; 3 enemigos nuevos de abordaje).
  - ✅ Naval, paso 2: duelo de cañones (`core/combate-naval/`, `mundo.combateNaval`, `hayCombate`). Huir: 3-6 (decidido).
  - ✅ Naval, paso 3: huir, abordar (combate normal sin huida) y resumen para la pantalla de resultados.
  - ✅ Naval, paso 4: mejoras del barco (categoría `mejora`: cañones buenos, casco reforzado, velas nuevas).
  - ✅ Naval, paso 5: simulación; abordaje del galeón ajustado (capitán 3/10 + 1 soldado).
- **Tests:** a Claude le pasan 1329 en 75 archivos, ya con `app.spec.ts` (al autor le deberían salir los mismos), tras el nombre del seguidor y las trampas.

**Dónde nos quedamos (19-nov, 14:00):** **Sprint 8 terminado.** Antes del Sprint 9 (mapa), el autor ha decidido hacer la **pantalla de pruebas** (sección 0, arriba): **pasos 1, 2 y 3 hechos** (crear personaje, el día con botones y las acciones de varios pasos). **Siguiente: paso 4** (combate de prueba y viaje parcheado). **El autor ha probado a convertir los `.wxx` en mapas isométricos 3D** y le gustan mucho: al empezar el Sprint 9 se decide si el mapa definitivo es 3D o si se empieza plano y el 3D llega como "piel" después (las reglas no dependen de cómo se pinte). **Pendiente del naval:** decidir dónde se consiguen las mejoras del barco. **Idea del autor para cuando empiece la interfaz:** una pantalla de pruebas fea pero jugable cuanto antes, para ver funcionar las reglas antes del diseño bonito. El plan detallado por sprints lo mantiene el autor en un documento aparte.

---

## 1. Qué es el proyecto

Adaptación a videojuego de **Pirate Prince**, un juego de aventuras **en solitario de papel y lápiz** del autor (Daniel Martínez Soto, v0.1 Alpha, inspirado en *Barbarian Prince* de Arnold Hendrick). El jugador es un joven pirata con un barco heredado que quiere hacerse una leyenda.

- Un solo jugador, por turnos, muy basado en texto.
- Única interfaz gráfica "mecánica": un **mapa de hexágonos** por el que te mueves.
- Cada turno es un día. Se elige **una acción** según el hexágono, se resuelve con dados y tablas, y puede encadenar **eventos** (textos con decisiones, tiradas, combates, objetos...).
- **Objetivo:** conseguir **10 puntos de Fama** y haber visitado los **4 puertos principales** (uno en cada esquina del mapa: **Tortuga, Port Royal, La Habana y Nassau**; decidido por el autor el 19-nov, antes eran 3). **Se pierde** si la vida del personaje o la tripulación del barco llegan a 0.
- El autor puede **cambiar reglas al digitalizar**: lo que en papel existe para ahorrar cuentas o guiar al jugador puede automatizarse o simplificarse.

En `docs/`: el PDF de reglas (24 páginas; **no incluye el libro de eventos**) y el mapa prototipo (hecho con Worldographer). El archivo `.wxx` del mapa está pendiente de añadir al repositorio (el autor ya ha comprobado que se lee bien: sección 6).

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
- Los tests (`.spec.ts`) van junto al código. Las subcarpetas de `core/` se crean cuando toca su sprint. Existen ya: `core/dados/`, `core/estado/`, `core/personaje/`, `core/partida/`, `core/tablas/` (con `rangos/` y `listas-eventos/`), `core/modificadores/`, `core/ajustes/`, `core/catalogos/` (formatos, cargadores y revisores de catálogo: `objeto.ts`, `condicion.ts`, `habilidad.ts`, `enemigo.ts`, `barco.ts`...), `core/efectos/` (`aplicarEfectos` y `Cambio`), `core/condiciones/` (consultas sobre las condiciones activas) y `core/turno/` (las fases del día: `iniciar-turno.ts`, `comer.ts`, `descansar.ts`, `lugar.ts`), `core/amuleto-maldito/` (tablas del amuleto maldito y `recibirAmuletoMaldito`), `core/seguidores/`, `core/objetos/` (usar, tirar y consultas del inventario), `core/acciones/` (molde de acciones y las acciones sueltas), `core/mercado/`, `core/contratar/`, `core/monasterio/`, `core/guarida/` (dados y pulso), `core/chequeos/` y `core/guardado/` (guardar y leer la partida, adaptadores por versión, crónica y almacén; Sprint 8); en `store/`: `almacen-local.ts` y `juego.store.ts` (el store del juego); en `ui/`: `rutas.ts`, `pantallas/` y `componentes/` (pantalla de pruebas); datos en `data/personaje/`, `data/tablas/`, `data/eventos-terreno/`, `data/objetos.json`, `data/condiciones.json`, `data/seguidores.json`, `data/habilidades.json`, `data/nombres-seguidores.json`, `data/amuleto-maldito.json`, `data/rastrillo.json`, `data/enemigos.json`, `data/barcos.json` y `data/ajustes.json`.
- **Reglas de la interfaz (decididas por el autor el 19-nov):** Angular separado y ordenado. `ui/pantallas/` (pantallas completas, una por ruta) y `ui/componentes/` (trozos reutilizables); **cada componente en su carpeta con `.ts`, `.html` y `.css` separados** (nada de plantillas dentro del `.ts`). La interfaz **nunca cambia la partida por su cuenta**: pide al store (`nuevaPartida`, `ejecutar`, `abandonar`); sí puede usar las consultas de `core/` (solo leen). `core/` no importa Angular, `store/` ni `ui/` (lo vigila `npm run vigilar`).
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
pescar(sitio: Sitio) { this.estado.update(e => pescar(e, sitio, this.dados).estado); }   // la acción ya aplica sus efectos y devuelve el estado nuevo
```

### 3.4 Estado (implementado en `core/estado/`)
**Solo datos (serializable a JSON):** sin funciones, clases con métodos, referencias circulares, `Map`, `Set` ni `Date`. Se actualiza **sin mutar** (`{ ...estado, ... }`).

```ts
Estado  { version: number; jugador: Jugador; mundo: Mundo }

Jugador { nombre: string;            // lo elige el jugador
          sobrenombre: string;       // id del sobrenombre
          retrato: 'hombre' | 'mujer';   // su dibujo (se elige al crear; Sprint 7)
          vida, vidaMax, fuerza, ingenio: number;
          oro, tripulacion, tripulacionMax, comida: number;
          fama, famaObjetivo: number;
          diasSinComer: number;      // contador único del grupo
          inventario: ObjetoLlevado[]; capacidadInventario: number;   // huecos; un objeto puede ocupar varios
          seguidores: Seguidor[];    // máximo 2 (3 con carisma); AJUSTES.maximoSeguidores
          condiciones: CondicionActiva[];   // maldiciones, bendiciones, enfermedades, tormenta...
          fasesAccionPerdidas: number }     // turnos en los que se pierde la acción (se come igual)

Mundo   { mapaId: string | null;
          posicion: { col, fila } | null;
          dia: number;
          fase: 'inicio' | 'accion' | 'comida' | 'descanso';     // momento del día (core/estado/fase.ts)
          banderas: Record<string, boolean | number | string>;   // hechos generales
          marcas: { col, fila, tipo: TipoDeMarca, evento?, dia? }[];   // cosas en casillas concretas (TIPOS_DE_MARCA en mundo.ts; core/estado/marcas.ts)
          pilaEventos: { evento, paso }[];
          puertosVisitados: string[];                            // ids de puertos principales
          semilla: number;                                       // semilla con la que empezó (Sprint 8); no cambia nunca
          estadoDados: number;                                   // dados.obtenerEstado()
          finPartida: { resultado: 'victoria' | 'derrota';       // null mientras se juega
                        motivo: 'vida' | 'tripulacion' | 'seguidor' | 'evento' | 'abandono' } | null;
          accionEnCurso: AccionEnCurso | null;    // acción a medias: mercado, marineros o seguidor en espera (Sprint 6)
          combate: CombateEnCurso | null;         // combate en curso (core/estado/combate.ts, Sprint 7)
          combateNaval: CombateNavalEnCurso | null;   // combate naval en curso (core/estado/combate-naval.ts, Sprint 7)
          nochePagada: boolean;                   // noche pagada (monasterio o fiesta en aldea); vuelve a false al acabar el día
          comidaGratis: boolean;                  // hoy come gratis (fiesta en aldea); vuelve a false al acabar el día
          ultimaBusquedaInformacion: number | null }   // día de la última búsqueda de información

Seguidor { id: string; tipo: string; nombre: string; ataque: number;   // ataque = daño que hace si acierta
           resistencia, resistenciaMaxima: number;                     // resistencia = su vida
           habilidades: string[];                                      // ids del catálogo de habilidades
           inseparable?: boolean;                                      // true = nunca se marcha por su cuenta (sí puede morir)
           vital?: boolean }                                           // true = si muere, se pierde la partida (el del hermano)

ObjetoLlevado   { id: string; usosRestantes?: number }   // en la partida solo esto; el resto, del catálogo
CondicionActiva { id: string; turnosRestantes?: number; partes?: string[] } // sin turnos = hasta que algo la quite; partes = lo que lleva dentro (amuleto)

// Catálogos (core/catalogos/, datos en data/): lo que no cambia durante la partida
Objeto    { id, nombre, descripcion; imagen?; tipo: 'pasivo' | 'activo'; usosMaximos?; espacios? (1);
            cuandoSeUsa? ('accion' | 'evento' | 'combate'; solo activos); alUsar? (efectos al usarlo; solo activos);
            precioVenta (obligatorio, mágicos incluidos); magico? (+1 fama al conseguirlo); modificadores?; otorga?; banderaAlVender? }
Habilidad { id, nombre, descripcion; imagen?; tipo: 'pasiva' | 'activa'; modificadores?; ajustes?; otorga? }  // sin cooldowns
Condicion { id, nombre, descripcion; imagen?; categoria: 'maldicion' | 'bendicion' | 'enfermedad' | 'clima' | 'mejora' | 'otra';   // mejora = del barco (Sprint 7)
            modificadores?;                       // bonificadores a tiradas mientras dura
            prohibe?: Prohibicion[];              // 'viajar' | 'enterrar_tesoro' | 'nuevos_seguidores' (las audiencias no se prohíben)
            ajustes?: { famaObjetivo?, comidaPorDia?, fuerza?, ingenio?, vidaMax?, maximoSeguidores?, reduccionDano?, reduccionDanoNaval? };   // se suman a la regla normal
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
  - Objetos: solo entran si caben (cuenta `espacios`); los activos entran con `usosMaximos`; **los mágicos dan +1 de fama**. Si no cabe, no entra, salvo que el efecto diga qué se tira para hacerle sitio (`tirar`, Sprint 6). Perder un objeto quita uno si lo tienes.
  - Condiciones: **no se duplican** (se queda la que dure más; sin turnos = para siempre). Quitar por categoría quita **una, la más antigua**.
  - Turnos perdidos se suman a `fasesAccionPerdidas`; las banderas se apuntan en `mundo.banderas` (solo banderas generales; las de un hex concreto, Sprint 9).
  - **El contable:** cada vez que GANA oro (sumar positivo; no fijar) gana **1d6** más (era 2d6; cambiado por el autor el 18-nov).
  - **Fin de partida:** vida o tripulación a 0 → derrota; `ganar_partida` / `perder_partida` → victoria / derrota por evento. Se apunta en `mundo.finPartida` y **los efectos que quedan ya no se aplican**. Qué se hace después (pantalla, guardado) es de sprints posteriores. La victoria normal (fama + puertos) llega con el mapa (Sprint 9).
- **El afortunado (decidido):** evita la muerte **una vez, solo en combate** (se queda con 1 PV). Se programa en el combate (Sprint 7), no en `aplicarEfectos`.
- **Excepción: la contabilidad del turno (Sprint 5).** Las funciones de `core/turno/` cambian por su cuenta (siempre devolviendo una copia) lo que es del propio turno y no un efecto de juego: `mundo.fase`, `mundo.dia`, `mundo.estadoDados`, gastar una fase de acción perdida, restar turnos a las condiciones, `diasSinComer` y los seguidores que se marchan por hambre. Todo lo demás (recursos, condiciones, objetos, fin de partida) sigue pasando por `aplicarEfectos`.
- **El chivato (`Cambio`, `core/efectos/cambio.ts`):** lista de **cambios reales** (con la tripulación en 38 y máximo 40, un +5 produce "de 38 a 40"; si no cambia nada, no se apunta). Tipos: `recurso` (con `motivo` opcional: `contable`, `objeto_magico`), `resistencia_seguidor`, `seguidor_muerto`, `seguidor_se_marcha` (se va por su cuenta; no es morir; `motivo` opcional `carisma_perdido`), `seguidor_se_une`, `seguidor_no_se_une`, `seguidor_despedido`, `objeto_ganado`, `objeto_no_cabe`, `objeto_perdido`, `objeto_tirado`, `objeto_usado`, `objeto_agotado`, `objeto_vendido`, `condicion_puesta`, `condicion_quitada`, `condicion_no_puesta`, `turnos_perdidos`, `bandera`, `fin_partida`. **Son datos, no mensajes:** la interfaz los convierte en notificaciones. Los mensajes narrativos pertenecen a los eventos; efectos y tablas no llevan mensajes.

### 3.6 Decisiones obligatorias desde el día uno
1. **Estado serializable** (ver 3.4).
2. **Dados con semilla (seeded PRNG)**, nunca `Math.random()`: partidas reproducibles, depuración por semilla y, a futuro, verificación en servidor. Incluye los porcentajes (deserción, motín): usar `dados.probabilidad(p)`.
3. **`banderas` y `marcas`** en el estado y **modificadores por identificador de tirada** (sección 7).

### 3.7 Guardado (Sprint 8; diseño decidido por el autor el 19-nov; completado)

**Decidido:**
- **Solo roguelike:** una única partida en curso, **sin ranuras** (de momento), sin guardar ni cargar a mano y sin volver atrás. **Morir (o ganar) termina la partida**: se borra y pasa a la crónica. Un modo "fácil" con vuelta atrás queda descartado por ahora.
- **Si el jugador cierra el juego, la partida queda guardada** y al volver sigue exactamente donde estaba (también a mitad de un combate, del mercado o de un evento).
- **Autoguardado en CADA cambio del estado** (no solo por fases): se guarda en un único sitio, el store, cada vez que cambia el signal del estado. Es barato (la partida ocupa pocos KB; escribir tarda menos de un milisegundo), más sencillo de programar que guardar por fases y cierra la trampa de "cerrar antes de que se guarde y elegir otra cosa" (con los dados con semilla, cargar ya no cambia la suerte: `mundo.estadoDados` se guarda con todo).
- **Dónde:** en el navegador (`localStorage`), detrás de una pieza intercambiable ("almacén") para poder guardar en la nube algún día sin tocar el resto. Al arrancar, pedir `navigator.storage.persist()` para que el navegador no borre los datos por su cuenta. **Aviso conocido:** si el jugador borra "cookies y datos de sitios" o juega en incógnito, se pierden la partida y la crónica (borrar solo el historial no afecta).
- **Semilla en el estado:** campo **`mundo.semilla`** (hecho en el paso 1) (hoy solo se guarda `estadoDados`, el punto en que van los dados). **El jugador debe poder verla** durante la partida y en la crónica (la pantalla, con la interfaz). Servirá para repetir una partida o retar a otro con la misma semilla.
- **Versión:** `VERSION_ESTADO` sigue en 1 (aún no existe ninguna partida guardada que adaptar). Sistema de **adaptadores por versión** (1 → 2, 2 → 3...) preparado desde el principio, vacío de momento. Una partida de una versión más nueva que el juego no se carga.
- **Crónica (decidido por el autor):** al terminar una partida (victoria o derrota) se guarda una ficha con semilla, nombre, sobrenombre, retrato, días, **fama**, **oro**, resultado y motivo, más la fecha (la pone el store; `core/` no usa fechas). **Se guardan todas** (ocupan muy poco). **Orden: por fama (de más a menos) y, a igual fama, por oro.**
- **Exportar/importar:** de momento **nada** (ni la partida, que permitiría hacer trampa, ni la crónica). **Apuntado para más adelante:** un botón para exportar la crónica como recuerdo.
- **"Meditar" del monasterio desaparece (decidido en el Sprint 5):** no se guarda la partida en los monasterios.

**Plan por pasos (propuesto por Claude; cada paso con su plan → visto bueno → cambios → `ng test`):**
1. ✅ **Formato de la partida guardada** (`core/guardado/`, TypeScript puro; hecho el 19-nov): `mundo.semilla` (lo rellena `crearPartida`); `guardarPartida(estado)` (estado → texto); `leerPartida(texto)` (texto → estado, comprobando que es una partida válida; si no, devuelve un motivo en vez de romper: `no_se_puede_leer`, `no_es_una_partida`, `version_futura`); adaptadores por versión (lista vacía, con un test que use uno de prueba 1 → 2); `dadosDePartida(estado)` = `new Dados(estado.mundo.estadoDados)`. Tests: ida y vuelta idéntica, los dados recuperados sacan lo mismo que habrían sacado sin cerrar, textos estropeados o incompletos, versión futura, semilla guardada.
2. ✅ **La crónica** (`core/guardado/cronica.ts`; hecho el 19-nov; empate en fama y oro: la más antigua arriba): `EntradaCronica`, crear la ficha a partir del estado terminado (con la fecha que le pasen), añadirla a la lista y ordenarla (fama, luego oro). Leer y guardar la lista con el mismo cuidado que la partida.
3. ✅ **El almacén** (hecho el 19-nov; botones síncronos): formato común (`leer`, `escribir`, `borrar`), una versión en memoria para los tests (en `core/`) y la de `localStorage` en `store/` (con `try/catch`: el navegador puede negarse) más `navigator.storage.persist()`.
4. ✅ **El store** (hecho el 19-nov; ver sección 0: `ejecutar` como puerta única, `abandonar`, semilla de 6 cifras y copias de seguridad) (`store/juego.store.ts`, el **primero del proyecto**; `store/` existe desde el paso 3, `ui/` todavía no): el estado en un signal, los `Dados` aparte (no son estado). Al arrancar, carga la partida si hay una; cada cambio se guarda solo; `nuevaPartida(nombre, retrato, semilla?)` (semilla al azar si no se da); al terminar la partida, ficha a la crónica y se borra la partida guardada. Tests del store con lo que permita Vitest/Angular.

### 3.8 Cambios respecto al juego de papel (decididos por el autor)
- **Eventos aleatorios:** no existen las tablas de terreno de coordenadas (2d6 columna/fila). Cada terreno tiene una **lista de eventos (unos 30-40) entre los que se elige uno al azar**, con **pesos** (por defecto, cada repetición del libro = +1; si el autor prefiere probabilidades iguales, peso 1). Igual para el evento nocturno.
- **Ids de eventos con nombre:** en digital los eventos se identifican por un id descriptivo (`taberna_clandestina`), no por el número del libro (`E081`). Los `E###` que aparecen en este documento son solo la **referencia al libro de papel**.
- **Combate naval:** duelo de cañones con abordaje (sección 3.13; pares/impares descartado). Más adelante, un minijuego de habilidad que solo dará un +1 a la tirada.
- **Sobrenombre:** se elige con **`1d11` (uniforme)**, no con 2d6, o a elección. Las características con `1d3` (equivale al 1d6 del papel).
- **Seguidores:** **sin inventario propio y sin necesidad de comer**. Su "ataque" es el daño que hacen al acertar. Descansar los cura.
- **Comida:** una sola reserva por turno para todo el grupo (ver 4.6).
- **Objetivo:** 10 de fama **y** haber visitado los 4 puertos principales de cada mapa (Tortuga, Port Royal, La Habana y Nassau, uno por esquina; ver sección 6).
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
| `accion` | las acciones (Sprint 6, `core/acciones/` y demás) | La acción del jugador y sus eventos | `comida` |
| `comida` | `comer(estado, eleccion, lugar, dados)` | Come o pasa hambre | `descanso` |
| `descanso` | `descansar(estado, eleccion, lugar, dados)` | Duerme; puede saltar un evento nocturno; **cierra el día** | `inicio` del día siguiente |

- **El lugar es un dato suelto** hasta que exista el mapa: `barco` (a bordo, en mar), `puerto`, `guarida` (guarida pirata neutral, desde el Sprint 6), `aldea`, `monasterio` o `intemperie` (playa, jungla, jungla profunda). Lo dice quien llama; después lo calculará el mapa.
- **Opciones para la interfaz:** `opcionesDeComida` y `opcionesDeDescanso` dicen qué se puede elegir, cuánto cuesta y si llega el oro. **Una opción que no se puede pagar sale igual, pero desactivada** (decisión del autor).

**Amanecer (`iniciarTurno`).** Recorre las condiciones que había al amanecer, **de la más antigua a la más nueva**. Cada una: (a) sus efectos fijos de `cadaTurno`, (b) su tirada diaria en su tabla y (c) si tiene turnos contados, uno menos (a 0 se quita; el último día todavía actúa). Devuelve un **parte** por condición (dados, texto de la fila, cambios reales).
- Una condición que otra se ha llevado esa mañana ya no hace nada. Las que aparecen durante la mañana empiezan a contar al día siguiente.
- Si la partida termina a mitad (vida o tripulación a 0), se para ahí.
- **Bonificador de la tirada diaria:** si la tabla tiene un id de tirada con su mismo nombre (`el_mal`), se suman los bonificadores del jugador; si no, se tira sin bonificador.
- Las condiciones actúan **antes** de mirar si hay acción: "las lluvias persisten" quita la acción de ese mismo día.

**Condiciones: cómo se quitan.** Por una fila de su tabla (`quitar_condicion`), por turnos, por categoría (monasterio, bruja, biblia: "una maldición") o **al llegar a un lugar** (`alLlegar`).
- **"Al llegar" es un patrón del juego:** al llegar a ese tipo de lugar, la condición se quita y, si la ficha lo dice, da unos efectos o lanza un evento. Hoy solo lo usa el escorbuto (se cura al tocar tierra). Servirá para: carta de la hija del gobernador (E035: puerto → audiencia con +1), mensaje del nativo (aldea → seguidor nativo), mensaje del náufrago (naufragio → seguidor), esclavos por vender (E008: puerto → +100 de oro), "el poder de la amistad" (E074: puerto → seguidor gratis). Cada una con su icono mientras se lleva. Quien avisa de la llegada es viajar (Sprint 9).
- **Los ajustes se calculan, no se guardan:** `famaObjetivoActual(jugador)` = la del personaje + lo que digan sus condiciones. `jugador.famaObjetivo` no cambia nunca; así no hay nada que deshacer al quitarse la condición. **La interfaz debe usar las funciones de `core/condiciones/consultas.ts`, no leer el campo directamente.**
- **Las prohibiciones solo se declaran:** cada acción las hace cumplir (nuevos seguidores y enterrar tesoro: Sprint 6, hecho; viajar: Sprint 9). Las de audiencias y ganar oro desaparecieron en el Sprint 6.

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

### 3.11 Decisiones del Sprint 6 (completado)

**Seguidores (catálogo, paso 1 hecho).** Fichas en `data/seguidores.json` (formato `core/catalogos/tipo-seguidor.ts`) y habilidades en `data/habilidades.json`. `crearSeguidor(idTipo, seguidoresActuales, dados, { inseparable? })` en `core/seguidores/` fabrica el seguidor (no lo mete en el grupo ni cobra).
- **El cocinero se sustituye por el pescador** (30 de oro): cada vez que consigues pescar algo, +1 reserva; si no pescas nada, no da nada. Se programa con la acción de pescar.
- **El carpintero se sustituye por el mono amaestrado** (40 de oro, resistencia 3, ataque 0 = no ataca): al buscar información en un puerto roba 1d6 de oro; con un 1 lo pillan y pagas 1d6 de multa. Se programa con la acción de buscar información.
- **La bruja vudú es evento Y seguidor:** el evento es la cabaña (E066); el seguidor `bruja_vudu` solo llega por eventos (ficha sin `precio`). `precio: 0` = gratis (pirata anciano); sin `precio` = no se contrata en puertos.
- **El cartógrafo no es un seguidor del catálogo:** el resultado de la tabla de contratar lleva a su evento, y allí quizá se contrata.
- **Tipo `nativo` confirmado** (nombre "Nativo kalinago"). Su habilidad da +1 en `audiencia_aldea`, `buscar_info_aldea` y `el_mal`; la bruja vudú, +1 en `el_mal`.
- **Nombres propios:** `data/nombres-seguidores.json` tiene tres listas del autor: `hombres` y `mujeres` (nombres de pirata, 60 + 60) y `nativos` (56, hombres y mujeres juntos). Un seguidor normal coge su nombre de `hombres` + `mujeres`, todo junto. La ficha de un tipo puede pedir otras listas con el campo `nombres`: **la bruja vudú, `["mujeres"]`** (siempre es mujer) y **el nativo, `["nativos"]`**. Al crearlo se elige uno al azar (gasta UN número del generador); si ya lo lleva alguien del grupo, se coge el siguiente de la lista. Cargador: `core/seguidores/nombres.ts` (`LISTAS_DE_NOMBRES`, `nombresDe`).
- **Id del seguidor en la partida:** tipo + número (`forzudo_1`, `forzudo_2`).
- **Efecto `ganar_seguidor` (paso 2 hecho):** `{ "tipo": "ganar_seguidor", "seguidor": "nativo", "inseparable"?: true }`. `aplicarEfectos` llama a `crearSeguidor` y lo mete en el grupo. No entra si una condición prohíbe `nuevos_seguidores` (se mira primero) o si el grupo está lleno (`AJUSTES.maximoSeguidores`, 2 desde el 20-nov; antes 3). Cambios nuevos: `seguidor_se_une`, `seguidor_no_se_une` (motivo `grupo_lleno` o `prohibido`) y `seguidor_despedido`.
- **Grupo lleno: despedir para hacer sitio.** El juego pregunta ANTES "¿despides a alguien para que entre el nuevo?"; si el jugador elige a uno, el efecto lleva `despedir: "<id del seguidor en la partida>"` (no se escribe nunca en el JSON: el revisor lo rechaza), ese se va y entra el nuevo. Si dice que no, el nuevo no entra. **A un inseparable no se le puede despedir** (el hermano no puede librarse así de perder). Consultas para la interfaz en `core/seguidores/consultas.ts`: `grupoLleno`, `seguidoresDespedibles`.
- **El hermano (paso 2b hecho):** al crear el personaje empieza con un seguidor de un tipo al azar entre **TODOS** los de `data/seguidores.json` (se contraten o no; misma probabilidad), gratis, **inseparable y vital**. Cuenta para el máximo de seguidores (2). Gasta dos números del generador (tipo y nombre), solo con ese sobrenombre.
- **`Seguidor.vital`:** si muere, el jugador pierde la partida (`finPartida.motivo: 'seguidor'`). Es distinto de `inseparable`. Lo comprueba `aplicarEfectos` al morir un seguidor; el combate (Sprint 7) debe respetarlo también.
- **`data/seguidores.json` es el catálogo de TODOS los seguidores**, vengan de contratar o de eventos. La tabla de contratar (2d6) será una tabla aparte que apunta a sus ids.
- **Bonificadores de seguidores:** `calcularModificador` suma las habilidades de los seguidores. **Todo suma, también lo repetido** (dos nativos = +2): el autor quiere que el juego tenga combinaciones locas.

**Condiciones vigentes (paso 3 hecho): apuntadas, partes y otorgadas.** `condicionesVigentes(jugador)` y `tieneCondicion(jugador, id)` en `core/condiciones/condiciones-vigentes.ts` devuelven TODAS las condiciones que afectan al jugador ahora, sin repetir. **Las reglas miran siempre esa lista** (consultas, `calcularModificador`, prohibiciones), no `jugador.condiciones`.
- **Apuntadas:** las de `jugador.condiciones` (tormenta, escorbuto, el amuleto maldito).
- **Otorgadas:** campo `otorga` (lista de ids de condición) en la ficha de un sobrenombre, un objeto o una habilidad. Se tienen mientras se tenga la fuente; **no se guardan, se calculan**. Si llega por varias fuentes, sale una vez. El revisor comprueba que existen.
- **Vínculo nativo = condición `vinculo_nativo`** (categoría `otra`), otorgada por "el nativo", el amuleto kalinago y la habilidad `guia_nativo` del seguidor nativo (ya no se mira el nombre del tipo). `tieneVinculoNativo` sigue existiendo. Los +1 de aldea se quedan en cada fuente y suman.
- **Partes:** `CondicionActiva.partes` = condiciones que una apuntada lleva DENTRO; funcionan mientras dure y se van con ella. Efecto: `{ "tipo": "poner_condicion", "condicion": "amuleto_maldito", "partes": [...] }`.
- **Amuleto maldito (decidido por el autor): es UNA condición "maldición-bendición"** (`amuleto_maldito`, categoría `maldicion`) con dos partes: la bendición y la maldición que tocaron en los dados. **Cuenta como maldición:** monasterio, bruja o cualquier "quitar una maldición" se la llevan ENTERA (se pierde también lo bueno; la única excepción es el deseo, que pasa una vez). **No es un objeto ni ocupa hueco del inventario.** Si ya tienes uno, el nuevo se ignora.
- **Maldiciones del amuleto en `data/condiciones.json`:** `hambre_insaciable` (+1 comida al día), `ambicion_desmedida` (+2 fama objetivo), `hedor_nauseabundo` (prohíbe nuevos seguidores), `manos_torpes` (−1 al pescar y al cazar; sustituye a rechazo a la autoridad, 18-nov), `avaricioso` (prohíbe enterrar tesoros) y `muy_mala_suerte` (ficha escrita; el −3 se activa cuando existan las tablas de objetos).
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
  - Vender cuenta como ganar oro: el contable gana su 1d6 en cada venta.
  - **Sin tirada de papel** ("hoy solo hay alguien que compra"): siempre se puede comprar y vender comida. **No hay tienda fija:** objetos solo en el rastrillo (o en eventos como el emporio de Bob). En las aldeas no hay mercado.
  - **Rastrillo:** `data/rastrillo.json` (`objetos: [{ objeto, peso, precio }]`, elegido con pesos). El revisor exige que cueste más que su `precioVenta`. Provisional: los 4 objetos sin el ídolo, a precio doble.
  - **Mejoras del barco (RECORDAR AL AUTOR EN EL SPRINT DEL COMBATE NAVAL):** se conseguirán en el rastrillo, en el emporio de Bob, en eventos y quizá en un **astillero pirata** de las guaridas; no ocupan inventario (como las bendiciones: probablemente condiciones de una categoría nueva `mejora`). Diseño del combate naval decidido el 19-nov (sección 3.13): serán bonificadores en `disparo_naval` y reglas propias (casco reforzado, velas nuevas); aún sin programar.
- **Acciones a medias: `mundo.accionEnCurso` (paso 7, 17-nov).** Las acciones de varios pasos (primero se tira o se entra, después el jugador decide) guardan lo que salió en un único campo (`AccionEnCurso` en `core/estado/mundo.ts`): `{ tipo: 'mercado', rastrillo }`, `{ tipo: 'marineros', disponibles }` o `{ tipo: 'seguidor', seguidor, precio }`. Así no se puede volver a tirar hasta que guste y un guardado a mitad lo conserva. Mientras hay una, `comprobarQueSePuedeActuar` y `usarObjeto` dan error ("hay una acción a medias").
- **Protección en `accionesDisponibles` (18-nov):** fuera de la fase de acción o con la partida terminada, todas salen desactivadas con `no_es_momento`; con una acción a medias, con `accion_a_medias`. La interfaz (y el store) solo deben ofrecer acciones cuando de verdad toca.
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
- **Buscar información (paso 10 hecho, 17-nov; `core/acciones/buscar-informacion.ts`).** Acción `buscar_informacion` en puertos y aldeas (motivo `solo_puerto_o_aldea` fuera), 3d6 en su tabla: puertos `data/tablas/buscar-informacion.json` (tirada `buscar_info_puerto`), aldeas `data/tablas/buscar-informacion-aldea.json` (tirada `buscar_info_aldea`; **escrita por el autor el 17-nov**).
  - **Sobornos, solo en puertos** (UI: al pulsar salen "Sobornar 10 / 20 / 30" o "Buscar sin sobornar"): `buscarInformacion(estado, sitio, sobornos, dados)`, cada uno `AJUSTES.precioSoborno` (10) y +1, hasta `maximoSobornos` (3). En aldeas no se soborna. `opcionesDeBuscarInformacion` da los botones y si hay amigos.
  - **Cada dos días, en todo el juego** (`AJUSTES.diasEntreBusquedas` 2; `mundo.ultimaBusquedaInformacion`): mientras, desactivada con `espera` y `faltanDias` ("falta 1 día").
  - **Reglas especiales de fila** (campo nuevo `especial` en las filas de tabla, `ESPECIALES_DE_TABLA` en `tabla.ts`; las aplica quien usa la tabla): `haces_amigos` (marca `amigos` en la casilla: +1 la próxima vez que busques información **o des un discurso** allí; se gasta al usarla), `cubil` (una vez por casilla: marca `cubil_saqueado`; la segunda vez "El cubil ya está vacío") y `fiesta` (ese día `mundo.comidaGratis`: en la fase de comida sale la elección nueva `invitado`, gratis; y `mundo.nochePagada`: esa noche en la aldea solo `techo_todos` gratis, sin eventos nocturnos y con posibilidad de dormir genial).
  - **El mono (manos largas), solo en puertos:** por cada mono, 1d6: con 2-6 trae ese oro; con un 1 lo pillan y pagas 1d6 de multa. El resultado devuelve `manosLargas` para enseñarlo.
  - **Tabla de aldeas:** 3-4 tabú sagrado (evento `tabu_sagrado`: pelea; si pierdes, te echan, la aldea queda bloqueada y apareces en un hexágono vecino al azar: combate Sprint 7, mapa Sprint 9) · 5-6 nadie entiende tu idioma · 7 niño curioso (amigos) · 8 historias junto al fuego (evento `historias_junto_al_fuego`: marca unas ruinas, Sprint 9) · 9 curandera (1d6 de vida a todos, una tirada) · 10-11 cacería (evento `caceria`: si aceptas, combate contra un jaguar; si ganas, +5 reservas) · 12-13 fiesta · 14 chamán (quita la maldición más antigua y da un ungüento) · 15 joven guerrero nativo (se une siempre si cabe) · 16-17 audiencia con el jefe (evento `audiencia_jefe_aldea`) · 18+ te confunden con su dios (+1 fama y audiencia).
  - **Objeto nuevo `unguento`:** activo, 1 uso, se usa en la fase de acción, cura 1d6, precio 10. Es el primer objeto con `alUsar`.
- **Eventos no programados (decidido por el autor):** mientras un evento no exista, la interfaz enseña un aviso con su nombre ("Evento: Taberna clandestina (pendiente)") y sigue. **Para la demo:** al viajar solo deben salir los eventos que ya estén programados (filtrar las listas de terreno), no todos con aviso. Apuntado para el motor de eventos (Sprint 10).
- **GUARIDA PIRATA (diseño decidido por el autor, 18-nov; se programa en el paso 11 lo que se pueda, el resto cuando toque).** Rasgo `guarida_pirata` del mapa (también puede aparecer por eventos).
  - **Primera visita = evento E038** (necesita chequeos, combate Sprint 7, mapa Sprint 9 y motor de eventos Sprint 10). Al llegar puedes **entrar o no** (entrar es opcional; el jugador no sabe si es hostil hasta que entra). Si entras, 1d6: **5-6 neutral** · **3-4 abandonada** · **1-2 hostil**. El resultado queda apuntado en la casilla (marca).
  - **Neutral = "puerto pirata":** todas las acciones de un puerto (mercado con rastrillo, contratar, taberna, posada, buscar información...) con estas diferencias: la audiencia es con el **capitán pirata** (+1 por cada 2 de fama, ya en `AJUSTES.bonificadorPorFama`); al buscar información **+1 por cada 2 de fama** y **sin sobornos** ("aquí lo que importa es la fama"); **no cuenta** como puerto principal para ganar. Más dos acciones exclusivas (abajo).
  - **Abandonada:** se tira en su tabla (1 E039 nido · 2 E082 · 3 E076 · 4 E049 · 5 E021 cofre · 6 E054) y la casilla **deja de ser guarida**: pasa a ser jungla normal.
  - **Hostil:** con **8+ de fama** te dejan entrar y te regalan un tesoro (E036) → neutral · con **6-7** te dejan entrar → neutral · con **4-5**, chequeo de Ingenio para convencerlos: si lo superas → neutral; si fallas, tabla · con **menos de 4**, tabla. **Tabla (1d6):** 1-3 te arrestan (E023) · 4 intentas huir: eliges Fuerza o Ingenio y haces el chequeo; si lo superas, como el 5; si no, como el 1-3 · 5 huyes, pero alguien se interpone (combate E003) · 6 te confunden con uno de los suyos y te dejan entrar → neutral. **Con 1-5, la casilla queda bloqueada para siempre.**
  - **Acciones exclusivas de la guarida neutral** (sacadas de la taberna clandestina, E081; servirán también para ese evento):
    - **Jugar a los dados:** apuestas el oro que quieras; un dado para ti y otro para tu rival. Si el tuyo es mayor, ganas lo apostado; si es menor, lo pierdes; si empatan, se vuelve a tirar. Puedes jugar tantas veces como quieras (como el mercado: acción a medias hasta que te levantas de la mesa).
    - **Echar un pulso:** apuestas el oro que quieras y 1d6 para ver quién se sienta: 1-2 un borracho (−1 al dado) · 3-4 un parroquiano (tirada normal) · 5-6 el campeón de pulsos (+1 al dado). Chequeo de Fuerza con ese modificador (en un chequeo, −1 al dado ayuda y +1 lo hace más difícil). Si lo superas, ganas lo apostado; si no, lo pierdes. Si ganas al campeón, además **+1 de fama**.
    - Decidido al programarlas (paso 11b): apuestas con botones 10, 25, 50, 100 o todo; el pulso, un intento por día; el campeón, una vez vencido, no vuelve a salir en esa guarida.
  - **Ideas apuntadas para más adelante:** el **perista** (vender objetos a ~1,5 veces su precio), **invitar a una ronda** (pagas y +1 de fama, una vez por guarida), **encargos del capitán** (condición con `alLlegar` a un puerto que da recompensa) y el **astillero pirata** (donde comprar las mejoras del barco: ver el recordatorio del combate naval).
- **Audiencias y guarida (paso 11a hecho, 18-nov).**
  - **Lugar nuevo `guarida`** (guarida pirata neutral) y `esPuerto(lugar)` en `core/turno/lugar.ts`: mercado, contratar, taberna, posada y "sin eventos nocturnos a la intemperie" valen en puertos y guaridas. Buscar información en la guarida: tabla de puertos, **sin sobornos**, tirada nueva `buscar_info_guarida` (+1 por cada 2 de fama en `AJUSTES.bonificadorPorFama`; el influyente también suma), y el mono roba.
  - **`solicitar_audiencia`** (`core/acciones/audiencia.ts`): puerto → gobernador (`audiencia-gobernador.json`: 1 guardia te reconoce, evento `guardia` y vetada · 2-3 hoy no · 4 te atiende su hija, evento `hija_del_gobernador`, **no cuenta como concedida** (confirmado por el autor: el objetivo es ver al gobernador) · 5-6 concedida, evento `audiencia_gobernador`); aldea → jefe (`audiencia-jefe-aldea.json`: 1 vetada · 2 no se permite · 3 hoy no · 4-6 concedida, evento `audiencia_jefe_aldea`); guarida → capitán (`audiencia-capitan.json`: 1-2 vetada · 3 no se permite · 4+ concedida, evento `audiencia_capitan_pirata`). Bonificadores por tirada (`audiencia_puerto/aldea/guarida`): influyente, nativo, barbero-cirujano (+1 en las tres) y fama en la guarida.
  - **Reglas especiales nuevas de fila:** `audiencia_concedida` (marca: una por sitio y partida → desactivada con `audiencia_ya_concedida`), `audiencia_vetada` (marca: nunca más aquí → `audiencia_vetada`; bloquear la aldea, con el mapa) y `audiencia_aplazada` (marca con `dia`: +1 si la pide aquí al día siguiente; no se acumula y caduca). Las marcas pueden llevar `dia`.
  - **Rechazo a la autoridad desaparece** (decidido por el autor: las audiencias son llamativas y limitadas y no deben prohibirse). La sustituye **manos torpes** (−1 al pescar y al cazar) en el 6 de las maldiciones del amuleto. La prohibición `solicitar_audiencia` ya no existe.
- **Dados y pulso en la guarida (paso 11b hecho, 18-nov; `core/guarida/`).** Dos acciones del día, solo en guaridas (motivo `solo_guarida`; `sin_oro` si no lleva nada):
  - **Apuestas** (`apuestas.ts`): botones `AJUSTES.apuestas` (10, 25, 50, 100) o "todo"; `opcionesDeApuesta` los da desactivados si no llega el oro.
  - **`jugar_a_los_dados`** (`dados.ts`): `sentarseALosDados` gasta el día (acción a medias `{ tipo: 'dados' }`), `apostarALosDados(apuesta)` tantas veces como quiera (un dado cada uno; mayor gana, menor pierde, empate se repite) y `levantarseDeLaMesa` (toca comer). Ganar cuenta para el contable.
  - **`echar_un_pulso`** (`pulso.ts`): un intento por día. 1d6 para el rival (1-2 borracho −1 · 3-4 parroquiano · 5-6 campeón +1) y chequeo de Fuerza. Ganar al campeón da +1 de fama y deja la marca `campeon_vencido`: allí ya no sale y el 3-4 pasa a ser 3-6.
  - **Chequeos** (`core/chequeos/chequeo.ts`, primera vez que existen): `chequeo(jugador, 'fuerza' | 'ingenio', modificador, dados)`: 1d6 + modificador ≤ característica ACTUAL (con el amuleto). Los usarán muchos eventos y dormir en la aldea.
- **Naufragio y ruinas (paso 12 hecho, 18-nov; `core/acciones/explorar.ts`).** Acciones `investigar_naufragio` y `registrar_ruinas`: solo en casillas con ese **rasgo** (`Sitio.rasgo`, nuevo; `RASGOS` en `lugar.ts`) y **una vez por casilla** (marcas `naufragio_investigado` / `ruinas_registradas`; después `ya_explorado`).
  - **"Tira en otra tabla"** (campo nuevo `tabla` en las filas; `resolverConSubtablas` sigue tirando sin bonificadores; un test comprueba que las tablas destino existen). Servirá para muchas tablas del libro (E014, E021...).
  - **Naufragio** (`naufragio.json`, 1d6): 1-2 evento `barco_maldito` · 3 `guarida_pirata` · 4-5 tabla `hogar_de_alguien` (1 fugitivo · 2 pescador · 3 muchacha_perdida · 4 piratas_perdidos · 5 contrabandista · 6 ermitano) · 6 `restos_antiguos` (esqueleto + cofre, un evento que encadena los dos).
  - **Barco maldito** (para el combate, Sprint 7): 1d6: 1-3 combate contra el **pirata maldito** (E078) · 4-6 piratas esqueleto (E085; confirmado por el autor). Al ganar, 1d6×10 de oro y un tesoro (E036). En digital son combates con su enemigo del bestiario, no eventos.
  - **Ruinas** (`ruinas.json`, 2d6): 2 `maldicion` · 3 el ídolo dorado (`ganar_objeto`) + `maldicion` · 4 `esqueletos` (E053 dos veces) · 5 `ruinas_pirata_maldito` (combate y, si ganas, cofre) · 6-7 `ciudad_pirata` (la casilla pasa a ser guarida neutral, con el mapa) · 8-9 `ruinas` (E040) · 10 `cueva` (E088) · 11 tabla `lampara_magica` (1-2 te quedas la **lámpara agotada**, objeto nuevo que se vende por 25 · 3-6 `deseo`; el "E045" del libro era una errata) · 12 especial `idolo_antediluviano` (objeto nuevo: pasivo, mágico, precio 200; si ya lo tienes, evento `tesoro_magico`).
  - **Objeto nuevo, campo `banderaAlVender`:** al venderlo se apunta una bandera. El ídolo antediluviano apunta `idolo_antediluviano_vendido`: **en la ciudad perdida (E050), el juego debe dejar claro que lo necesitabas y que lo vendiste** (decidido por el autor: que el jugador lo aprenda para la siguiente partida).
  - **Límite conocido:** cuando una tabla da un objeto que no cabe, hoy se pierde (`objeto_no_cabe`): el "pregunta antes qué tiras" solo existe cuando se sabe antes (mercado, contratar). Para las tablas y los eventos, llegará con el motor de eventos (Sprint 10).
- **Dormir en la aldea y mendigar (paso 13 hecho, 18-nov).**
  - **Con vínculo nativo (decidido por el autor, 18-nov):** en la aldea se ofrece **dormir en la aldea** (`techo_todos`, gratis, sin chequeo, sin eventos, con posibilidad de dormir genial) junto a la intemperie, en lugar de convencer a los nativos.
  - **Dormir en la aldea sin vínculo:** elección nueva `convencer_nativos` en la fase de descanso en una aldea (`descansar(..., hex?)`): chequeo de Ingenio; si lo supera, todo el grupo duerme allí esa noche (gratis, sin eventos, con posibilidad de dormir genial); si falla, le echan (marca `echado_de_la_aldea`: en esa aldea ya solo intemperie) y duerme a la intemperie con su posible evento nocturno. `descansar` devuelve `chequeo` y `echado`.
  - **Mendigar** (`core/acciones/mendigar.ts`): la da el artista (con varios, la misma acción, una vez al día); en puertos y guaridas (motivos `sin_artista`, `solo_puerto`). 2d6 en `data/tablas/mendigar.json` (tirada `mendigar`): 2 guardia (evento) · 3 matones (−1d6) · 4-5 nada · 6-8 +1d6 · 9-10 +2d6 · 11 +3d6 · 12 +3d6 y hoy coméis gratis (especial nuevo `comida_gratis`).
  - **El contable pasa a +1d6** (decidido por el autor: 2d6 era demasiado).
- **Sprint 6 cerrado.** Lo que queda para otros sprints está repartido en esta sección y en la 9.
- **Cómo comprueba Claude los tests sin `ng test`:** compila `src/app/core` con `tsc` a una carpeta temporal fuera del repo (commonjs) y carga los `.spec.js` con un corredor mínimo que usa el `expect` de `vitest/dist/index.js`. No incluye `app.spec.ts` (por eso le salen 2 tests menos que al autor). La comprobación oficial sigue siendo el `ng test --watch=false` del autor.
- **Límite conocido:** al amanecer (`iniciarTurno`) solo actúan las condiciones apuntadas; las partes y las otorgadas no ejecutan `cadaTurno` (hoy ninguna lo tiene).

**Fase de acción (paso 4 hecho): `core/acciones/`.** Molde común en `accion.ts`: `comprobarQueSePuedeActuar` → lo suyo + `aplicarEfectos` → `cerrarFaseDeAccion` (fase `comida`). Todas devuelven `ResultadoAccion { estado, cambios, tirada?, eventos }`. El sitio es un dato suelto hasta el mapa: `Sitio { lugar, juntoAlAgua?, hex?, rasgo? }` (`hex` y `rasgo` desde los pasos 9 y 12). `accionesDisponibles(estado, sitio)` da todas las acciones; las que no se pueden, desactivadas con motivo.
- **Pescar** (`pescar.ts`): a bordo o en tierra junto al agua. Tabla nueva (decidida por el autor): 1 nada · 2-3 → 3 · 4-5 → 5 · 6 → 7 reservas (viviendo solo de pescar, 1 día de cada 4; simulado en 60 días de mar. Con 2/4/6 era 1 de cada 3 y al autor le pareció pesado). Cada seguidor pescador da +1 **solo si se pesca algo**.
- **Cazar** (`cazar.ts`): solo en tierra salvaje (`intemperie`). 1 nada · 2-3 → 4 y −1 PV · 4-5 → 5 · 6 → 8 (algo más que pescar, pero con riesgo).
- **Acción "Reposar" (decidida por el autor; se llama así, en el juego y en el código, para no confundirla con la FASE de descanso, que es dormir):** acción independiente (en papel era "descansar" e iba unida a cazar/pescar). Pasas el día recuperándote: **+2 PV** (`AJUSTES.curaAlReposar`) al jugador y a cada seguidor, **+1 por cada barbero-cirujano** (su punto extra es SOLO con esta acción, no durmiendo). **Riesgo** (`AJUSTES.probabilidadEventoAlReposar`, 20 %): a bordo, lista nueva `descuido_a_bordo` (`data/eventos-terreno/descuido-a-bordo.json`: perdidos, rocas, vientos fuertes, polizón, imprevisto, traición y, con poco peso, motín, sirenas, monstruo y tormenta; puede salir algo bueno); a la intemperie, la lista de nocturnos; **en puerto, guarida, aldea y monasterio no hay riesgo**.
- **Dormir genial (decidido por el autor):** en la fase de descanso ya no se cura siempre. A bordo o bajo techo hay un `AJUSTES.probabilidadDormirGenial` (50 %) de "Has dormido genial (+1 PV)"; **una tirada para todo el grupo**. `descansar` devuelve `haDormidoGenial`. A la intemperie no se tira. Así la acción Reposar tiene más sentido.
- **Ajustes de habilidad:** `Habilidad.ajustes` (`curaAlReposar`, `reservasAlPescar`), sumados con `ajusteDeSeguidores(jugador, regla)` (`core/seguidores/consultas.ts`). Reglas de seguidor en datos, sin `if`s.
- **Economía de la comida (decidido por el autor):** `comidaMaxima` 12; `precioTaberna` 4; **comprar una reserva costará al menos 5 de oro** (paso de comprar y vender comida). Objetivo de diseño: que de vez en cuando haga falta pescar o cazar, salvo golpe de suerte.

**Límites contra el abuso de acciones (decidido por el autor; se guardan por sitio, así que la memoria por hexágono llega con el mapa, Sprint 9).**
- **Audiencias: una concedida por sitio y por partida.** En cuanto te conceden la audiencia en un puerto, aldea o guarida, acabe como acabe, la acción "solicitar audiencia" queda **bloqueada** en ese sitio para el resto de la partida (sale desactivada). Si te la deniegan ("hoy no, mañana +1") puedes volver a intentarlo. Ofender sigue como estaba (no puedes volver; en la aldea, además, se bloquea el hexágono).
- **Buscar información: cada dos turnos.** Tras buscar, al día siguiente no se puede (para no llamar la atención); al otro, sí. La acción sale desactivada con el aviso "Buscar información (falta 1 día para poder usarla)". El número va en `data/ajustes.json` para equilibrarlo jugando. Los resultados de una sola vez por sitio (el cubil de contrabandistas) siguen siéndolo.

### 3.12 Decisiones del Sprint 7 (combate normal, completado)

- **Reglas de tirada: las del papel (sección 4.8), sin cambios.** Jugador: 1 falla, 2-5 hace ese daño, 6 hace 6 y vuelve a tirar sumando (un 1 en cualquier momento anula todo el ataque). Enemigos y seguidores: 1-2 fallan, 3-5 hacen su `ataque`, 6 su `ataque` +1. El `ataque` de los seguidores se mantiene.
- **Siempre hay al menos un enemigo que va a por el jugador** (decidido por el autor, 19-nov): si los enemigos son menos que vuestro bando, uno de ellos (al azar) es el rival del jugador; si tras una ronda nadie le ataca, uno de los enemigos vivos (al azar) pasa a atacarle. En `emparejar`/`reemparejar`, el jugador es siempre el PRIMERO de la lista de aliados. Así un seguidor ayuda a matar, pero no le quita al jugador todos los golpes: contra un jaguar, con un seguidor, se pierden ≈ 5 PV (solo, 7; antes de esta regla, 2,4).
- **Emparejamiento al azar y fijo:** se sortea al empezar; si un bando tiene más luchadores, los que sobran se reparten al azar entre los del bando pequeño. Cada uno ataca SOLO a su rival emparejado; el que tiene varios encima recibe todos sus ataques. Una pareja dura hasta que uno de los dos cae; entonces, quien se queda sin rival recibe otro al azar entre los vivos (en los dos bandos).
- **Hambre en combate:** −1 al daño por cada día sin comer (`diasSinComer`), tope −3, **para el jugador y para los seguidores** (la ración es de todos). El dado decide si acierta; el castigo se resta al daño y puede dejarlo en 0. **La interfaz debe enseñarlo** ("−1 por hambre", "−3 por hambre").
- **Piel de piedra:** −1 al daño cada vez que te aciertan, **mínimo 1**. Vale igual para el gólem (E056).
- **El mono (ataque 0) no entra en combate:** ni ataca ni le atacan.
- **Golpe de gracia:** si en la misma ronda el jugador mata a su rival y cae a 0 (le mate quien le mate), se queda con 1 PV; si quedan enemigos, el combate sigue. **El afortunado** solo se gasta si el golpe de gracia no le salva (una vez por partida, se queda con 1 PV).
- **Huir:** se puede intentar después de cada ronda (no antes de la primera); con 4+ huye todo el grupo; si falla, en la ronda siguiente los enemigos aciertan siempre (un 1-2 cuenta como golpe normal). **Hay combates de los que no se puede huir** (opción de cada combate).
- **Final:** se gana al caer todos los enemigos. El jugador a 0 pierde la partida (los combates "no mortales", en el paso 6). Un seguidor muerto sale del grupo; si era el vital, se pierde la partida.
- **Pasos:** 1 bestiario ✅ · 2 tiradas de ataque ✅ · 3 emparejamiento ✅ · 4 ronda completa y combate en curso en el estado ✅ · 5 huida ✅ · 6 habilidades de enemigos y opciones del combate ✅. Después, simulaciones para proponer categorías de enemigos (fácil, medio, difícil, arriesgado).
- **Decisiones del paso 4:** golpe de gracia si tu ataque acierta y tu rival cae esa ronda (aunque lo rematara un seguidor); va antes que el afortunado (si te salva, el afortunado no se gasta). **El daño que sobra se pierde.** **Bonificadores de combate (estoque, ron, lanza, maleficio...): se suman al daño si aciertas**; el dado natural sigue decidiendo el fallo (1) y el 6 que repite. Los enemigos son una copia del bestiario dentro del combate (un evento puede cambiar sus números al empezar); la vida del jugador y la resistencia de los seguidores son las de verdad y pasan por `aplicarEfectos`. El resultado se queda en `mundo.combate.resultado` hasta `cerrarCombate` (lo recogerá el motor de eventos). Una derrota por el seguidor vital cuenta aunque caigan los enemigos esa ronda.
- **Interfaz del combate (decidido por el autor; se hace con la interfaz):** notificaciones de combate **de una en una, en orden** (más adelante con animaciones): "−1 piel de piedra", "pierdes 3 PV", "haces 4 de daño", "Pirata 3 muere"... Para eso `atacar` devuelve `sucesos` en orden (`ataque` con dados, bonificador, hambre, piel de piedra y daño final; `golpe_de_gracia`, `afortunado`, `herido`, `muerte`, `nuevo_objetivo`, `fin`). La pantalla debe enseñar toda la información: vida, seguidores en combate, enemigos con su resistencia, quién ataca a quién y las habilidades u objetos que se pueden usar en combate.
- **Gráficos del combate (decidido por el autor, paso 6):** jugador, seguidores y enemigos tienen dibujo: el enemigo en combate y el seguidor guardan su `tipo` y la interfaz saca la `imagen` de su ficha (bestiario, `data/seguidores.json`); el jugador elige retrato **hombre o mujer** al crear el personaje (`jugador.retrato`). Sin dibujo, silueta de reserva por categoría. **Animaciones toscas por código con un solo dibujo** (avanza al atacar, se sacude y parpadea en rojo al recibir, se desvanece al morir); las poses quedan para más adelante.
- **Habilidades de enemigos (paso 6, en datos: `habilidades` en el bestiario):** `curarse` (al final de las rondas 2, 4, 6... +1d6 sin pasar del máximo; guardián de la isla), `revivir_debilitado` (vuelve en el acto con −1 ataque, mínimo 1, y −1 resistencia máxima, **como mucho 3 veces** (`MAXIMO_REVIVIR_DEBILITADO`; decidido por el autor el 19-nov, antes eran 5): el pirata maldito 3/5 → 2/4 → 1/3 → 1/2 y la cuarta vez muere; el enemigo en combate lleva `vecesRevivido`), `revivir_una_vez` (al caer la primera vez, 1d6: con un 1 vuelve entero; **solo una vez**, decidido por el autor; piratas esqueleto), `ataca_dos_veces` (si el primero es un 1, no hay segundo; velociraptor), `piel_de_piedra` (−1 a cada golpe recibido, mínimo 1; gólem), `acierta_con_5` (cangrejo; tras huida fallida acierta siempre) y `maldice_con_6` (chamán: si saca un 6, al terminar el combate, como termine, salta el evento `maldicion`; **la interfaz debe decir "¡MALDITO!"**).
- **Opciones de cada combate (paso 6):** `cantidad` con dados (`"1d6"`), `recompensa` por cada enemigo derrotado (se cobra en `cerrarCombate`, también si huyes; lo que el libro da "si los vences" lo pone el evento tras la victoria), `noMortal` (caes a 1 PV y pierdes el combate, no la partida; antes va el golpe de gracia y el afortunado no se gasta; los seguidores sí pueden morir) y `sorpresa`: `nuestra` (primera ronda solo atacáis vosotros) o `suya` (**¡emboscada!**: primera ronda solo atacan ellos; **tenerla en cuenta al escribir los eventos uno a uno**, sobre todo los nocturnos). Si pierdes la partida, ni recompensas ni eventos.
- **Objetos de combate (paso 6):** botón junto a "Atacar"; **usar un objeto no gasta tu ataque** y se puede antes de la primera ronda. Campo `enCombate` en la ficha: `bonificador` (ron: +2 el resto del combate), `dado_extra` (pistola: tu próximo ataque suma 1d6 si aciertas; la de gran calidad, 2d6), `huida` (bomba de humo: huida automática, **solo en combates de los que se puede huir**) y `derrota_a_todos` (poción mágica: no reviven). Un activo **sin usos es permanente** (los de combate, una vez por combate). Pasivos: estoque (`ataque` +1) y lanza kalinago (id de tirada nuevo `ataque_no_humano` +2, contra enemigos que no son `humano`). Precios provisionales.
- **Simulaciones hechas (18-nov):** informe en el proyecto de Claude, `claude/equilibrio-combate.md` (no va a GitHub): categorías fácil / medio / difícil / jefe / arriesgado, regla de los grupos ("suma de ataques ≥ 4 = peligro de muerte jugando solo"), frecuencia de combates por lista (nocturnos 81 %: ≈ 27 % de combate por noche al raso) y % de muerte según la vida inicial. **Decidido:** vida 18 y evento nocturno 25 % (jungla, playa) / 35 % (jungla profunda), más la tienda de campaña (ver sección 0).
- **Combate naval:** diseñado el 19-nov; ver la sección 3.13.
- **Cómo comprueba Claude los tests (actualizado):** vitest no arranca en el Linux de Claude (las piezas nativas instaladas son las de Windows), así que compila `src/app/core` con `tsc` a una carpeta temporal fuera del repo y usa un corredor mínimo con el `expect` de vitest (desde el Sprint 8 también compila `store/` y le da al corredor el `localStorage` de jsdom; para el store, inicia el `TestBed` de Angular con `@angular/compiler`). **Desde la pantalla de pruebas:** compila con `ngc` (AOT, que además revisa las plantillas) a commonjs, usa unas `node_modules` instaladas con `npm ci` dentro de su máquina (leer las del PC a través de la carpeta compartida es muy lento) y reinicia el `TestBed` antes de cada test, como hace `ng test`. Ya incluye `app.spec.ts`, así que sus números deberían coincidir con los del autor.

### 3.13 Combate naval (Sprint 7, completado; diseño decidido por el autor el 19-nov)

**Contrato (sección 8, sin cambios):** el combate naval recibe el barco enemigo y devuelve `victoria`, `huida` o `derrota` más la tripulación perdida; huir enlaza con E006 (daño en la bodega); al ganar se puede organizar una fiesta (E007). Cómo se juegue por dentro da igual al resto del juego.

**Reglas decididas (19-nov):**
- **Duelo de cañones** (sustituye a pares/impares): cada ronda tiras **1d6 + tus bonificadores** (id de tirada `disparo_naval`) y el barco tira **1d6, sin bonificador**. Si sacas más, le quitas 1 de resistencia; si sacas menos, pierdes tanta tripulación como su **daño**; si empatáis, se repite. Lo que hace distinto a cada barco es su daño y su resistencia (sin abordar, de media pierdes daño × resistencia). El autor lo ve con bastante azar, pero lo acepta: lo controlan el daño y la resistencia, y más adelante las mejoras y el minijuego.
- **Sin tipos de disparo** (prudente / andanada) y **sin castigo por poca tripulación** (descartados por el autor: innecesarios o liosos). La tripulación a 0 sigue siendo derrota.
- **Los bonificadores son solo tuyos:** mejoras del barco y, más adelante, el +1 del minijuego de habilidad (el minijuego no sustituye a los dados). Si algún barco especial tuviera que ser más duro, se le daría algo en su ficha.
- **Abordar:** solo cuando la resistencia del barco ha bajado a la **mitad, redondeando hacia arriba** (con 5, al llegar a 3; con 1, desde el principio). Lanza un **combate normal** contra la tripulación de ese barco (campo `abordaje` de su ficha), **sin poder huir**. Cada barco tiene su propio abordaje.
- **Huir (decidido por el autor, 19-nov):** a partir de la segunda ronda, **1d6: con 3-6 huyes** y salta E006 (siempre; las velas nuevas dan +1 a la huida); **con 1-2 no pasa nada más**: el combate sigue y hay que disparar al menos otra ronda antes de volver a intentarlo. Id de tirada `huida_naval` (las velas nuevas dan +1).
- **Daño con dados** (barco pirata, `"1d6"`): se tira **una vez al empezar** el combate.
- **Recompensas:** cada barco da la suya del libro (`recompensa` y `eventosAlGanar`), ganes como ganes. **Abordando**, además, su `botinAbordaje` (decidido por el autor): +1d6×10 de oro en todos, salvo la chalupa (+1d6 reservas de comida, su pesca del día) y el fantasma (50 % de tesoro, sin oro); 25 % de tesoro en la fragata, los barcos piratas y el galeón. El tesoro es el evento `tesoro` (E036), pendiente hasta que exista su tabla.
- **El emporio de Bob y el barco-taberna de Pit no se pueden atacar** (decidido por el autor: ningún pirata lo haría). En E008, Bob pasa a ser como Pit: solo se comercia. No están en el catálogo de barcos.

**Pasos:** 1 catálogo de barcos ✅ · 2 duelo de cañones y combate naval en el estado (`mundo.combateNaval`) ✅ · 3 huir, abordar y resumen final ✅ · 4 mejoras del barco ✅ · 5 simulación de equilibrio ✅.

- ✅ **Paso 1: catálogo de barcos (19-nov).** Ficha `core/catalogos/barco.ts` (`id`, `nombre`, `descripcion?`, `imagen?`, `dano` (número o dados), `resistencia`, `abordaje` (lista de `EnemigoPedido`, el mismo formato de `iniciarCombate`), `recompensa?`, `eventosAlGanar?` (pueden repetirse: dos cofres), `botinAbordaje?` (`efectos?`, `probabilidadTesoro?` 1-100), `libro?`), `data/barcos.json`, cargador `cargar-barcos.ts` (`BARCOS`, `obtenerBarco`) y revisor `validar-barco.ts` (`validarBarcos`: ids, daño ≥ 0 o dados, resistencia ≥ 1, enemigos del abordaje en el bestiario, cantidades, efectos con `validarEfecto`, ids de evento, probabilidad, campos que sobran). Enemigos nuevos provisionales en el bestiario: `pescador` 1/5, `capitan_del_galeon` 3/10 (antes 3/12) y `soldado_del_galeon` 2/6.

| Barco (id) | Daño/Res. | Abordaje | Recompensa (libro) | Botín de abordaje |
|---|---|---|---|---|
| `chalupa_de_pescadores` | 0/1 | 2 pescadores | nada | +1d6 comida |
| `barco_negrero` | 2/4 | 2 esclavistas | evento `esclavos_del_negrero` (liberar +3d6 tripulación o vender: 100 de oro al llegar a puerto) | +1d6×10 oro |
| `barco_fantasma` | 3/4 | 3 piratas esqueleto | +1 fama, evento `amuleto_fantasmal` (E027 si lo coges) | 50 % tesoro |
| `mercante_protegido` | 2/6 | 2 guardias | +1 fama, 2d6×10 oro | +1d6×10 oro |
| `fragata_de_la_marina` | 4/4 | agente (res. 8) + 2 guardias de la marina | +1 fama, 2d6×10 oro, `cofre` | +1d6×10 oro, 25 % tesoro |
| `barco_pirata_neutral` | 1d6/5 | 1d3+1 piratas | 1d6×10 oro, `cofre` | +1d6×10 oro, 25 % tesoro |
| `barco_pirata_hostil` | 1d6/5 | 1d3+1 piratas | 1d6×10 oro, `cofre`, +1 fama | +1d6×10 oro, 25 % tesoro |
| `galeon_del_tesoro` | 5/5 | capitán (3/10) + 1 soldado | +1 fama, 3d6×10 oro, dos `cofre` | +1d6×10 oro, 25 % tesoro |

- ✅ **Paso 2: duelo de cañones (19-nov).** Estado: `mundo.combateNaval: CombateNavalEnCurso | null` (`core/estado/combate-naval.ts`: `barco`, `nombre`, `dano` ya tirado, `resistencia`, `resistenciaMaxima`, `ronda`, `tripulacionPerdida`, `resultado`), aparte de `mundo.combate` (durante el abordaje existirán los dos). Código en `core/combate-naval/combate-naval.ts`: `iniciarCombateNaval(estado, idBarco, dados)` (no mira la fase; el daño con dados se tira al empezar), `disparar(estado, dados, catalogos?)` (una ronda; los empates se repiten dentro y se devuelven todas las tiradas en `duelo.tiradas`; la tripulación pasa por `aplicarEfectos`; a 0, `derrota` y fin de partida) y `cerrarCombateNaval(estado, dados)` (en victoria cobra `recompensa` y devuelve `eventosAlGanar`; devuelve `resultado` y `tripulacionPerdida`, el contrato de la sección 8). Id de tirada nuevo `disparo_naval`. **`hayCombate(estado)`** (`core/combate/hay-combate.ts`) mira los dos combates y es lo que usan ahora todos los bloqueos (acciones con `combate_en_curso`, objetos, comer, descansar, amanecer). `iniciarCombate` solo mira `mundo.combate` (para poder lanzar el abordaje).
- ✅ **Paso 3: huir, abordar y resumen (19-nov).** En `combate-naval.ts`: `huirDelCombateNaval(estado, dados, catalogos?)` (1d6 + id de tirada nuevo `huida_naval`, `DADO_PARA_HUIR` = 3; si falla, `combateNaval.acabasDeFallarLaHuida` hasta disparar otra ronda), `abordar(estado, dados)` (solo con `resistencia ≤ resistenciaParaAbordar(max)` = mitad redondeando hacia arriba; lanza `iniciarCombate` con el `abordaje` de la ficha y `puedeHuir: false`; apunta en `combateNaval.abordaje` la vida y los seguidores de ese momento; mientras dura, ni disparar ni huir) y `opcionesDeCombateNaval(estado)` (botones Disparar, Huir con `primera_ronda` / `acabas_de_fallar` / `abordaje_en_curso`, Abordar con `resistencia_alta` / `abordaje_en_curso` y `resistenciaParaAbordar` para el texto "podrás abordar cuando le quede X"). El abordaje se pelea con el `atacar` normal; **`cerrarCombateNaval` cierra los dos combates** (ganar el abordaje = victoria `abordado`; caer = derrota). Al cerrar: victoria → recompensa + `eventosAlGanar` y, si fue abordando, `botinAbordaje` y la tirada de tesoro (`dados.entero(1, 100) ≤ probabilidad` → evento `tesoro`); huida → evento `dano_en_la_bodega` (E006). **Pantalla de resultados (decidido por el autor):** se gana hundiendo el barco o ganando el abordaje, y al terminar sale una pantalla con lo que pasó; `cerrarCombateNaval` devuelve `resumen` (`ResumenCombateNaval`: barco, nombre, resultado, `forma` `hundido` | `abordado`, tripulación perdida, `vidaPerdida` y `seguidoresCaidos` del abordaje, `oroGanado`, `famaGanada`, `comidaGanada` con su signo, y `eventos`). Hoy ningún barco atacable quita fama.
- ✅ **Paso 4: mejoras del barco (19-nov, decididas por el autor).** Son condiciones de la categoría nueva **`mejora`** (no ocupan inventario, duran para siempre y rezar no se las lleva), en `data/condiciones.json`: **`canones_buenos`** (+1 en `disparo_naval`), **`casco_reforzado`** (ajuste nuevo de condición `reduccionDanoNaval` 1: cada duelo perdido cuesta 1 marinero menos, mínimo 1 si el barco hace daño; consulta `reduccionDanoNavalActual`; `duelo.reduccionCasco` para enseñarlo) y **`velas_nuevas`** (+1 en `huida_naval`; ya no quita E006). Se dan con `poner_condicion`. **Dónde se consiguen, por decidir** ("ya veremos": rastrillo, emporio de Bob, eventos, astillero pirata...). El autor pensará más mejoras.
- ✅ **Paso 5: simulación (19-nov)**, 4.000 combates por caso con las funciones reales, jugador con 18 PV y 40 de tripulación. Resultados en el informe del proyecto de Claude `claude/equilibrio-combate-naval.md` (no va a GitHub). Resumen: a cañonazos sin mejoras se pierde de media ≈ daño × resistencia (negrero 8, fantasma y mercante 12, fragata 16, piratas 16, galeón 23); luchando hasta el final, el galeón hace perder la partida un 19 % de las veces y los piratas un 10 %, pero huyendo al quedar 15 marineros baja a menos del 1 %. **Cañones buenos reduce las pérdidas a la mitad** (es la mejora más fuerte). **Abordando solo**, muerte: mercante 12 %, piratas 13 %, fragata 20 %, **galeón 86 %** (demasiado: capitán 3/12 + 2 soldados 2/6 suman 7 de ataque); con un seguidor casi todo es seguro salvo el galeón (28 %). **Decidido por el autor (19-nov): abordaje del galeón = capitán 3/10 + 1 soldado 2/6** (28 % de muerte yendo solo, 2,5 % con un seguidor: un jefe que da miedo); el resto de abordajes, como estaban.

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
| El contable | Cada vez que gana oro, gana **1d6** más (no es un modificador de tirada: se aplica en `aplicarEfectos`) |
| El hermano | Empieza con un seguidor aleatorio gratuito. Si el seguidor muere, se pierde la partida |
| El heredero | Empieza con un objeto mágico de la lista del evento E037 (no puede salir el ídolo, el 12) |

Implementados (Sprint 6): los `ajustes` numéricos (fuerte, conformista), los `modificadores` (influyente, nativo), el vínculo nativo (el nativo), el contable, el hermano (seguidor inseparable y vital) y el maldito (amuleto al empezar). Pendientes: el afortunado (combate), el navegante y el superviviente (mapa) y el heredero (necesita la tabla de objetos mágicos, E037).

**Características** (digital `1d3`): 1 *Fuerte* (Ingenio 2, Fuerza 4); 2 *Equilibrado* (3/3); 3 *Inteligente* (Ingenio 4, Fuerza 2).
**Chequeo de Fuerza o Ingenio:** tirar 1d6 y sacar el valor de la característica **o menos**. Los piden algunos eventos.
**Valores iniciales:** Vida 18 (era 15; cambiado en el Sprint 7) · Oro 50 · Tripulación 40 (también el máximo) · Comida 5 reservas · Fama 0 · famaObjetivo 10 · capacidad de inventario 5.

### 4.3 Inventario y seguidores
- **Inventario del jugador: 5 huecos** (tesoros y objetos especiales; un objeto puede ocupar varios). [Digital] **Sin bodega**: no hay almacén aparte en el barco. **Comida y oro tienen su propio contador** (la comida con máximo).
- **Seguidores [digital]:** máximo 2 (3 con carisma; decidido por el autor el 20-nov, antes 3). Datos: tipo, nombre, **ataque** (daño al acertar), **resistencia** (vida) y habilidades. Lo normal es resistencia 10 y ataque 2, y cada ficha lo escribe siempre (obligatorio desde el Sprint 7). Todos combaten salvo los de ataque 0 (el mono). **Sin inventario y sin necesidad de comer.** Atacan en combate. Al descansar se curan igual que el jugador.

### 4.4 Tipos de hexágono
Playa, jungla, jungla profunda, costa, alta mar, puerto, aldea, monasterio, naufragio, ruinas, barco, abundancia (+ guarida pirata). Modelo de datos en la sección 6.

### 4.5 Acciones (solo una por turno; según hexágono)
**[Digital, Sprint 6]** Viajar (Sprint 9) · Pescar · Cazar · Reposar · Ir al mercado (puertos y guaridas) · Dar un discurso, contratar marineros y buscar seguidor (puertos y guaridas) · Buscar información (puertos, guaridas y aldeas) · Solicitar audiencia (puertos, aldeas y guaridas) · Rezar y descansar en el monasterio · Enterrar tesoro (playa, jungla, jungla profunda) · Investigar naufragio · Registrar ruinas · Jugar a los dados y echar un pulso (guaridas) · Mendigar (con un artista). La lista completa con sus motivos de desactivación está en `accionesDisponibles` (sección 3.11).

**Viajar (cualquier hex):**
- Mueve **1 hexágono en cualquier dirección** (el navegante y el superviviente permiten más).
- Tras moverse, **1d6: par → evento; impar → nada**.
- Si hay evento: **en digital**, se elige un evento de la **lista ponderada del terreno** (color) del hexágono de destino.
- **Hex de barco:** la primera vez que se entra **no se tira**; se agota (pasa a alta mar normal) y se lee **E008**.
- **Hex de abundancia:** pescar es más eficaz (E005).
- **Adentrarse en tierra:** se puede desembarcar en jungla, playa o puerto; **no se puede atracar en jungla profunda**. Al llegar a tierra desde el barco viajando, **no se tira evento**. Se anota dónde queda el barco; los seguidores acompañan siempre. **Volver al barco** automáticamente si se tienen tantas reservas de comida como hexágonos hay hasta el barco (se descartan), o turno a turno viajando.

**Buscar información (3d6) [digital, Sprint 6: ver 3.11].** En puerto se puede sobornar: 10, 20 o 30 de oro para +1, +2 o +3. En aldea, +1 con seguidor nativo, sobrenombre "el nativo" o amuleto kalinago (se suman). Una búsqueda cada dos días.
- **[Digital, decidido por el autor] En las aldeas nativas, buscar información usa su PROPIA tabla** (`buscar_informacion_aldea`, 3d6, mismos rangos), con resultados con ambiente de aldea. La tabla de abajo queda para puertos (y guaridas). La de aldeas la escribió el autor el 17-nov (`data/tablas/buscar-informacion-aldea.json`; resumen en la sección 3.11). Los ids de tirada `buscar_info_puerto` y `buscar_info_aldea` ya separan los bonificadores.

| 3d6 | Resultado |
|---|---|
| 3 | Te roban: pierdes la mitad del oro que llevas |
| 4 | No pasa nada |
| 5 | Haces amigos: la próxima vez que busques información o des un discurso en este hex, +1 |
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

**Contratar [digital, Sprint 6: ver 3.11].** En puertos y guaridas; tres acciones distintas (cada día, solo una).
- *Dar un discurso (1d6):* 1 multa de 1d6 de oro (sin oro suficiente: pierdes todo y te arrestan, E023) · 2-3 nadie te hace caso · 4 +1d6 tripulación · 5 +1d6+3 · 6 +1d6+6.
- *Contratar marineros:* 1d6×3+4 disponibles; eliges cuántos (de 0 al máximo) a 2 de oro cada uno.
- *Buscar seguidor (2d6)* [sin inventario ni comida; ves quién sale y lo contratas o no]. Por defecto resistencia 10 y ataque 2:

| 2d6 | Seguidor | Notas |
|---|---|---|
| 2-3 | Pirata anciano retirado | Gratis. Resistencia 6 |
| 4 | Pescador (30 oro) | Sustituye al cocinero. +1 reserva cada vez que pescas algo |
| 5 | Nativo kalinago (45 oro) | Resistencia 12. Da el vínculo nativo; +1 en audiencias y buscar información en aldeas, y contra el mal |
| 6 | Forzudo (25 oro) | Ataque 3 |
| 7 | Artista (35 oro) | Ataque 1. Da la acción **Mendigar** (tabla propia, 2d6) |
| 8 | Cartógrafo | Evento (E079) |
| 9 | Barbero-cirujano (40 oro) | +1 en las tres audiencias; +1 PV con la acción Reposar |
| 10 | Navegante (30 oro) | Avanza 2 hexes por mar |
| 11 | Mono amaestrado (40 oro) | Sustituye al carpintero. Resistencia 3, no ataca. Al buscar información en puerto: 1d6, con 2-6 trae ese oro; con un 1, 1d6 de multa |
| 12 | Pirata experto (60 oro) | Resistencia 12, ataque 3 |

**Reposar, pescar y cazar [digital, Sprint 6: ver 3.11].** Tres acciones distintas. (Pescar y cazar son solo del jugador.)
- *Reposar:* +2 PV al jugador y a cada seguidor (+1 por barbero-cirujano). Riesgo del 20 %: a bordo, lista `descuido_a_bordo`; a la intemperie, nocturnos; en puertos, guaridas, aldeas y monasterios, ninguno.
- *Pescar (1d6):* a bordo o en tierra junto al agua: 1 nada · 2-3 → 3 · 4-5 → 5 · 6 → 7 reservas (+1 por pescador si pescas algo).
- *Cazar (1d6):* solo en tierra salvaje: 1 nada · 2-3 → 4 reservas y −1 PV · 4-5 → 5 · 6 → 8.
- Cantidades ya reequilibradas para la comida única del grupo (decidido por el autor en el Sprint 6).

**Comprar y vender comida [digital, Sprint 6].** Dentro de la acción "Ir al mercado" (puertos y guaridas), una reserva por clic: comprar a 5, vender a 2. Sin la tirada de papel ("solo hay alguien que compra"). **En las aldeas no hay mercado ni se cambian objetos por nada.**

**Solicitar audiencia (1d6).**
- *Gobernador (puerto):* 1 guardia te reconoce (E057) y no puedes repetir en este puerto · 2-3 denegada hoy, mañana +1 (no acumulable, solo al día siguiente) · 4 atiende su hija (E044) · 5-6 permitida (E042).
- *Jefe de aldea:* +1 con seguidor nativo, amuleto kalinago o sobrenombre "el nativo". 1 ofendes y no puedes volver · 2 no se permite · 3 denegada hoy, mañana +1 · 4-6 permitida (E043).
- *Capitán pirata (guarida):* +1 por cada 2 puntos de fama. 1-2 ofendes y no puedes volver · 3 no se permite · 4+ permitida (E045).
- Otros modificadores: barbero-cirujano +1, influyente +1 en puertos y guaridas, nativo +1 en aldeas.

**Visitar monasterio (dos acciones; programadas en el Sprint 6, sección 3.11):** *Rezar* (te purificas: se quitan **todas** las maldiciones, el amuleto maldito incluido) · *Descansar* (**todo el grupo: 20 de oro + 5 por seguidor**; todos recuperan toda la vida y esa noche duermen allí sin volver a pagar). **"Meditar" ya no existe.** Sin haber descansado, dormir en el monasterio en la fase de descanso **se paga** (ver 4.7).

**Investigar naufragio (1d6):** 1-2 barco maldito (1d6: 1-3 combate contra el pirata maldito, E078; 4-6 piratas esqueleto, E085), al superarlo 1d6×10 de oro y un tesoro (E036) · 3 guarida pirata (E038) · 4-5 hogar de alguien (1d6: 1 E086, 2 E071, 3 E076, 4 E072, 5 E083, 6 E075) · 6 restos antiguos (E053 y E021).

**Enterrar tesoro [digital, Sprint 6]:** solo en playa, jungla o jungla profunda. 100 de oro = **1 de Fama**. Sin objetos mágicos. Un tesoro por casilla, y no se desentierra.

**Registrar ruinas (2d6):** 2 E022 · 3 E049 · 4 E053 dos veces · 5 E078 y, si se supera, cofre E021 · 6-7 ciudad pirata neutral: E038 yendo directo al punto 3 · 8-9 E040 · 10 gruta E088 · 11 lámpara mágica: 1d6, con 3+ el deseo (E041; el "E045" del libro es una errata), con 1-2 te quedas la lámpara agotada · 12 recibes "el ídolo antediluviano" (si ya lo tienes, E037). Programado en el Sprint 6 (sección 3.11); una vez por casilla.

### 4.6 Fase de comida [digital, programada en el Sprint 5: `core/turno/comer.ts`]
- **Comer es obligatorio.** Cada día hace falta **1 reserva de comida** (más con condiciones como "hambre insaciable": `comidaPorDia`) y con eso come **todo el grupo**: jugador, seguidores y tripulación.
- **El jugador elige** entre gastar sus **reservas** o **pagar con oro**, donde se pueda:
  - **Puerto:** comer en la **taberna**, `AJUSTES.precioTaberna` (4) de oro por cada reserva que haría falta.
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
Antes "alojamiento". **"Taberna" es donde se come en un puerto; "posada", donde se duerme en un puerto.** **[Sprint 6] A bordo o bajo techo, 50 % de "dormir genial" (+1 PV), una tirada para todo el grupo** (en la tabla, "+1 PV" quiere decir eso); dormir a la intemperie no cura. Las guaridas funcionan como un puerto. Con la noche pagada (descansar en el monasterio, fiesta en la aldea) solo sale dormir allí gratis. **Nadie deserta por dormir al raso** (regla de papel eliminada).

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
| | Convencer a los nativos de que te dejen dormir en la aldea | — | **Chequeo de Ingenio** (regla nueva, abajo) |

- **Evento nocturno:** a la intemperie, salvo en un puerto: `AJUSTES.probabilidadEventoNocturno` según el terreno (25 % en jungla y playa, 35 % en jungla profunda; decidido en el Sprint 7, antes 33 % en todas), elegido de la lista ponderada de eventos nocturnos. En la tienda de campaña, 10 puntos menos (y se puede dormir genial).
- Solo se curan los que duermen bajo techo (o a bordo).
- **Dormir en la aldea [digital, decidido por el autor el 17-nov; sustituye a la tabla de papel]:** **con vínculo nativo**, se ofrece dormir en la aldea sin chequeo (gratis, bajo techo). **Sin él**, en la fase de descanso hay dos opciones: dormir a la intemperie, o intentar convencer a los nativos con un **chequeo de Ingenio**. Si lo superas, duermes en la aldea **solo esa noche** (al día siguiente, otra vez intemperie o chequeo). Si fallas, te echan: la aldea queda bloqueada y apareces en un hexágono vecino al azar (lo de la casilla, con el mapa). Excepción: con la fiesta de bienvenida, esa noche se duerme allí sin chequeo.

### 4.8 Combate
Por rondas hasta que un bando huye o es eliminado. **El daño se aplica a la vez.** Cada ronda se emparejan luchadores (si un bando supera al otro, uno puede enfrentarse a varios). Todos lanzan 1d6 y restan daño a la resistencia del rival.
- **Jugador:** 1 falla · 2-5 daño igual al dado · 6 daño 6 y vuelve a tirar acumulando; si en algún momento sale 1, falla todo el ataque (daño 0).
- **Enemigos y seguidores (solo ataque y resistencia):** 1-2 falla · 3-5 daño = su ataque · 6 su ataque +1.
- Resistencia 0 = muere. Si el jugador llega a 0, pierde la partida. Si ambos caen a la vez, el jugador asestó el golpe de gracia y se queda con 1 PV.
- **Huida (tras cualquier ronda; no se puede huir de combates dentro del barco):** el jugador tira 1d6, con 4+ huye. Si falla, los enemigos **no pueden fallar** su próximo ataque.

### 4.9 Combate naval (papel; en digital se sustituye por el duelo de cañones con abordaje de la sección 3.13)
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
| Naufragio, falta el 4 | **Resuelto:** barco maldito 1-3 pirata maldito, 4-6 piratas esqueleto |
| Chequeos de Fuerza | **Resuelto:** 1d6 ≤ Fuerza |
| Notas azules / veneno | **Ignorar** |
| Pesca y caza: el PDF dice 2d6 pero las tablas van de 1 a 6 | **Resuelto (Sprint 6):** 1d6, con cantidades nuevas (3/5/7 y 4/5/8) |
| Reequilibrar pesca/caza y precio de la comida | **Resuelto (Sprint 6):** comida máxima 12, taberna 4, comprar a 5 y vender a 2. Se afina jugando |
| Cocinero | **Resuelto (Sprint 6):** sustituido por el pescador (y el carpintero por el mono amaestrado) |
| Inanición: ¿capacidad de carga a la mitad? | **Pendiente decidir** |
| Victoria: ¿se gana al cumplir las dos condiciones o al entrar en un puerto después? | **Resuelto (20-nov):** al llegar a cualquier puerto con las dos cosas cumplidas (4 puertos principales visitados y la fama objetivo). El conformista también necesita los 4. "Visitado" = entrar en su casilla; el de inicio cuenta si es principal |
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
Cada mapa declara **4 puertos principales** (en el prototipo, uno por esquina: Tortuga, Port Royal, La Habana y Nassau, cada uno con su logo en la interfaz) (concretos, entre los varios puertos que tiene); el resto son puertos normales que no cuentan para la victoria. `mundo.puertosVisitados` guarda sus ids. La `ui` debe mostrar el progreso ("Puertos 1/4", con el logo de cada uno; más adelante en un menú) y señalarlos en el mapa.

### El mapa prototipo
- **30 columnas × 20 filas** (etiquetas `col.fila`: de 000.000 a 029.019), ~600 hexágonos.
- Hexágonos de **punta plana (flat-top)** con columnas impares desplazadas media casilla hacia abajo (se mantienen: el mapa ya está dibujado así y en SVG da igual). Sus **6 direcciones son N, NE, SE, S, SO y NO** (no existen E ni O); las tablas de dirección del libro usan 1.SE, 2.S, 3.NE, 4.SO, 5.NO, 6.N. Convertir por dentro a coordenadas axiales/cúbicas para vecinos y distancias (referencia: guía de hexágonos de Red Blob Games).
- Colores: alta mar (azul oscuro), costa (azul claro), jungla (verde claro), jungla profunda (verde oscuro), playa (amarillo).
- Rasgos: puerto (ancla) sobre playa/jungla, aldea (hachas cruzadas) sobre jungla profunda, monasterio (iglesia) sobre jungla, naufragio sobre playa, ruinas (castillo) sobre jungla profunda, barco y abundancia (pez) sobre agua. La calavera (dos huesos cruzados) de 009.000 es la **casilla de inicio** (E001): el jugador empieza a pie, debe ir al puerto 006.002 a recuperar su barco y allí tira la tabla del albacea.

### Varios mapas, sin generador aleatorio
El autor creará **2 o 3 mapas a mano**; al empezar una partida se elige uno (aleatorio con la semilla del juego, y/o menú).

```
data/mapas/<id>.json → { id, nombre, columnas, filas, inicio: {col,fila},
                         puertosPrincipales: [{id, nombre, col, fila} x4], hexagonos: [...] }
```
Ningún código debe asumir 30×20. Al cargar un mapa, comprobar que tiene exactamente 4 puertos principales y que cada uno es de verdad un puerto.

### Origen de los datos: Worldographer
Los mapas se dibujan con **Worldographer**. Su archivo `.wxx` es (según documentación de librerías de terceros para la versión 1.73) **XML comprimido en gzip y codificado en UTF-16**, con *tiles* (terreno) y *features* (iconos). Plan: **un script que convierta el `.wxx` al JSON del mapa**, reutilizable; hay que verificarlo con el archivo real (pendiente). Al dibujar: un único tipo de terreno por color y un icono distinto, siempre el mismo, por rasgo.
- **Comprobado por el autor (18-nov):** probado en otra conversación de Claude, el `.wxx` real se lee perfectamente y basta para construir el mapa con sus hexágonos e iconos. No hace falta importar imágenes.
- **Decidido (18-nov): el mapa se pinta desde los datos, sin imagen encima.** SVG con un polígono por hexágono; la estética (colores, bordes, texturas por terreno) va por CSS y los iconos de los rasgos son propios del juego, no los de Worldographer. Así los cambios de la partida (barco agotado, aldea bloqueada, marcas, niebla) se pintan solos. El juego no lee el `.wxx` en marcha: un script lo convierte una vez a `data/mapas/<id>.json`.
- **Lo que se sabe del `.wxx` real** (`pruebaxml.wxx`, en el proyecto de Claude; Worldographer 1.74, gzip + UTF-16): `hexOrientation="COLUMNS"` (punta plana), 30×20. El terreno va por casilla; los iconos (`<feature type=...>`) van en **píxeles** (`<location x y>`), y el script debe pasarlos a casilla: columna = (x − 150) / 225; fila = (y − 150) / 300, restando 150 más en columnas impares (comprobado: la calavera x=2175, y=300 cae en 009.000). Ignorar las naciones, culturas y religiones que Worldographer inventa. Hay **anclas repetidas** en 006.002, 027.002 y 023.018: el script debe avisar y quedarse con una.
- **Equivalencias provisionales** (confirmar en el Sprint 9): Water Sea Deep = alta mar · Water Sea = costa · Flat Farmland = jungla · Flat Forest Jungle = jungla profunda · Flat Beach = playa · Symbol Anchor = puerto · Building Church = monasterio · Symbol Battle Primitive = aldea · Symbol Shipwreck = naufragio · Military Sailship = barco · Symbol Crossbones = inicio. **Por aclarar con el autor (sin prisa):** qué son `Symbol Construction` (¿ruinas?) y `Symbol Cave` (5: 000.000, 028.000, 024.004, 025.006, 029.018); faltan iconos de abundancia y de guarida pirata; cómo se marcan los 3 puertos principales (icono distinto o lista en el JSON).

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

**Ids de eventos ya asignados** (código del libro → id): E002 `islote`, E003 `piratas_hostiles`, E004 `aldea`, E008 `barco`, E009 `vientos_fuertes`, E010 `vientos_favorables`, E011 `imprevisto`, E012 `rocas`, E013 `perdidos`, E014 `objeto`, E015 `sirenas`, E016 `polizon`, E017 `bob_vendedor_ambulante`, E018 `el_mal`, E019 `motin`, E020 `pandemia`, E024 `rumores`, E026 `monstruo`, E028 `tierra`, E030 `traicion`, E031 `escondite`, E033 `escorbuto`, E034 `tormenta`, E035 `botella`, E038 `guarida_pirata`, E039 `nido`, E040 `ruinas`, E042 `audiencia_gobernador`, E046 `nativos_hostiles`, E047 `bloqueado`, E048 `manantial`, E051 `explorador`, E052 `plantas_carnivoras`, E053 `esqueleto`, E054 `ritual`, E055 `nativos`, E056 `golem`, E058 `cabana`, E059 `picadura`, E061 `jaguar`, E062 `arenas_movedizas`, E063 `campamento`, E064 `dinosaurio`, E065 `marina`, E066 `bruja_vudu`, E067 `puente`, E068 `lluvias`, E069 `pantano`, E070 `sol`, E071 `pescador`, E072 `piratas_perdidos` (en barco: bote a la deriva; en tierra: deambulando; es el mismo evento), E074 `tripulacion_enterrando_tesoro` (renombrado para no confundirlo con la marca `tesoro_enterrado`), E075 `ermitano`, E078 `pirata_maldito`, E079 `cartografo`, E080 `misioneros`, E081 `taberna_clandestina`, E082 `mercado_de_esclavos`, E083 `contrabandista`, E084 `subasta_secreta`, E085 `piratas_esqueleto`, E086 `fugitivo`, E087 `carruaje`, E088 `cueva`, E089 `cangrejo`, E090 `volcan`. Las listas son orientativas: faltan eventos y están sin equilibrar.

**Ids nuevos del Sprint 6** (en las tablas de acciones): `guardia` (E057), `hija_del_gobernador` (E044), `audiencia_jefe_aldea` (E043), `audiencia_capitan_pirata` (E045), `arrestado` (E023), `maldicion` (E022), `tesoro_magico` (E037), `deseo` (E041), `muchacha_perdida` (E076), `tabu_sagrado`, `historias_junto_al_fuego`, `caceria`, `barco_maldito`, `restos_antiguos` (E053 + E021), `esqueletos` (E053 dos veces), `ruinas_pirata_maldito` (E078 + cofre), `ciudad_pirata` (E038 punto 3). Los tres últimos y `restos_antiguos` son **eventos compuestos** a propósito (encadenan otros): en digital un id no tiene por qué ser un E### del libro.

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
export interface Fila { min: number; max: number; texto?: string; efectos?: EfectoDefinicion[]; evento?: string;
                        tabla?: string; especial?: EspecialDeTabla; libro?: string }   // tabla y especial: Sprint 6
export interface Tabla { id: string; dado: string; filas: Fila[] }   // sin modificadores: el id de tirada lo decide quien llama

// resultado-tabla.ts  (lo que devuelve resolverTabla)
export interface ResultadoTabla {
  dados: number[];      // dados sacados, para mostrarlos
  modificador: number;  // bonificador aplicado
  total: number;        // suma de dados + modificador (antes de recortar al rango de la tabla)
  texto?: string;       // texto de la fila, si lo tiene
  efectos: Efecto[];    // siempre una lista (vacía si no hay)
  evento?: string;      // id (con nombre) del evento al que salta, si lo hay
  tabla?: string;       // "tira en otra tabla" (resolverConSubtablas)
  especial?: EspecialDeTabla;   // regla especial de la fila (la aplica quien usa la tabla)
}
```

Ejemplo de tabla en JSON:

```json
{ "id": "pesca", "dado": "1d6", "filas": [
    { "min": 1, "max": 1, "texto": "No pescas nada" },
    { "min": 2, "max": 3, "efectos": [{ "tipo": "comida", "cantidad": 3 }] },
    { "min": 4, "max": 5, "efectos": [{ "tipo": "comida", "cantidad": 5 }] },
    { "min": 6, "max": 6, "efectos": [{ "tipo": "comida", "cantidad": 7 }] } ] }
```
Una fila puede llevar efectos, un evento o ambas cosas: `{ "min": 9, "max": 12, "evento": "taberna_clandestina" }`. Un evento **no es un efecto**: es un salto del motor de eventos.

### Decisiones del Sprint 3
1. **`resolverTabla(tabla, modificador, dados): ResultadoTabla` no recibe el estado.** Solo la tabla, un número y los `Dados`. Tira `tabla.dado`, suma el modificador, busca la fila, resuelve las cantidades con expresión de dados (`"2d6"` → un número) y devuelve el resultado.
2. **`calcularModificador(jugador, idTirada)` es una función aparte** que suma lo que aportan sobrenombre, seguidores y objetos. Lo puntual (p. ej. "+1 por pagar 5 de oro") se suma al número antes de llamar a `resolverTabla`.
3. **Ids de tirada específicos:** `buscar_info_puerto`, `buscar_info_aldea`, `audiencia_puerto`, `audiencia_aldea`, `audiencia_guarida`, `pesca`, `caza`. Sobrenombres, seguidores y objetos declaran sus modificadores sobre estos ids, en datos, sin `if`s sueltos. Primera versión solo con sobrenombres: *influyente* +1 en `buscar_info_puerto`, `audiencia_puerto` y `audiencia_guarida`; *nativo* +1 en `buscar_info_aldea` y `audiencia_aldea`. (Después se añadieron `el_mal`, `discurso`, `contratar_seguidor`, `mendigar` y `buscar_info_guarida`.)
4. **Resultado fuera de la tabla:** se recorta al primer o último rango (21 en una tabla que acaba en 18 se trata como 18). **Un hueco dentro de la tabla es un error**, no un silencio.
5. **Efectos con dados salen ya resueltos** (números concretos). Los que dependen del estado (`mitad`, `maximo`, `todo`) y los fines de partida se devuelven tal cual y los resuelve `aplicarEfectos` (Sprint 4). `resolverTabla` copia cada efecto tal cual y solo convierte la cantidad.
6. **Los JSON pierden los tipos al importarse** (`"tipo": "oro"` es un `string`). Se convierte con `as` en **un único cargador de tablas**, y un **test valida todas las tablas**: sin huecos ni solapes, tipos de efecto conocidos (`RECURSOS` + fines de partida), operación y destino válidos (cantidad solo en sumar/fijar, `maximo` solo en recursos con máximo, destino distinto de jugador solo para la vida, no fijar en negativo) e ids de evento con formato válido. Aún no se puede exigir que el evento exista.
7. **Ids de evento con nombre**, no con el número del libro. Opcional mientras se pasan los eventos: un campo `"libro": "E081"` solo para cotejar con el PDF, que se borra después.
8. **Dados del papel:** sumar dados cambia las probabilidades (los extremos son raros, a propósito). Mantener el dado de papel en tablas con resultados "normales" y "raros"; para resultados igual de probables, dado único (`1d7`, `1d8`...). **Las tablas siempre son con dado y rangos** (los bonificadores necesitan rangos); **los pesos son solo para las listas de eventos**. Añadir un resultado = partir una fila o cambiar `1d7` → `1d8` y añadir la fila; el revisor avisa si las filas no cubren exactamente lo que saca el dado.
9. **Pesca y caza:** 1d6 (cantidades reequilibradas en el Sprint 6: 3/5/7 y 4/5/8).
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
- **Duda abierta:** la descripción del influyente dice "+1 al buscar información" sin especificar dónde; ahora está programado en puertos y guaridas. Falta confirmar si vale también en aldeas.

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

**Contrato del combate naval (para sustituirlo por un minijuego):** el paso recibe el barco enemigo y devuelve `victoria`, `huida` o `derrota` más la tripulación perdida; huir enlaza con E006. Cómo se juegue por dentro es indiferente al resto. Versión actual: duelo de cañones con abordaje (sección 3.13); el minijuego futuro (componente de Angular, probablemente canvas) solo dará un +1 a la tirada. Aviso a futuro: un minijuego de habilidad no es reproducible con semilla, así que ese tramo no se podría verificar en servidor si hay ranking.

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
6. ✅ Seguidores (efecto "se une un seguidor", catálogo de tipos, `inseparable`, bonificadores de seguidores), **condiciones otorgadas** por objetos, sobrenombres y seguidores (amuleto maldito, vínculo nativo con icono; sección 3.10), **pasar de la fase de acción a la de comida**, monasterio (rezar y descansar por 20 de oro), objetos (usos, descarte, vender en puertos y aldeas, elegir qué tirar si no cabe) y acciones sin eventos (pescar, cazar, comida, reclutar, descansar, enterrar tesoro). Todas las tablas de acciones del sprint están hechas (detalle en la sección 3.11).
7. ✅ Combate normal (con habilidades especiales de enemigos, sección 3.9; el afortunado) y naval provisional (duelo de cañones con abordaje, sección 3.13).
8. ✅ Guardado (sección 3.7): roguelike, autoguardado en cada cambio, semilla en el estado, versión con adaptadores y crónica de partidas.
9. Mapa (conversión `.wxx` → JSON, SVG), viajar (respetando `prohibe: viajar`, avisando de las llegadas para `alLlegar` y calculando el lugar para comida y descanso), `posicionBarco`, eventos de una sola vez en las listas de terreno, eventos que cambian el mapa y condición de victoria (con `famaObjetivoActual`).
10. Motor de eventos (punto único de tiradas con botones de objetos, atajos de escritura, paso "elige una cantidad", condiciones de ubicación) y primeros eventos reales (3-4 variados) para validar el formato.
11. Contenido, interfaz pulida, minijuego naval y, más adelante, backend.

Hasta el punto 8 no hace falta ni mapa ni libro de eventos. El 9 necesita el `.wxx` (el autor ya lo tiene y ha comprobado que se lee bien).

## 10. Pendiente del autor

- Añadir al repositorio el archivo **`.wxx`** del mapa prototipo. **Comprobado por el autor (18-nov): con el `.wxx` basta para construir el mapa hexagonal con sus terrenos e iconos; no hace falta ninguna imagen.**
- **Erratas del libro de eventos:** E008 barco negrero, opción 1, dice E018 (es E082, confirmado); "2dx10", "2x6x10" y "2dx6x10" en E008, E082 y E087 son `2d6x10` (confirmado); E044 resultado 3-4 dice E041 (debería ser E042); E072 piratas neutrales 5-6 dice E023 (seguramente E038); E081 beber y bailar 5 dice E041 (¿E044?); "8" suelto en E020; doble "1" en E019; en las tablas de dirección, "E" debe ser "NO".
- Confirmar si el +1 del **influyente** al buscar información vale también en aldeas (hoy: puertos y guaridas).
- Decidir la **comida máxima** definitiva jugando (ahora 12).
- ~~Confirmar pesca y caza en 1d6 y reequilibrar~~ (hecho en el Sprint 6; se afina jugando).
- ~~Rehacer el cocinero~~ (sustituido por el pescador). Decidir la **capacidad de carga** en la inanición.
- Completar y equilibrar las **listas de eventos por terreno** (ya pasadas del papel, faltan algunos eventos).
- **Libro de eventos**, empezando por 3-4 muestras variadas (tirada, decisión, combinado, con llamada y vuelta, y una con regla especial como el mapa del tesoro).
- Tabla de objetos mágicos (E037), lista de objetos y estadísticas de enemigos y barcos.
- ~~Decidir cómo encaja el guardado con el diseño roguelike~~ (decidido el 19-nov, sección 3.7). Más adelante: botón para **exportar la crónica**. Decidir el momento exacto de la **victoria** y el diseño del **minijuego naval** (solo dará +1 a la tirada) y **dónde se consiguen las mejoras del barco** (y si hay más).
- Decidir qué **eventos solo pueden salir una vez por partida** (de momento, el mal está a bordo).
- ~~Retocar la tabla para dormir en la aldea~~ (hecho: regla nueva con chequeo de Ingenio, sección 4.7).
- Revisar los combates de 4 enemigos del libro (E054, E082, E087) con el informe `claude/equilibrio-combate.md` (vida y nocturnos ya decididos).
- **Jefes (19-nov):** un jefe debería dar miedo incluso con la vida llena (propuesta de Claude: con 18 PV, un 20-30 % de muerte yendo solo y un 5-10 % con un seguidor). **Decidido: el gólem de la ciudad perdida (E050, jefe final) será 4/14 con piel de piedra** (se pondrá con `ataque`/`resistencia` en el pedido del combate al escribir E050). **El gólem del evento nocturno (E056) será algo menos fuerte** (números por decidir; hoy 3/12 en el bestiario; recordar que su evento trae un chequeo de Fuerza que le baja el daño). Pendiente: revisar con la misma vara el tiranosaurio, el cangrejo y el guardián de la isla.
- **Seguidores demasiado fuertes en combate (19-nov):** el autor **no quiere que con un seguidor todo sea seguro** (encontrarse un enemigo muy difícil yendo solo sí lo acepta: requiere que se junten varios factores). Opciones sobre la mesa, **sin decidir, tras probar el juego**: (a) "auto-nivel": más enemigos según los seguidores (p. ej. +1 por cada 2); (b) más resistencia a los enemigos por cada seguidor (+X); (c) limitar el grupo a 2 seguidores; **ya aplicado: siempre hay un enemigo que va a por el jugador** (ver arriba), que era lo que más protegía. **Simulado (19-nov): bajar el ataque de los seguidores a 1 apenas cambia nada** (contra un jaguar, de 2,4 a 2,8 PV perdidos); lo que protegía era que el enemigo repartiera sus golpes. Técnicamente (a) y (b) serían una opción del pedido del combate o un ajuste en `data/ajustes.json`; (c), cambiar `maximoSeguidores`. Se pueden simular antes de decidir.
- **E065 agente de la marina:** se queda en 2/8 + 2 guardias de momento (21 % de muerte yendo solo; evitable rindiéndose o sobornando).
- **Precios de los objetos de combate** (estoque, lanza, ron, pistolas, bomba, poción, tienda de campaña): provisionales; los revisará el autor.
- Equilibrar jugando los precios de `data/ajustes.json` (taberna 4, posada 5, monasterio 7, mercado, sobornos, marineros, apuestas...).
- ~~Nombres de los tipos de seguidor~~ (hecho). Decidir la carpeta de las imágenes.
- Decidir si la fila 5 de **El mal está a bordo** puede dejarte sin tripulación, y si el **motín** puede saltar estando a pie.
- Revisar sobre la marcha la **clasificación del libro de eventos** (`claude/clasificacion-libro-eventos.md` en el proyecto de Claude).
- Dibujos de objetos y condiciones (mientras tanto, iconos de reserva por categoría).
- ~~Escribir la tabla de buscar información en aldeas nativas~~ (hecha el 17-nov).
