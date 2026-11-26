# Pirate Prince (versión digital): guía para la IA

> Guía corta con lo **vigente**. El detalle de cada sprint (0-11), con fechas y porqués, está en `docs/historial.md` (CLAUDE.md antiguo, congelado el 25-nov): **buscar texto en él (grep), no leerlo entero.** Mantener este archivo corto: lo que se termina se resume en una línea; el detalle va al historial solo si hace falta.

## 0. Estado y siguiente paso

- **Hecho:** Sprints 0-11 (núcleo, turno, acciones, combate normal y naval, guardado, mapa, motor de eventos, combate bonito provisional) + Voz de mando y Amigo de la aldea (23-nov).
- **Ahora:** Sprint 12, eventos del libro, 1.ª mitad. Bloques: 1 tesoros (**hecho 25-nov**: E021, E022, E027, E029, E036, E037 2d6, objetos de Bob y mágicos, diplomático, cartógrafo, inventario 6, acción Reparar) · 2 mar con tablas (**a medias, 26-nov**: hechos E006, E007, E011, E012, E014, E015, E016 y E005 borrado; **faltan E020 pandemia, E026, E031, E035, E018/E033/E034**; E020 "pierdes un especialista a tu elección" = elegir a quién pierdes, como `hacerSitio` pero sin nadie a cambio) · 3 E008 barco (chalupa: pagas X de oro y te llenan la comida a tope; E005 borrado) · 4 mar con mapa (E009, E010, E028, E013, E002, **E024 `mapa_misterioso`**: ni objeto ni condición, una marca en el mapa (X roja); al entrar en ese hex salta lo que señala y la X desaparece; con cartógrafo ves qué hay en el destino, sin él solo la X · acción "Dibujar mapa" del cartógrafo, 30 oro) · 5 pendientes de aldea y ruinas · 6 audiencias (E042-E045) · 7 cárcel, guarida y motín (E023, E032, E038, E019; botón "usar diplomático" en el guardia: −1d6 al soborno; bigote falso).
- **Decidido 25-nov:** pendientes de puerto (E017 tienda, E081, E066, E082-E084, "hogar de alguien") → Sprint 13. "Tira en la tabla de reclutar" = `ganar_seguidor` `al_azar`. Monje: sin ficha. Diplomático y cartógrafo = seguidores 1/8 (45 y 40 de oro), en contratar (2 y 8) y en el sorteo al azar.
- **Hecho también el 26-nov:** motor: `oculta`, `desviar`, `salvaSi`, `soloNatural`, `siTiene`, `hacerSitio`, `sinAmuletoDelDestino`; tirada `rocas`; 20 % de fiesta al ganar un combate naval; avisos al llegar con evento (`escorbuto_curado`, `marineros_en_el_puerto`); evento `joven_guerrero`; interfaz: `ventana-de-accion` (mercado, marineros, seguidor, dados, combate naval) y `ventana-de-resultado` (4 s, se va sola).
- **Tests:** 1735 en 106 archivos el 25-nov; el 26-nov, más (el autor apunta la cifra al cerrar).

## 1. Cómo trabajar con el autor

- Daniel, programador web junior (Angular, PHP). Español. Quiere **entender cada pieza**: explicar sencillo, con ejemplos del juego, sin jerga; si no se entiende, reformular más simple.
- **Ritual:** plan → visto bueno → cambios → el autor lanza `ng test --watch=false` → siguiente. Un paso cada vez; no adelantar sprints. Si una regla del libro es ambigua o parece errata, **preguntar**, no decidir en silencio.
- **Eventos: de uno en uno** (pedido por el autor el 25-nov): dudas de ese evento → visto bueno → cambios → tests → el siguiente. Nunca varios a la vez.
- **Dados: solo de 6 caras** (1d6, 2d6, 3d6): la mesa de dados solo dibuja cubos.
- Claude **edita los archivos en el PC del autor** (`C:\DigitalPiratePrince\digital-pirate-prince`) pero **nunca hace commits ni push**, y **nada de Claude en el repositorio** (ni coautoría). El autor hace commit al cerrar cada bloque.
- **Ahorro de tokens:** ver sección 10.
- Código y carpetas en español (`pescar`, `estado`); lo propio de Angular en inglés.

