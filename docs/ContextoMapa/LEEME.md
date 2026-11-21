# Mapa hexagonal de referencia — cómo convertir un `.wxx` nuevo

Este documento es para el Claude que trabaja en el proyecto. Acompaña a `mapa.html` (el mapa funcionando) y a la carpeta `iconos/`. El HTML es la referencia de **cómo se ve y cómo está hecho** (agua animada, espuma, cáusticas, costa, rejilla, zoom, barco). Aquí está todo lo que **no se deduce del código**: convenciones del autor, reglas de interpretación del `.wxx` y decisiones de diseño.

Si algo de este documento contradice al HTML, manda este documento (y pregunta al autor).

---

## 1. Qué hay que hacer con un `.wxx` nuevo

Objetivo: que el mapa nuevo se vea y se comporte exactamente igual que el actual (`pruebaGorda.wxx`), aplicando las mismas reglas.

Dos caminos:

- **Verlo sin tocar código:** abrir `mapa.html` y usar el botón **Abrir .wxx**. El lector interno ya aplica todas las reglas de este documento.
- **Dejarlo como mapa por defecto** (lo normal en el proyecto): sustituir la constante `DEFAULT` del HTML por los datos del mapa nuevo (ver §7). Así se abre directamente con ese mapa.

Antes de darlo por bueno, pasa la lista de comprobación de §9. Si el `.wxx` trae un terreno o un símbolo que no está en las tablas de §3 y §4, **no lo adivines: pregunta al autor qué es**.

---

## 2. Formato del `.wxx` (Worldographer)

- El archivo suele venir **comprimido con gzip** (empieza por los bytes `1F 8B`). Descomprimir primero.
- El XML está en **UTF‑16** (con BOM `FF FE` o `FE FF`); algunos mapas en UTF‑8. Detectar por los primeros bytes.
- `<terrainmap>`: lista separada por tabuladores de pares `nombre⇥índice`. Ej.: `Water Sea⇥2⇥Flat Farmland⇥1⇥…`.
- `<tiles tilesWide="30" tilesHigh="20">` con varios `<tilerow>`.
  - **Cada `<tilerow>` es una COLUMNA, no una fila** (los mapas son `hexOrientation="COLUMNS"`). Un mapa de 30×20 trae 30 `<tilerow>` de 20 líneas cada uno. Si se leen como filas, el mapa sale transpuesto.
  - Cada línea de un `<tilerow>` es una casilla; **solo importa el primer campo** (índice de terreno). El resto se ignora.
- Hexágonos de **lado plano arriba** (flat‑top), en columnas; **las columnas impares bajan media casilla**.
  - Vecinos de una casilla `(c, r)`:
    - columna par: `(+1,0) (0,+1) (−1,0) (−1,−1) (0,−1) (+1,−1)`
    - columna impar: `(+1,+1) (0,+1) (−1,+1) (−1,0) (0,−1) (+1,0)`
  - Posición en el mundo (radio del hexágono = 1): `x = 1,5·c`, `z = √3·(r + 0,5·(c impar ? 1 : 0))`.
- **Se ignora** todo lo demás: `<labels>`, `<shapes>`, `<notes>`, `<informations>` (Worldographer rellena naciones y gobiernos aleatorios que no tienen nada que ver con el juego).

---

## 3. Terrenos

Se clasifican por el **nombre** del terreno (en minúsculas), comprobando en **este orden** (el orden importa: `Water Sea Deep` contiene "sea" y debe ser alta mar):

| El nombre contiene | Tipo en el juego | Notas |
|---|---|---|
| `ocean` o `deep` | **Alta mar** | agua oscura |
| `water`, `sea`, `lake` | **Costa / mar** | agua clara |
| `beach`, `sand` | **Playa** | |
| `desert` | Desierto | sin icono propio todavía |
| `swamp`, `marsh` | Pantano | sin icono propio todavía |
| `mountain` | Montaña | sin icono propio todavía |
| `hill` | Colinas | sin icono propio todavía |
| `farm` | **Jungla normal** | **convención del autor**: en sus mapas *Flat Farmland* = jungla normal |
| `forest`, `jungle`, `wood` | **Jungla espesa** | **convención del autor**: *Flat Forest Jungle* = jungla espesa |
| (cualquier otro) | Llanura | sin icono propio todavía |

