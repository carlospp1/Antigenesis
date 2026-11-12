# ANTIGENESIS

Juego idle/estrategia de una colonia de hormigas en 3D (three.js + Vite).
De día las obreras recolectan y alimentan a la reina; de noche llegan termitas y jefes.

## Arrancar

```bash
npm install
npm run dev       # http://localhost:5173  (visor de modelos: /viewer.html)
npm run build     # genera dist/, se puede subir a cualquier hosting estático
npm run preview   # sirve dist/ para probar el build
```

## Cómo se juega

- Empiezas **sin hormigas**: toca a la reina para que ponga huevos y toca la cría para que crezca.
- De día las hormigas traen comida (jalea). De noche salen todas a pelear.
- Si caen todas, los enemigos bajan por el túnel y **matan a la reina**. Ganas ADN y fundas otra colonia.
- **Árbol** (tecla T): grafo de mejoras de la colonia, pagado con jalea (y biomasa en los rombos). Se pierde con la reina.
- **Linaje** (tecla L): árbol permanente pagado con ADN. Además cada ADN ganado da +3% a todo («Sangre antigua»).
- Cada 4 noches llega una especie más fuerte, con un jefe en la cuarta: hormigas rivales → bachacos → termitas
  → cucarachas → arañas → escarabajos → **humanos** (noche 25). Si los vences, las hormigas conquistan el mundo.

## Equilibrio

Todos los números de dificultad están en `BAL` ([src/game/data.js](src/game/data.js)).
Hay dos jugadores automáticos que comparten el mismo cerebro ([src/game/brain.js](src/game/brain.js)):
toca a 2–3 toques/s (cada vez menos según avanza), compra lo que más mejora la colonia por lo que cuesta,
ahorra si lo bueno está cerca, evoluciona, gasta el linaje y funda antes de una noche perdida.

### Bot en el navegador (tiempo real)

Juega la partida de verdad, con gráficos, y respeta la velocidad (×1, ×2, ×4, ×6, ×10, ×20).

- Abre `http://localhost:5173/?bot=1&speed=6`, o pulsa **B** (o Ajustes → Bot) y dale a *Empezar*.
- El panel muestra toques/s, colonia actual y el tiempo de cada prestigio (de juego y real).
- **Registro CSV / JSON**: cada toque, compra, ahorro, evolución, linaje, fundación y evento (noches, nacimientos…),
  con tiempo real, tiempo de juego, velocidad, generación, noche y recursos. Al ganar se descargan solos.
- Consola: `__ax.bot.summary()`, `__ax.bot.download('csv')`, `__ax.bot.stop()`.
- La velocidad efectiva depende del equipo: el juego limita el paso por fotograma, así que en un PC lento ×20 rinde menos.
  El resumen siempre separa tiempo de juego y tiempo real. Ojo: el bot usa tu partida guardada (reiníciala en Ajustes para empezar de cero).

### Simulador rápido (sin gráficos)

Juega cientos de partidas en segundos con varios perfiles de jugador y las compara con los objetivos
de diseño (`TARGETS` en [tools/sim.mjs](tools/sim.mjs)):

```bash
npm run sim                                         # todos los perfiles: promedio, activo, normal, casual, idle
node tools/sim.mjs --profile=promedio --runs=20
node tools/sim.mjs --profile=casual --runs=1 --v --trace   # detalle de cada colonia y cada noche
node tools/sim.mjs --foeHpG=1.42                    # probar otro valor de BAL sin tocar el código
npm run tune                                        # busca valores de BAL que cumplan los objetivos
node tools/sim.mjs --tune=foeHpG,adnK,skillG --runs=10 --out=ajuste.json
```

## Móvil

`npm run dev:movil` y abre en el móvil la dirección «Network» que muestra Vite (misma wifi).
Se juega mejor en horizontal: al pulsar *Empezar* se pide pantalla completa y se fija la orientación si el navegador lo permite.
Pellizca para acercar (también en el árbol). Se puede instalar como app (manifest en `public/`).

## Cómo está hecho

Vista lateral en 2.5D: el fondo es una imagen pintada (`public/bg/nest.jpg`) y encima se
dibujan los modelos 3D con una cámara ortográfica que trabaja **en píxeles de esa imagen**.
Las colisiones, los caminos y la interfaz son código.

- **Colisiones**: polígonos caminables (hierba, túnel y suelo de la cámara) en
  [src/scene/layout.js](src/scene/layout.js). Pulsa **C** en el juego para verlos.
  Si cambias el fondo, solo hay que mover esos puntos.
- **Profundidad**: lo que está más abajo en la imagen se dibuja delante y algo más grande.
  En el túnel las hormigas se ponen de perfil y trepan.
- **Interfaz**: HTML, CSS e iconos SVG dibujados en código ([src/ui/icons.js](src/ui/icons.js)).

## Estructura

```
index.html            marcado de la interfaz, guía y créditos
viewer.html           visor para calibrar modelos (orientación y tamaño)
public/bg/nest.jpg    fondo
public/models/        modelos .glb + CREDITS.md
src/
  main.js             arranque, bucle principal, acciones de botones y atajos
  style.css
  core/               bus de eventos y formato de números
  game/               lógica pura (sin DOM ni three): data (BAL, eras), rules, trees, storage
  scene/
    index.js          fachada: init, update, pick, anclas de etiquetas…
    layout.js         ← coordenadas del mapa: zonas, comida, reina, cría, combate, tamaños
    colliders.js      punto en polígono, puntos aleatorios, corrección y vista de depuración
    actor.js          coloca un modelo 3D sobre el fondo (inclinación, giro, sombra, túnel)
    background.js     plano con la imagen y brillo nocturno de la cámara
    antRig.js         hormigas articuladas en código (patas, antenas, cabeza, abdomen)
    camera.js         cámara ortográfica «cover» con zoom y arrastre
    assets.js         carga y normaliza los .glb  ← tabla MODELS
    creature.js       modelo .glb o geometría procedimental de respaldo
    geometry.js       huevos, larvas, partículas y hormigas de respaldo
    brood.js          reina y montones de huevos y larvas
    colony.js         obreras y soldados (rutas, tareas, combate)
    enemies.js        termitas, araña y escarabajo
    particles.js
  audio/audio.js      música y efectos procedurales (Web Audio)
  ui/                 hud.js, tree.js (vista de árbol), input.js, icons.js
tools/sim.mjs         simulador de equilibrio (bot.mjs: jugador, sim-worker.mjs: hilos)
legacy/antigenesis.html   la versión original de un solo archivo
```

## Cambiar un modelo

1. Copia el `.glb` a `public/models/`.
2. Edita su entrada en `MODELS` (`src/scene/assets.js`): `yaw` para que mire hacia +X,
   `length` para el tamaño, `recolor` para cambiar colores por nombre de material.
3. Abre `/viewer.html` y compáralo con la flecha y con la versión procedimental.

Si un modelo no carga, el juego usa automáticamente la hormiga dibujada por código.
Los modelos sin esqueleto se animan con un balanceo; los que traen clips (`Walk`, `Idle`,
`Attack`) los usan directamente, como la araña.
