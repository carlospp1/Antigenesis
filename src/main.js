// ANTIGENESIS v5: arranque, bucle principal y conexión entre lógica, escena 2.5D, audio e interfaz.
import './style.css';
import * as Game from './game/index.js';
import * as Scene from './scene/index.js';
import * as Audio from './audio/audio.js';
import { on } from './core/events.js';
import { fmt, fmtTime } from './core/format.js';
import { ui, render, openSheet, toast, float, setTab, placeLabels, evoUnlocked } from './ui/hud.js';
import { wireStageInput } from './ui/input.js';
import { hydrateIcons } from './ui/icons.js';
import { burst, ghostHand } from './ui/fx.js';
import { tv, openTree, closeTree, renderTree, wireTree } from './ui/tree.js';
import * as Juice from './ui/juice.js';
import { playEnding, cancelEnding } from './ui/ending.js';
import { startTour, tourPending } from './ui/tour.js';
import { createBot } from './ui/bot.js';

const $ = id => document.getElementById(id);
let G, D, resetArmed = 0;

function act(a, id, btn) {
  let ok = true, sfx = 'buy';
  if (a === 'openTree') { openTree(G, id); sfx = 'click'; }
  else if (a === 'prestige') { leave(); return; }
  else if (a === 'close') { openSheet(G, null); sfx = 'click'; }
  else if (a === 'mute') { Audio.start(); Audio.set('mute', !Audio.vol.mute); G.mute = Audio.vol.mute; sfx = 'click'; }
  else if (a === 'tour') { openSheet(G, null); setTimeout(startTour, 250); sfx = 'click'; }
  else if (a === 'dev') { ui.devOpen = !ui.devOpen; sfx = 'click'; }
  else if (a === 'pause') { ui.paused = !ui.paused; sfx = 'click'; }
  else if (a === 'antModel') { try { localStorage.setItem('antigenesis.antModel', id); } catch (e) { /* nada */ } Game.save(G); location.reload(); return; }
  else if (a === 'speed') { ui.speed = +id; sfx = 'click'; }
  else if (a === 'bot') { bot.panel(); openSheet(G, null); sfx = 'click'; }
  else if (a === 'debug') { ui.debug = Scene.toggleDebug(); sfx = 'click'; }
  else if (a === 'free') { Game.debug.free = !Game.debug.free; toast(Game.debug.free ? 'Debug: cualquier evolución y ADN infinito.' : 'Debug apagado.'); sfx = 'click'; }
  else if (a === 'reset') {
    if (Date.now() - resetArmed < 4000) {
      cancelEnding(); Game.wipe(); Scene.reset(); G = Game.newGame(); D = Game.calc(G); resetArmed = 0;
      openSheet(G, null); toast('Partida nueva.'); sfx = 'click';
    } else { resetArmed = Date.now(); if (btn) btn.textContent = '¿Seguro? Pulsa otra vez'; sfx = 'deny'; Audio.play(sfx); return; }
  }
  Audio.play(ok ? sfx : 'deny');
  D = Game.calc(G); ui.holding = false; render(G, D);
}

/** Funda una colonia nueva (tras la muerte de la reina, o voluntariamente tras superar la noche 3). */
/** Fundar a voluntad: cobra el ADN y abre el Linaje; la colonia nueva empieza desde allí. */
function leave() {
  if (!Game.abandon(G)) { Audio.play('deny'); return false; }
  D = Game.calc(G); Game.save(G);
  Audio.play('win'); openTree(G, 'perm');
  toast(`La princesa se prepara para fundar: +${G.pendingAdn} ADN. Gástalo antes de empezar.`, 'good');
  return true;
}

function found() {
  const N = Game.prestige(G);
  if (!N) return false;
  Scene.reset(); G = N; D = Game.calc(G); Game.save(G);
  closeTree(); $('deathView').hidden = true; setTab('colony');
  toast(`Generación ${G.gen}: una princesa funda una colonia nueva.` + (G.ants ? ` Empieza con ${G.ants} hormigas.` : ' Empieza sin hormigas: toca a la reina.'), 'good');
  return true;
}