Importante: *Farmland* **no** es tierra de cultivo en este juego. Es jungla normal. No lo "corrijas".

Los terrenos sin icono (desierto, pantano, montaña, colinas, llanura) se dibujan con símbolos a tinta de reserva. Si aparecen en un mapa nuevo, avisa al autor: probablemente querrá iconos.

---

## 4. Lugares (símbolos de Worldographer)

Están en `<features>` como `<feature type="…" color="…">` con un `<location viewLevel="WORLD" x="…" y="…"/>` dentro.

| `type` en el `.wxx` | Significa en el juego | Icono |
|---|---|---|
| `Symbol Anchor` | **Puerto** | `city2`, `city3`, `city8` (se reparten) |
| `Symbol Anchor` con `color="1.0,0.0,0.0,…"` (ancla **roja**) | **Puerto importante** | los mismos `city*` |
| `Symbol Battle Primitive` | **Aldea nativa del Caribe** | `village`, `village_5`, `village_9`, `huts` (se reparten) |
| `Symbol Construction` | **Ruinas antiguas** | `ruined_keep` |
| `Building Church` | **Monasterio** | `church_icon_2` |
| `Symbol Cave` | **Guarida pirata** | `doodle_skull_icon` (la calavera) |
| `Symbol Shipwreck` | **Naufragio** | `ship_wreck` |
| `Military Sailship` (y cualquier barco) | **Se ignora** | — |

Los significados de *Battle Primitive*, *Construction*, *Church* y *Cave* son **convenciones del autor**, no lo que sugiere el nombre en inglés.

Reglas:
- **Ancla roja = puerto importante.** Es frecuente que el autor ponga un ancla roja **encima** de una negra en la misma casilla: en ese caso la casilla es **solo puerto importante** (el ancla negra no cuenta como un puerto más).
- **Un lugar por casilla.** Si coinciden varios, gana el puerto importante; en otro caso, el último.
- **De coordenadas a casilla:** Worldographer usa internamente una rejilla de 300 unidades por hexágono (independiente de los atributos `hexWidth`/`hexHeight`):
  - `c = round((x − 150) / 225)`
  - `r = round((y − 150 − 150·(c impar ? 1 : 0)) / 300)`
  - Comprobación: en un mapa bien leído, `(x − 150)/225` y el cálculo de `r` salen **exactos** (enteros). Si salen con decimales, el mapa usa otra escala: avisa al autor.
- Los puertos y puertos importantes no distinguen icono entre sí (decisión del autor). Solo cambia el nombre y el texto al tocarlos.

---

## 5. Reglas de dibujo que no son evidentes en el código

### Iconos
- Todos los iconos son PNG de **300×300 con fondo transparente**, dibujados **centrados en la casilla**. Tamaño en pantalla: el lado del PNG ≈ 2 × radio del hexágono (los lugares 2,05×).
- **Reparto de variantes en los lugares:** se recorren los lugares **en el orden en que aparecen en el `.wxx`** y se asigna la variante `n % número_de_variantes`, con un contador por tipo. **Puertos y puertos importantes comparten contador**, para que las tres ciudades salgan aunque haya pocos puertos. Con al menos tantos lugares como variantes, **todas las variantes aparecen**.
- **Icono fijo a mano:** la tabla `ICONO_POR_LUGAR` del HTML manda sobre el reparto. La clave es el nombre del lugar (`'San Telmo':'city2'`) o `"columna,fila"` para lugares sin nombre. En un mapa nuevo, los nombres cambian: revisa esa tabla (las entradas de otro mapa no aplican).
- **Las casillas con lugar no llevan vegetación** (ni árboles ni palmeras): solo el icono del lugar.