## 2. El proyecto

Juego de aventuras **en solitario** del autor (papel y lápiz, inspirado en *Barbarian Prince*) pasado a web. Un turno = un día con 4 fases: **inicio** (actúan las condiciones) → **acción** (una) → **comida** → **descanso**. Mapa de hexágonos; casi todo es texto, tablas de dados y eventos.
- **Se gana** al llegar a cualquier puerto con la fama objetivo (10; 8 el conformista; +2 con ambición desmedida) y los **4 puertos principales** visitados (Tortuga, Port Royal, La Habana, Nassau). Victorias alternativas: E025 isla misteriosa, E050 ciudad perdida.
- **Se pierde** con vida o tripulación a 0, si muere el seguidor vital (el hermano) o por evento.
- **Libro de eventos:** en el proyecto de Claude, en texto: `00-indice.md` (una línea por evento: id, tipo, estado y archivo) y `01-eventos-E001-E022.md`, `02-…E023-E045`, `03-…E046-E068`, `04-…E069-E090` (cada evento con sus erratas y decisiones en un aviso ⚠). **Nunca en GitHub**. Si el libro y este documento no coinciden, **manda este documento**. Los `E###` son solo la referencia al libro; en el código los eventos tienen id con nombre (`taberna_clandestina`).
- **En papel todo es un evento; en digital no:** cada E### se convierte en lo que es (evento, tabla, combate, efectos, condición, tienda). Clasificación: `claude/clasificacion-libro-eventos.md` (proyecto de Claude).

## 3. Arquitectura

- **Angular 22** standalone + signals, SCSS, sin SSR, **Vitest**. Windows 11, Node 26. **Solo frontend**, guardado en `localStorage`. Mapa en canvas + WebGL (three.js 0.147.0).
```
src/app/
├── core/   ← REGLAS. TypeScript puro. NO importa Angular, store/ ni ui/ (lo vigila `npm run vigilar`).
├── data/   ← JSON de solo lectura (contenido del juego).
├── store/  ← juego.store.ts (el estado en un signal, guardado, crónica) + almacen-local.ts
└── ui/     ← pantallas y componentes (pintan y avisan). Sin reglas. Cada componente: .ts, .html y .css separados.
```
- **Flujo:** `ui → store.ejecutar((estado, dados) => regla(...)) → core → store → ui`. `ejecutar` es la **puerta única**: guarda al instante y apunta `mundo.estadoDados`; si la regla falla, deja todo como estaba. La ui puede llamar a consultas de `core/` (solo leen). Servicio `ui/servicios/jugar.ts` (`Jugar.hacer`) = `ejecutar` + registro + `conSusEventos`.
- **Reglas de oro:** estado **serializable** (sin clases, Map, Set, Date) y sin mutar; dados **con semilla** (`Dados`: `tirar`, `entero`, `probabilidad`, `elegirPonderado`; nunca `Math.random` salvo adorno visual); **`aplicarEfectos` es el único que cambia recursos/objetos/condiciones** (excepción: la contabilidad del turno en `core/turno/`); las reglas devuelven **datos, no mensajes** (los textos los pone `ui/textos/`).
- **Catálogos** (`core/catalogos/` + `data/`): la partida solo guarda ids y lo que cambia. Objetos, condiciones, seguidores, habilidades, enemigos (bestiario), barcos, encuentros, eventos, tablas, listas de terreno, mapas. Cada cargador explica arriba cómo añadir contenido y **cada revisor pasa por todo el contenido en los tests**.
- **Pantalla de pruebas** (`/partida`): fea a propósito, **no se borra nunca** (trampas, combates de prueba, lanzar eventos, fijar la próxima tirada). La pantalla definitiva irá en otra ruta (Sprint 14).
- **Regla de la interfaz (26-nov): todo lo que "se presenta" va en una ventana encima del mapa,** como los eventos: eventos, combates, combate naval y acciones a medias (mercado, marineros, seguidor en espera, mesa de dados; `ventana-de-accion`). En el panel de la derecha solo: elegir acción, inventario, comer y dormir. **Resultados en una ventana que se va sola** (con el ratón encima se queda; clic = quitarla) (`ventana-de-resultado`, `Jugar.hacer(…, { id, titulo, cuando? })`): toda acción con tirada o cambios; comer, dormir y el amanecer solo si pasa algo; viajar y embarcar nunca. El registro, igual. **Siempre que llegue un seguidor se pregunta y se puede despedir a uno** (`hacerSitio`); nada de darlo directo desde una tabla.
- **Traducción futura:** frases enteras con huecos (`"Pierdes {n} PV"`), las reglas comparan ids, nada de texto en dibujos.
- **Créditos:** todo recurso ajeno va a `CREDITOS.md` (game-icons.net es CC BY 3.0). Los iconos del Cartography Kit no se suben a GitHub. Tras añadir algo a `public/`, reiniciar `ng serve`.