function buyNode(tree, id) {
  const ok = tree === 'evo' ? Game.evolve(G, id ? +String(id).replace(/\D/g, '') : 0) : Game.buyNode(G, tree, id);
  Audio.play(ok ? 'skill' : 'deny');
  D = Game.calc(G); renderTree(G, true); render(G, D);
  return ok;
}

/* Bot que juega en tiempo real (src/ui/bot.js): usa las mismas acciones que una persona. */
const bot = createBot({
  getG: () => G,
  tap(hit, visual) {
    if (visual) { clickScene(hit); return; }
    if (hit.kind === 'enemy') Game.hit(G, D); else Game.click(G, hit.kind, hit.id); // sin animación: a ×20 serían cientos por segundo
  },
  buy: (tree, id) => buyNode(tree, id),
  leave: () => leave(),
  found: () => found(),
  getSpeed: () => ui.speed,
  setSpeed: v => { ui.speed = v; },
  /** Partida nueva desde cero (el bot la usa al ganar para seguir jugando). */
  newGame() {
    cancelEnding(); Game.wipe(); Scene.reset(); G = Game.newGame(); D = Game.calc(G);
    for (const id of ['winView', 'deathView']) if ($(id)) $(id).hidden = true;
    openSheet(G, null); closeTree();
    return G;
  }
});

/** Autocompra del árbol de la colonia: se mira una vez por segundo. */
let autoT = 0;
function runAutoBuy() {
  if (!G.autoBuy || G.phase === 'dead') return;
  if (Game.autoBuy(G) > 0) { Audio.play('skill'); D = Game.calc(G); renderTree(G, true); }
}

function clickScene(hit) {
  if (G.phase === 'dead') return;
  if (!hit) return;
  if (hit.kind === 'enemy') {
    const d = Game.hit(G, D);
    if (d > 0) { Scene.enemyHit(); float('−' + fmt(d, 0), hit.pos, 'hit'); Audio.play('hit'); Juice.tap(G.combo, Game.comboMult(G, D), D.comboCap + 1); }
    return;
  }
  const r = Game.click(G, hit.kind, hit.id);
  Scene.bump(hit);
  Audio.play('click');
  Juice.tap(r.combo, r.mult, D.comboCap + 1); // racha de toques seguidos (rinden más)
  if (hit.kind === 'queen') { // la comida vuela hasta su boca y el número sale al tragarla
    if (r.crit) { float('¡×' + r.crit + '!', hit.click, 'lucky'); burst('×' + r.crit, 'Toque de suerte', r.crit >= 5 ? 'x5' : 'x2', Scene.toScreen(hit.click)); Audio.play('skill'); }
    Scene.feedQueen(hit.click, at => { float(r.laid ? '+huevo' : '+' + fmt(r.food), at, r.laid ? 'good' : r.crit ? 'lucky' : 'crit'); Audio.play('deposit'); });
    return;
  }
  float((r.crit ? '¡×' + r.crit + '! ' : '') + '+' + r.pct + '%', Scene.entityPos(hit.kind, hit.slot), r.crit ? 'lucky' : '');
  if (r.crit) { burst('×' + r.crit, 'Cría acelerada', r.crit >= 5 ? 'x5' : 'x2', Scene.toScreen(Scene.entityPos(hit.kind, hit.slot))); Audio.play('skill'); }
}