### Vegetación (alternancia de árboles)
- **Un grupo de árboles por casilla** (cada PNG ya es un grupo del tamaño de un hexágono).
- Jungla **espesa**: uno de `tree22`, `tree24`, `tree25`. (Falta `tree23`: cuando el autor lo pase, añadirlo a la lista `espesa`.)
- Jungla **normal**: uno de `tree13`, `tree15`, `tree16`, `tree17`.
- En **~12 %** de las casillas de jungla normal se pone `tall_grass_3` o `reeds_4` **en lugar de** árboles ("en muy pocas", según el autor).
- **Playa**: palmeras (`palmeras`, `palmeras2`) en **~58 %** de las casillas; el resto, solo punteado de arena. Nada de palmeras a tinta.
- La elección es **pseudoaleatoria pero fija** por casilla (función `hash(c, r, semilla)`), así el mismo mapa sale siempre igual. Cada icono de vegetación se voltea en espejo el 50 % de las veces.
- En casillas de **borde de costa** (con algún vecino de agua o fuera del mapa) los árboles se dibujan al 86 % y las palmeras más pequeñas, para que no se metan en el agua.

### Costa y borde del mapa
- La costa no sigue los hexágonos: se calcula una **silueta orgánica** de la tierra y a partir de ella la línea de costa, la espuma y las olas. El agua (costa/alta mar) sí respeta los hexágonos, con un fundido suave entre ellos.
- **La tierra que toca el borde del mapa continúa fuera de él**: no se le dibuja costa en el borde, el mapa simplemente la "corta".
- El mapa **ocupa toda la página, sin márgenes**, y termina en un **borde nítido que sigue los hexágonos**. Fuera, transparente (se ve el fondo de la página). Sin pergamino alrededor, sin bordes quemados, sin brújula, sin cartela, sin escala (el autor las quitó a propósito).

### Nombres (inventados para ambientar)
Ningún `.wxx` trae nombres; **todos son inventados** y se generan así:
- **Islas** = grupos de tierra conectada. Se ordenan **de mayor a menor** y se nombran con la lista `NAMES.island` en ese orden. **Solo las de 5 casillas o más** llevan nombre.
- **Mares**: hasta 3 nombres (`NAMES.sea`) en casillas de alta mar lejos de tierra y del borde, separados entre sí.
- **Puertos importantes, puertos, monasterios y guaridas**: nombre de su lista en el orden del archivo. **Aldeas, ruinas y naufragios no llevan nombre.**
- Los nombres se colocan donde no se pisen (debajo del lugar o de la isla; si no cabe, encima o al lado).
- Si el autor quiere nombres concretos para un mapa, se cambian las listas `NAMES`.

### Barco
- Empieza en una casilla de agua **junto al primer puerto importante** del archivo (si no hay, junto a la primera costa).
- Solo navega por agua (costa y alta mar); la ruta se traza en rojo discontinuo con una X en el destino y se borra al llegar. **No deja estela** (el autor la quitó).
- El modelo 3D del barco va incrustado en el HTML (`SHIP_GLB`, `SHIP_TEX`).

---

## 6. Paleta «Caribe vivo» (elegida por el autor)

| Elemento | Color | Dónde está en el código |
|---|---|---|
| Playa | `#F2D296` | `KINDS.sand.tint` |
| Jungla normal | `#86B858` | `KINDS.jungle.tint` |
| Jungla espesa | `#2E6A36` | `KINDS.dense.tint` |
| Costa (agua clara) | `#3AA6C8` | shader, `vec3(.23,.65,.78)` |
| Alta mar | `#1E5A86` | shader, `vec3(.12,.35,.53)` |
| Papel (base) | `#EBDDB8` aprox. | pasada de píxeles, «papel Caribe vivo» |
| Tinta | `#3A2717` | `INK` |
| Rojo (rutas, acentos) | `#9B2A1C` | `RED` |