## 4. Estado (`core/estado/`)

`Estado { version (VERSION_ESTADO = 3), jugador, mundo }`.
- **Jugador:** nombre, sobrenombre (id), retrato (`hombre`|`mujer`), vida/vidaMax, fuerza, ingenio, oro, tripulacion/tripulacionMax, comida, fama/famaObjetivo, diasSinComer, `inventario: {id, usosRestantes?, listoElDia?}[]` (6 huecos, cuadrícula 2×3 que se coloca sola en el Sprint 14; mochila sin fondo +4; `capacidadInventarioActual`), `seguidores` (máx. 2, 3 con carisma; `inseparable?`, `vital?`), `condiciones: {id, turnosRestantes?, partes?}[]`, fasesAccionPerdidas.
- **Mundo:** mapaId, `posicion`, `posicionBarco` (misma casilla = a bordo), dia, fase, `banderas`, `marcas` (por casilla, con `tipo`), `pilaEventos`, puertosVisitados, semilla, estadoDados, finPartida (`{resultado, motivo, causa?}`), accionEnCurso, combate, combateNaval, nochePagada, comidaGratis, ultimaBusquedaInformacion, diaDeEmbarque?
- **Los valores con condiciones se calculan, no se guardan:** usar `fuerzaActual`, `ingenioActual`, `vidaMaxActual`, `tripulacionMaxActual`, `maximoSeguidoresActual`, `famaObjetivoActual`, `comidaPorDia` (`core/condiciones/consultas.ts`) y `condicionesVigentes`/`tieneCondicion` (apuntadas + partes + otorgadas). Fuerza e ingenio, **máximo 5**.
- **Partidas viejas:** subir `VERSION_ESTADO` exige un adaptador en `core/guardado/adaptadores.ts`. Campos opcionales nuevos no lo necesitan.

## 5. Efectos y tablas

**Efectos** (`core/tablas/efecto.ts`, se escriben en JSON):
- Recursos `oro, comida, tripulacion, vida, fama, fuerza, ingenio, vidaMax` con `cantidad` (`8`, `-1`, `"2d6"`, `"1d6x10+5"`, `"-1d6"`; **perder = signo menos**) y `operacion` `sumar` (defecto) | `fijar` | `mitad` | `maximo` | `todo` | `tope` (baja a ese valor si tienes más). `destino` (solo vida): `jugador` | `todos` | `seguidor_azar` (con `siNoHay`) | `seguidor_elegido` (**hoy da error**).
- `ganar_objeto` / `perder_objeto` (`objeto`; ganar admite `"al_azar"` + `entre: [...]`), `poner_condicion` (`condicion`, `turnos?`, `partes?`), `quitar_condicion` (`condicion` o `categoria`), `perder_turnos`, `bandera`, `ganar_seguidor` (`seguidor`: id o `"al_azar"`, `inseparable?`), `ganar_partida` / `perder_partida`.
- Topes: ningún recurso baja de 0; características nunca de 1; comida ≤ `AJUSTES.comidaMaxima` (12). Objetos mágicos dan +1 fama. Condiciones no se duplican. El contable gana +1d6 al ganar oro.
- Devuelven `{ estado, cambios }`: `Cambio` = lista de cambios reales (datos; la ui los convierte en frases).