function wireButtons() {
  $('app').addEventListener('pointerdown', e => { if (e.target.closest('#dock,#sheet')) ui.holding = true; });
  window.addEventListener('pointerup', () => setTimeout(() => { ui.holding = false; }, 0));
  $('app').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) act(b.dataset.act, b.dataset.id, b); });
  $('sheet').addEventListener('click', e => { if (e.target.id === 'sheet') openSheet(G, null); });

  for (const b of document.querySelectorAll('#side .tab')) b.onclick = () => {
    const t = b.dataset.tab;
    if (t === 'lineage' && !evoUnlocked(G)) { toast(`El Linaje se abre cuando muere tu primera reina o al superar la noche ${Game.BAL.foundAfter}.`); Audio.play('deny'); return; }
    Audio.play('click');
    if (t === 'evolve' && !evoUnlocked(G)) { toast(`La Evolución se abre cuando muere tu primera reina o al superar la noche ${Game.BAL.foundAfter}.`); Audio.play('deny'); return; }
    if (t === 'tree') openTree(G, 'skills'); else if (t === 'lineage') openTree(G, 'perm'); else if (t === 'evolve') openTree(G, 'evo');
    else { closeTree(); setTab('colony'); render(G, D); }
  };
  tv.onBuy = buyNode;
  tv.onAuto = () => { G.autoBuy = !G.autoBuy; Audio.play('click'); if (G.autoBuy) runAutoBuy(); renderTree(G, true); };
  tv.onClose = () => { closeTree(); Audio.play('click'); };
  tv.onFound = () => { if (found()) Audio.play('win'); };
  let treeArmed = 0;
  tv.onReset = btn => {
    if (Date.now() - treeArmed < 3000) { treeArmed = 0; Game.resetSkills(G) ? Audio.play('buy') : Audio.play('deny'); D = Game.calc(G); btn.innerHTML = 'Reiniciar árbol <small>(devuelve todo)</small>'; renderTree(G, true); }
    else { treeArmed = Date.now(); btn.innerHTML = '¿Seguro? <small>pulsa otra vez</small>'; setTimeout(() => { btn.innerHTML = 'Reiniciar árbol <small>(devuelve todo)</small>'; }, 3000); }
  };
  wireTree(() => G);
  let foundArmed = 0;
  $('bFound').onclick = () => {
    if (Date.now() - foundArmed < 3500) { foundArmed = 0; ui.foundArmed = false; leave(); return; }
    foundArmed = Date.now(); ui.foundArmed = true; Audio.play('click');
    $('vFound').textContent = '+' + Game.legacy(G).gain; $('vFoundTxt').textContent = 'ADN · ¿Seguro? Pulsa otra vez';
    setTimeout(() => { ui.foundArmed = false; }, 3500);
  };
  $('deathGo').onclick = () => { $('deathView').hidden = true; openTree(G, 'perm'); Audio.play('click'); };
  $('winGo').onclick = () => { $('winView').hidden = true; Audio.play('click'); };
  const toggle = s => () => { openSheet(G, ui.sheet === s ? null : s); Audio.play('click'); };
  $('bBook').onclick = () => { try { localStorage.setItem('antigenesis.guideSeen', '1'); } catch (e) { /* nada */ } $('bookBadge').hidden = true; toggle('guide')(); };
  $('bGear').onclick = toggle('settings');
  $('bTrophy').onclick = toggle('goals');
  try { $('bookBadge').hidden = !!localStorage.getItem('antigenesis.guideSeen'); } catch (e) { /* nada */ }

  $('start').onclick = () => {
    if (tourPending() && !bot.on) setTimeout(startTour, 700); // primera partida: el tutorial
    $('intro').hidden = true; Audio.start(); Audio.set('mute', !!G.mute);
    if (G.phase === 'dead' && G.leaving) setTimeout(() => openTree(G, 'perm'), 0); // se cerró a mitad de fundar: vuelve al Linaje
  };
  window.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (e.key === 'b' || e.key === 'B') bot.panel();
    else if (e.key === 'c' || e.key === 'C') { ui.debug = Scene.toggleDebug(); toast(ui.debug ? 'Colisiones visibles (tecla C para ocultar).' : 'Colisiones ocultas.'); }
    else if (e.key === ' ' && $('intro').hidden) { e.preventDefault(); ui.paused = !ui.paused; toast(ui.paused ? 'Pausa.' : 'Seguimos.'); }
    else if (e.key === 'Escape') { if (tv.open && G.phase !== 'dead') closeTree(); else openSheet(G, null); }
    else if ((e.key === 't' || e.key === 'T') && $('intro').hidden && G.phase !== 'dead') tv.open && tv.tree === 'skills' ? closeTree() : openTree(G, 'skills');
    else if ((e.key === 'l' || e.key === 'L') && $('intro').hidden && evoUnlocked(G)) tv.open && tv.tree === 'perm' && G.phase !== 'dead' ? closeTree() : openTree(G, 'perm');
  });
  window.addEventListener('resize', Scene.resize);
  // móvil: al girar la pantalla o al cambiar la barra del navegador, recalcula tamaño
  window.visualViewport?.addEventListener('resize', Scene.resize);
  screen.orientation?.addEventListener?.('change', () => setTimeout(Scene.resize, 150));
  // pantalla completa al primer toque (si el navegador lo permite) y se intenta fijar en horizontal
  if (matchMedia('(pointer: coarse)').matches) $('start').addEventListener('click', () => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) Game.save(G); });
  window.addEventListener('pagehide', () => Game.save(G));
}