El agua y la tierra se multiplican por la luminosidad del papel, así conservan su textura: el color final es algo más apagado que el valor de la tabla.

Criterio del autor: la jungla espesa y la normal **tienen que distinguirse claramente**; costa y alta mar también. No muy recargado, pero con color.

---

## 7. Dejar un mapa nuevo como mapa por defecto

`DEFAULT` en el HTML tiene esta forma:

```js
const DEFAULT={
 names:{0:"Flat Forest Jungle",1:"Flat Farmland",2:"Water Sea",3:"Water Sea Deep",4:"Flat Beach"}, // índice → nombre del terrainmap
 rows:["00000001...", ...].map(s=>[...s].map(Number)),   // una cadena por FILA (ya transpuesto), un dígito por casilla
 features:[["lair",0,0],["port",14,11], ...].map(([k,c,r])=>({k,c,r}))  // tipo, columna, fila
};
```

- `rows` va **por filas** (ya convertido desde las columnas del `.wxx`).
- Con un dígito por casilla caben índices de terreno 0–9. Si un mapa tiene 10 terrenos o más, cambiar el formato (por ejemplo, arrays de números).
- Tipos válidos en `features`: `port`, `bigport`, `village`, `ruins`, `monastery`, `lair`, `wreck`.
- La forma más segura de generarlo es reutilizar la función `parseWxx` del propio HTML (ya hace la transposición, la detección del ancla roja y la conversión de coordenadas) y volcar su resultado.

---

## 8. Iconos: carpeta vs. copia incrustada

- Los **originales** están en `iconos/` (son los que valen para el proyecto).
- El HTML lleva además una **copia incrustada** en base64 (`ICON_DATA`) porque, abierto con doble clic (`file://`), los navegadores no dejan usar imágenes sueltas en WebGL.
- Con el HTML servido desde el proyecto (servidor local o del juego), poner `ICONOS_DESDE_CARPETA = true` y leerá de `iconos/`.
- Si se añade o cambia un icono y se sigue usando la copia incrustada, **hay que regenerar `ICON_DATA`** a partir de la carpeta; si no, el HTML seguirá mostrando la versión vieja.
- `ICON_SETS` define qué iconos van en cada tipo. Para añadir un icono nuevo: meter el PNG en `iconos/`, añadir su nombre (sin `.png`) a la lista que toque y, si se usa la copia incrustada, regenerarla.

---

## 9. Lista de comprobación para un `.wxx` nuevo

1. ¿Ancho × alto coincide con `tilesWide` × `tilesHigh`? (Si sale al revés, se han leído los `<tilerow>` como filas.)
2. ¿Todos los terrenos del `<terrainmap>` encajan en la tabla de §3? Si hay alguno nuevo → preguntar.
3. ¿Todos los `type` de `<feature>` están en la tabla de §4 (o son barcos)? Si hay alguno nuevo → preguntar qué es y qué icono lleva.
4. ¿Todos los lugares caen en coordenadas exactas y dentro de la rejilla?
5. ¿Las anclas rojas superpuestas a negras se han contado como un único puerto importante?
6. ¿Salen todas las variantes de ciudad y de aldea? (Si hay menos lugares que variantes, es normal que falte alguna.)
7. ¿La tabla `ICONO_POR_LUGAR` tiene entradas de otro mapa que ya no aplican?
8. Abrir el resultado y mirarlo: jungla espesa vs. normal claramente distintas, costa vs. alta mar claramente distintas, iconos sin pisar el agua, nombres legibles al hacer zoom.

---

## 10. Dependencias externas

- **three.js 0.147** (dibuja el barco 3D) se carga desde `cdn.jsdelivr.net`. Sin conexión, el barco sale dibujado a tinta y el resto funciona.
- **Fuentes** «Pirata One» e «IM Fell English» desde Google Fonts. Sin conexión, los nombres salen con una fuente genérica.
- Todo lo demás (mapa, iconos, modelo del barco) va dentro del HTML.