**Tablas** (`data/tablas/*.json`): `{ id, dado, filas: [{ min, max, texto?, efectos?, evento?, tabla?, especial?, libro? }] }`. Sin huecos ni solapes; fuera de rango se recorta. Los bonificadores van por **id de tirada** (`calcularModificador(jugador, idTirada)` suma sobrenombre, objetos, seguidores, condiciones y "por cada X de fama"). **Listas de terreno** (`data/eventos-terreno/`): eventos con pesos.

**Condiciones** (`data/condiciones.json`): `categoria` (`maldicion`, `bendicion`, `enfermedad`, `clima`, `mejora`, `otra`), `modificadores`, `prohibe` (`viajar`, `enterrar_tesoro`, `nuevos_seguidores`), `ajustes` (famaObjetivo, comidaPorDia, fuerza, ingenio, vidaMax, tripulacionMax, maximoSeguidores, reduccionDano, reduccionDanoNaval), `cadaTurno` (efectos/tabla al amanecer), `alLlegar` (lugar `tierra|puerto|aldea|naufragio`: se quita y puede dar efectos/evento; **para que el jugador lo vea, un evento con su texto**: `escorbuto_curado`, `marineros_en_el_puerto`), `imagen`. `otorga` en objetos, sobrenombres y habilidades = condiciones calculadas mientras se tenga la fuente.

**Objetos** (`data/objetos.json`): `tipo` pasivo|activo, `usosMaximos`, `espacios`, `cuandoSeUsa` (`accion`|`evento`|`combate`), `alUsar`, `enCombate` (`bonificador`, `dado_extra`, `huida`, `derrota_a_todos`), `precioVenta` (obligatorio), `magico`, `modificadores`, `otorga`, `banderaAlVender`, `textoAlAgotarse`, `espacios` (0 = no ocupa), `huecosExtra`, `fama` (mientras lo llevas), `alUsarEvento`.

## 6. Motor de eventos (`core/eventos/`) — lo que se usa al escribir eventos

**Para añadir un evento:** `data/eventos/<id>.json` + una línea de import en `cargar-eventos.ts`. El test `todos-los-eventos.spec.ts` lo juega solo al azar (no hay que escribirle nada); los eventos complicados llevan además su `<id>.spec.ts` a mano. Ejemplos completos: `deseo.json`, `guardia.json`, `borracho.json`, `piratas_hostiles.json`.