let lastFly = 0, topNight = 0; // efectos: último icono volando a la jalea; noche más lejana al empezar la de ahora
function wireGameEvents() {
  on('feed', d => {
    Game.feed(G, d.amount, d.dest);
    const n = fmt(d.amount);
    const pre = d.gold ? '✦ ' : d.lucky ? '¡×2! ' : '';
    if (d.dest === 'store') {
      float(pre + '+' + n, d.pos, d.lucky ? 'lucky' : 'good'); Audio.play('deposit');
      // lo guardado sube a la jalea: un icono vuela al contador (como mucho unos pocos por segundo)
      const now = performance.now();
      if (now - lastFly > 350) { lastFly = now; const sp = Scene.toScreen(d.pos); Juice.reward(sp.x, sp.y, d.gold ? 6 : d.lucky ? 3 : 1); }
    }
    else { float(pre + '+' + n, d.pos, d.lucky ? 'lucky' : 'crit'); Audio.play('deposit'); Audio.play('hatch'); }
  });
  on('lay', () => Audio.play('lay'));
  on('hatch', () => Audio.play('pupate'));
  on('sfx', d => Audio.play(d.id));
  on('born', d => { Audio.play('born'); float(d.shiny ? '✦ +1 dorada' : '+1', Scene.entityPos('larva', d.slot), d.shiny ? 'lucky' : 'good'); if (d.shiny) { Audio.play('win'); burst('¡Dorada!', 'Hormiga dorada', 'shiny', Scene.toScreen(Scene.entityPos('larva', d.slot))); } });
  on('dodge', () => float('¡esquiva!', Scene.entityPos('front'), 'good'));
  on('death', d => { Audio.play('death'); float('−1', Scene.entityPos('front'), 'hit'); });
  on('foeDeath', () => Audio.play('poof'));
  on('goal', d => {
    Audio.play('objective');
    Juice.celebrate('¡Objetivo cumplido!', d.prize ? '+' + fmt(d.prize) + ' de jalea' : d.text, 'goal');
    if (d.prize) Juice.reward(innerWidth / 2, innerHeight * 0.3, 8);
  });
  on('stage', d => {
    Audio.play('skill');
    Juice.celebrate('¡' + d.stage.name + '!', 'La reina ha crecido · sus hormigas cargan un 50% más', 'stage');
  });
  on('dusk', () => Audio.play('alarm'));
  on('night', d => { topNight = G.best; Audio.play('alarm'); Audio.play('wave'); toast('Noche ' + d.def.n + ': llegan ' + d.def.text + '.', 'warn'); });
  on('nightWin', d => {
    Audio.play('win');
    // celebración: más grande si cae un jefe (fin de era) o si es la noche más lejos a la que has llegado
    const boss = d.level % 4 === 0 && d.level < Game.FINAL_NIGHT, record = d.level > topNight && G.gen > 1;
    const next = boss ? Game.eraFor(d.level + 1) : null;
    if (boss) Juice.celebrate('¡Jefe derrotado!', 'Noche ' + d.level + ' · nueva era: ' + next.name, 'boss');
    else if (record) Juice.celebrate('¡Nuevo récord!', 'Noche ' + d.level + ' · nunca habías llegado tan lejos', 'record');
    else Juice.celebrate('¡Noche ' + d.level + ' superada!', '+' + fmt(d.prize) + ' de jalea' + (d.lost ? '' : ' · sin bajas'), 'night');
    Juice.reward(innerWidth / 2, innerHeight * 0.32, boss ? 22 : 14);
  });
  on('nightLost', d => { toast('Se retiran. Perdiste ' + d.lost + ' hormigas.', 'warn'); Audio.play('retreat'); });
  on('skill', d => { const n = (d.tree === 'perm' ? Game.PERKS : Game.SKILLS)[d.id]; if (n) toast((d.tree === 'perm' ? 'Linaje: ' : 'Árbol: ') + n.name + '.', 'good'); });
  on('emergencyEgg', d => { if (G.stats.laid > 1) toast('Colonia vacía: la reina pone un huevo de reserva.', 'good'); });
  on('ghost', r => {
    if (!$('intro').hidden || tv.open) return;
    const q = Scene.entityPos('queen'), from = { x: q.x - 120 + Math.random() * 90, y: q.y - 90 - Math.random() * 40 }, sp = Scene.toScreen(from);
    ghostHand(sp.x, sp.y);
    if (r.crit) burst('×' + r.crit, 'Mano fantasma', r.crit >= 5 ? 'x5' : 'x2', sp);
    setTimeout(() => Scene.feedQueen(from, at => float(r.laid ? '+huevo' : '+' + fmt(r.food), at, r.laid ? 'good' : r.crit ? 'lucky' : 'crit')), 250);
  });
  on('harvestLuck', d => {
    const at = Scene.toScreen(d);
    if (d.gold) { burst('×5', 'Comida dorada', 'gold', at); Audio.play('win'); }
    else { burst('×2', 'Cosecha doble', 'harvest', at); Audio.play('skill'); }
  });
  on('lay', d => { if (d.twin) { burst('×2', 'Gemelas', 'x2', Scene.toScreen(Scene.entityPos('egg', d.e.slot))); Audio.play('skill'); } });
  on('evolve', d => { Juice.celebrate('¡Evolución!', d.name, 'evolve'); Audio.play('win'); });
  on('raid', () => { toast('¡Han caído todas! Van a por la reina.', 'warn'); Audio.play('alarm'); });
  on('queenSurvives', () => toast('El nido resiste: la reina sobrevive.', 'good'));
  on('queenDeath', d => {
    Audio.play('retreat'); closeTree();
    $('deathText').textContent = `Generación ${d.gen}. Tu colonia aguantó ${d.level - 1} ${d.level - 1 === 1 ? 'noche' : 'noches'}.`;
    $('deathAdn').textContent = '+' + d.gain;
    setTimeout(() => { $('deathView').hidden = false; }, 1800);
  });
  on('victory', d => {
    Audio.play('win');
    $('winText').textContent = `Los humanos han caído en la generación ${d.gen}, tras ${fmtTime(d.time)} de juego. Ya nada detiene a la colonia: las hormigas conquistan el mundo.`;
    // primero la secuencia del final (la reina sale del nido y la colonia cubre el planeta); luego la pantalla de victoria
    playEnding({ gen: d.gen, time: d.time, onDone: () => { $('winView').hidden = false; } });
  });
}

function away(secs) {
  const r = Game.away(G, secs);
  if (r) toast('Mientras no estabas (' + fmtTime(r.secs) + ') trajeron ' + fmt(r.food) + ' de comida' + (r.born ? ' y nacieron ' + r.born + ' hormigas.' : '.'), 'good');
}

let lastT = 0, lastWall = Date.now(), uiT = 0, saveT = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const now = Date.now(), gap = (now - lastWall) / 1000;
  lastWall = now;
  let dt = Math.min(0.2, (t - lastT) / 1000 || 0);
  lastT = t;
  if (gap > 5) { away(gap); dt = 0; } // la pestaña estuvo dormida
  const n = ui.paused || tv.open ? 0 : ui.speed; // con el árbol abierto el tiempo se detiene
  D = Game.calc(G);
  for (let i = 0; i < n; i++) { bot.step(dt); D = Game.tick(G, dt); Scene.update(G, D, dt, dt, i < n - 1); }
  bot.update(dt);
  if (!n) Scene.update(G, D, 0, dt);
  placeLabels();
  if (tv.open) renderTree(G);
  uiT += dt; if (uiT > 0.25) { uiT = 0; render(G, D); }
  saveT += dt; if (saveT > 10) { saveT = 0; Game.save(G); }
  autoT += dt; if (autoT > 1) { autoT = 0; runAutoBuy(); }
}