- **Evento:** `id`, `titulo`, `imagen?` (ruta en `public/`), `unaVez?`, `muerte?`, `pasos` (empieza en `inicio`), `libro?`.
- **Rama** (lo que hay en cada salida): `texto?`, `efectos?`, `amuletoMaldito?` (E027; si viene de una tirada de 2d6, dado 1 = bendición y dado 2 = maldición), `tiradaOculta?` (con `evento`: su tirada se tira sola, sin enseñarla), `desviar?` (`{ direccion, pasos }`: mueve en línea recta tras los efectos; "al azar" = tirada de 1d6 con una fila por dirección; E011), `muerte?`, `pausa?` (fuerza un "Continuar") y cómo sigue: `paso` | `evento` (salta sin volver) | `llamar` (otro evento y vuelve a `paso`); nada = fin.
- **Paso** = una rama que además pide **una** cosa:
  - `opciones`: `[{ texto, requiere?, ...rama }]`. Requisitos: `sinObjeto`, `puedeGanarSeguidor`, `puedeSubir` (`fuerza`|`ingenio`), `oro` (número o `"cantidad"`). Las no disponibles salen desactivadas con motivo. `hacerSitio: true` (con un `ganar_seguidor`): solo sale con el grupo lleno; lista para despedir a uno (no inseparables) o "Mejor no" (E014, E016).
  - `tirada`: `{ dado, modificador?, idTirada? (suma los bonos del jugador), siSaleMenosDe1? (rama), guardarCantidad? (multiplicador: la tirada a la vista fija {cantidad}, el soborno del guardia), oculta? (se tira sola al llegar al paso: la resaca de la fiesta), boton (OBLIGATORIO, con sabor), filas: [{ min, max, volverATirar?, saltarSiTiene? (condición), soloNatural? (solo con el dado sin bonos; si no, la fila anterior: la fama de E012), salvaSi? ({ seguidores, texto }: si llevas uno, se lee el problema + cómo te libra, con {seguidor} = su nombre, y se acaba; E011), ...rama }] }`. Vale el amuleto del destino (eliges fila) y la trampa de fijar tirada.
  - `chequeo`: `{ caracteristica, modificador?, boton?, exito, fallo }` (1d6 ≤ característica; **un 6 natural falla siempre**).
  - `combate`: `{ enemigos | encuentro, puedeHuir?, noMortal?, sorpresa?, boton?, botonDelEncuentro?, victoria, huida, derrota (solo si noMortal) }`. `enemigos` = `[{ enemigo, cantidad?, ataque?, resistencia?, recompensa? }]`. `encuentro` = tablita de `data/encuentros.json` (p. ej. `piratas_hostiles`).
  - `combateNaval`: `{ barco, victoria, huida }`.
  - `segun`: `{ barco?, puerto?, otro? }` (rama según dónde estés; guarida = puerto).
  - `siTiene`: `{ id, si?, no? }` (rama según si llevas ese objeto o tienes esa condición; la lira en E015).
  - `cantidad`: `"1d6x5"` se tira al entrar en el paso; se usa como `{cantidad}` en textos, `"cantidad"`/`"-cantidad"` en efectos y en el requisito `oro`.
- **Reglas del motor:** la pila va en el estado (se guarda a mitad); un evento sin programar se salta y sale como "pendiente"; eventos `unaVez` se quitan de listas y tiradas (en una tirada se vuelve a tirar por dentro); mano de mono solo en el primer evento de la cadena; al morir se queda la ventana con el porqué; entre pasos del mismo evento no hay "Continuar" (lo leído queda arriba); sí al terminar o al saltar a otro evento.
- **Las reglas devuelven `eventos` (ids)** y `conSusEventos` los mete en la pila. Mientras hay evento o combate, todo lo demás sale desactivado (`evento_en_curso`, `combate_en_curso`).
- **Pendiente en el motor (decidido):** filas de encuentro sin pelea (E046 6 → nativos amistosos) y "tira dos veces" (E016, E088: juntar enemigos en un combate). Probables para el Sprint 12: elegir seguidor (despedir ya está: `hacerSitio`), "elige 2 de 3", "elige una cantidad", tienda, elegir dirección (mover en una dirección fija ya está: `desviar`).

## 7. Reglas vigentes (resumen; detalle en el código y en el historial)

- **Personaje:** sobrenombre 1d11 (11 en `sobrenombres.json`, con nombre femenino); características 1d3 (fuerte 4/2, equilibrado 3/3, inteligente 2/4). Vida 18, oro 50, tripulación 40, comida 5, fama 0. El heredero empieza con un objeto mágico de `objetoInicialEntre` (sin ídolo, amuleto, anillo ni lira; sin fama).
- **Amuleto maldito** = una condición maldición con dos partes (bendición + maldición, 1d6 cada una, `data/amuleto-maldito.json`). Bendiciones: fuerza letal, súper cerebro, gran fortaleza, piel de piedra, carisma, **voz de mando** (+10 tripulación máx.). Maldiciones: hambre insaciable, **muy mala suerte (−3 en `tesoro` y `tesoro_magico`; total < 1 → trampa)**, ambición desmedida, avaricioso, hedor nauseabundo, manos torpes. Quitar una maldición se lo lleva entero. Si ya llevas uno, no recibes otro.
- **Combate normal:** jugador 1 falla, 2-5 daño, 6 = 6 y **elige** volver a tirar (un 1 lo anula); enemigos y seguidores 1-2 fallan, 3-5 su ataque, 6 ataque+1. Emparejamiento al azar (siempre un enemigo va a por el jugador). Hambre −1 por día (tope −3). Golpe de gracia, afortunado (1 vez), huir con 4+ tras la 1.ª ronda. Habilidades de enemigos: `curarse`, `revivir_debilitado` (máx. 3), `revivir_una_vez`, `ataca_dos_veces`, `piel_de_piedra`, `acierta_con_5`, `maldice_con_6`. Usar objetos en combate es gratis.
- **Combate naval:** 1d6+bonos contra 1d6; pierdes = −daño de tripulación; abordar a mitad de resistencia (combate sin huida); huir 3-6 desde la 2.ª ronda → E006; al ganar, 20 % de fiesta en tu honor (E007). 8 barcos en `barcos.json` (Bob y Pit no se atacan). Mejoras: cañones buenos, casco reforzado, velas nuevas.
- **Comida:** 1 reserva para todo el grupo (o taberna 4 de oro en puerto; en aldea solo con vínculo nativo). Hambre: pierdes tantos PV como días; seguidores se marchan (10+10×días %); motín pendiente (`motin`).
- **Descanso:** posada/monasterio/barco = 50 % de dormir genial (+1 PV); intemperie con evento nocturno (25 % jungla y playa, 35 % jungla profunda; −10 con tienda); aldea: vínculo nativo o chequeo de Ingenio (fallar = te echan y aldea bloqueada; 2.ª vez convencidos = aldea amiga).
- **Acciones:** pescar, cazar, reposar, mercado (comida 5/2, vender objetos, rastrillo), discurso, marineros, buscar seguidor, buscar información (cada 2 días; puertos con sobornos, aldeas con su tabla, guaridas +1/2 fama), audiencia (una concedida por sitio), monasterio (rezar quita todas las maldiciones; descansar 20+5/seguidor), enterrar tesoro (100 oro = +1 fama), naufragio, ruinas, dados y pulso (guarida), mendigar (artista), reparar (kit: +1d6 tripulación, cada 3 días; `listoElDia` en el kit). `accionesDisponibles` las da todas, las imposibles desactivadas **con motivo** (regla de la interfaz).
- **Mapa:** `data/mapas/<id>.json` desde `.wxx` (`npm run convertir-mapa`). Hex de punta plana, direcciones N, NE, SE, S, SO, NO (libro: 1 SE · 2 S · 3 NE · 4 SO · 5 NO · 6 N; **"E" y "O" del libro son erratas**). Viajar 1 casilla (navegante por mar y superviviente en jungla profunda, 2); 50 % de evento de la lista del terreno; zona de barcos → `barco` (E008); guarida sin explorar → `guarida_pirata`. Desembarcar/embarcar gratis, una vez por turno, en cualquier tierra menos jungla profunda. Marcas: `casilla_bloqueada`, `rasgo_cambiado`, `echado_de_la_aldea`, `audiencia_vetada`... Mover: `moverA`, `echarAVecinaAlAzar`, `desviar` (`core/viaje/mover.ts`).
- **Guardado:** roguelike, una partida, autoguardado en cada cambio, crónica ordenada por fama y oro.

## 8. Erratas y decisiones del libro ya conocidas