async function boot() {
  hydrateIcons();
  const saved = Game.load();
  G = saved || Game.newGame(); D = Game.calc(G);
  const start = $('start'), status = $('loadStatus');
  start.disabled = true;
  try {
    const loaded = await Scene.init($('stage'), p => { status.textContent = 'Cargando modelos… ' + Math.round(p * 100) + '%'; });
    status.textContent = loaded.includes('termite') && loaded.includes('spider') && loaded.includes('beetle') ? '' : 'Algunos enemigos no cargaron: se dibujan a mano.';
  } catch (e) {
    console.error(e, e && (e.message || (e.target && (e.target.src || e.target.currentSrc)) || e.type), e && e.stack);
    $('intro').firstElementChild.innerHTML = '<h1>ANTIGENESIS</h1><p>No se pudo iniciar el juego (WebGL o el fondo no cargaron). Recarga o prueba otro navegador.</p>';
    return;
  }
  wireButtons(); wireGameEvents();
  wireStageInput($('stage'), clickScene);
  start.disabled = false;
  if (saved) { start.textContent = 'Continuar'; away((Date.now() - saved.last) / 1000); if (G.phase === 'dead' && !G.leaving) $('deathView').hidden = false; }
  render(G, D);
  requestAnimationFrame(frame);
  const qs = new URLSearchParams(location.search); // ?bot=1&speed=6 arranca el bot solo
  if (qs.has('bot')) { if (qs.get('profile')) bot.profile = qs.get('profile'); bot.start(qs.get('speed') || 1); } // &profile=promedio|activo|casual
}

boot();

// caché del dispositivo para modelos, mapa e imágenes (public/sw.js): las visitas siguientes no los vuelven a descargar.
// Solo en la versión publicada: en desarrollo, Vite sirve los archivos cambiando y la caché estorbaría.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('[antigenesis] sin caché del dispositivo', e)));
}

// ayuda para depurar desde la consola: __ax.G, __ax.speed = 8
window.__ax = {
  get G() { return G; }, set speed(v) { ui.speed = v; }, Game, Scene, bot, Juice,
  /** Prueba la secuencia final sin ganar: __ax.ending() */
  ending: () => playEnding({ gen: G.gen, time: G.total || 0, onDone: () => { $('winView').hidden = false; } }),
  get free() { return Game.debug.free; }, set free(v) { Game.debug.free = !!v; }
};