- `2dx10`, `2x6x10`, `2dx6x10` (E008, E082, E087) = `2d6x10`. E008 negrero opción 1 dice E018 → es E082. E044 3-4 dice E041 → E042. E072 piratas neutrales 5-6 dice E023 → seguramente E038. E081 beber 5 dice E041 → ¿E044? "8" suelto en E020; doble "1" en E019 (el segundo es 2). Ruinas 11 dice E045 → E041. `1d6x1d6` → `2d6x3`.
- **Ya decidido para eventos concretos:** E087 3 guardias 2/6 (si superas Ingenio, cae uno al empezar) · E082 2 esclavistas 1/8 · E054 3 nativos 1/5 · E065 agente 2/8 + 2 guardias · E015 dos sirenas 2/6 · E050 gólem 4/14 con piel de piedra (E056 algo menos) · E023 = condición "en prisión" que bloquea el juego · E070 sin "cargar seguidores" · Bob y Pit no se atacan · seguidores sin inventario ni comida · el amuleto kalinago solo da bonificadores y vínculo nativo (nada de "entregarlo en la aldea") · el ídolo antediluviano vendido apunta una bandera (E050 debe decirlo).

## 9. Siguientes sprints

12 eventos 1.ª mitad (arriba) · 13 eventos 2.ª mitad (tierra, nocturnos, grandes: Bob, motín, victorias alternativas) · 14 interfaz pulida (pantalla definitiva, **mucho menos texto en las ventanas de resultado y de evento**: solo lo que importa, p. ej. dormir genial = "Has dormido genial +1 PV", sin "Dormir a bordo" ni líneas repetidas; hoy sale todo porque es la pantalla de pruebas, ventana de eventos bonita, combate definitivo, inventario en cuadrícula 2×3 que se coloca solo, iconos con descripción al pasar el ratón, dados más ágiles: más rápidos / tiradas en cadena con un clic / las poco importantes solas, tutoriales, traducción al inglés al final) · 15 cierre (más mapas, minijuego naval que solo da +1, equilibrio).

**Pendiente del autor (sin prisa):** comida máxima definitiva; capacidad de carga con hambre; influyente en aldeas; precios provisionales; seguidores quizá demasiado fuertes (opciones a/b sin decidir); revisar tiranosaurio, cangrejo y guardián con la vara de los jefes; dónde se consiguen las mejoras del barco; icono de la casilla de barco; `tree23`; logos de los 4 puertos.

## 10. Ahorro de tokens (decidido el 25-nov)

- **Una conversación por bloque de eventos** (4-8), no por evento ni por sprint. Al cerrar el bloque: tests en verde, actualizar §0 de este archivo (pocas líneas), commit del autor y conversación nueva.
- **Al empezar:** leer solo este CLAUDE.md, `00-indice.md` y el archivo del libro que toque (`01`-`04`). No leer `docs/historial.md` ni los informes salvo para buscar algo concreto con grep.
- **Antes de escribir un evento:** `grep -n` de su id y de su `E###` en `docs/historial.md` y en `src/app` (pueden quedar decisiones antiguas, enemigos ya en el bestiario o tablas que ya lo llaman). Los números exactos (enemigos, objetos, seguidores, precios) mandan los JSON de `data/`, no este resumen.
- **Leer código con cabeza:** grep y trozos (`sed -n`), no archivos enteros; un evento parecido ya escrito como plantilla.
- **Pocos mensajes y gordos:** cada mensaje reenvía toda la conversación, así que juntar las dudas de varios eventos en un solo mensaje y que el autor conteste todas a la vez.
- **Sin capturas ni navegador** salvo que el autor lo pida (las imágenes pesan mucho). Los tests los lanza el autor; Claude solo los lanza si hace falta depurar, y mira solo el resumen.
- **Este archivo no crece:** al cerrar algo, una línea aquí; nada de listas de tests por paso ni diarios.
