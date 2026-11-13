// Bot que juega EN TIEMPO REAL dentro del juego, como una persona media:
//   · toca a la reina, a la cría y a los enemigos a 2–3 toques/s, bajando según avanza (brain.cpsFor)
//   · compra en el árbol, evoluciona, gasta el linaje y funda colonias (mismo cerebro que tools/sim.mjs)
//   · todo va en tiempo de juego: con la velocidad ×2, ×6, ×20… también toca y decide más rápido
//   · registra cada acción y evento; al terminar da un resumen por colonia (prestigio) y del juego entero
//   · al ganar guarda la partida y empieza otra desde cero (así se miden varias seguidas)
//   · perfiles: promedio, activo o casual (cuánto toca, cada cuánto mira el árbol, cuánto pelea)
//   · para muchas partidas a la vez y sin gráficos: node tools/sim.mjs (mismos perfiles, en paralelo)
//
// Activar: botón «Bot» en Ajustes, tecla B, o abrir el juego con ?bot=1 (y &speed=6 para ir a ×6).
// Consola: __ax.bot.start(), .stop(), .summary(), .download('csv' | 'json')
import * as Game from '../game/index.js';
import * as Brain from '../game/brain.js';
import * as Scene from '../scene/index.js';
import { on } from '../core/events.js';
import { fmtTime } from '../core/format.js';

const $ = id => document.getElementById(id);
const VISUAL_PER_SEC = 8;   // toques con animación y sonido por segundo real (el resto solo cuenta)
const SPEEDS = [1, 2, 4, 6, 10, 20];
/**
 * Perfiles (como los de tools/bot.mjs): cpsK multiplica los toques por segundo de una persona media,
 * buyEvery son los segundos de juego entre vistazos al árbol y foe la parte de los toques nocturnos que van a los enemigos.
 */
export const BOT_PROFILES = {
  promedio: { name: 'Promedio', cpsK: 1, buyEvery: 3, foe: 0.4 },
  activo: { name: 'Activo', cpsK: 1.35, buyEvery: 2, foe: 0.6 },
  casual: { name: 'Casual', cpsK: 0.5, buyEvery: 12, foe: 0.15 }
};

/**
 * api (la pone main.js): getG(), tap(hit, visual), buy(tree, id) → bool, leave() → bool, found() → bool,
 * getSpeed(), setSpeed(n)
 */
export function createBot(api) {
  const bot = {
    on: false, log: [], colonies: [], cur: null, done: null, runs: [], run0: { game: 0, real: 0 },
    profile: 'promedio', cps: 0, clicks: 0, buys: 0, t0: 0,
    start, stop, toggle, step, update, summary, download, panel: togglePanel
  };
  const tapper = Brain.makeTapper(); // ráfagas cortas y pausas, como una persona
  let aim = 'queen', aimId = null, pending = 0, buyT = 0, cpsT = 0, visualTokens = VISUAL_PER_SEC, deadReal = 0, lastWait = null, panelOn = false, panelT = 0;

  const realS = () => (performance.now() - bot.t0) / 1000;
  function rec(act, target = '', detail = '') {
    const G = api.getG();
    bot.log.push({
      real_s: +realS().toFixed(2), game_s: +(G.total || 0).toFixed(2), speed: api.getSpeed(), gen: G.gen, night: G.level, phase: G.phase,
      act, target, detail, jelly: Math.floor(G.jelly), bio: G.bio, adn: G.adn, ants: G.ants, cps: +bot.cps.toFixed(2)
    });
  }

  /* ---------- colonias (prestigios) ---------- */
  function openColony() {
    const G = api.getG();
    bot.cur = { gen: G.gen, gameStart: G.total || 0, realStart: realS(), clicks: 0, buys: 0, startNight: G.level };
  }
  function closeColony(cause) {
    const G = api.getG(), c = bot.cur;
    if (!c) return;
    Object.assign(c, { cause, night: G.level, adn: G.pendingAdn || 0, gameS: (G.total || 0) - c.gameStart, realS: realS() - c.realStart, evo: G.evo || 0 });
    bot.colonies.push(c); bot.cur = null;
    rec('fin_colonia', 'gen ' + c.gen, `${cause} en la noche ${c.night}, ${fmtTime(c.gameS)} de juego, ${fmtTime(c.realS)} reales, +${c.adn} ADN`);
    persist();
  }

  /* ---------- eventos del juego (para el registro) ---------- */
  on('night', d => bot.on && rec('evento', 'noche', `noche ${d.def.n}: ${d.def.text}`));
  on('nightWin', d => bot.on && rec('evento', 'noche_ganada', `noche ${d.level}, bajas ${d.lost}, premio ${Math.round(d.prize)}`));
  on('nightLost', d => bot.on && rec('evento', 'noche_perdida', `bajas ${d.lost}`));
  on('born', d => bot.on && rec('evento', 'nace', d.shiny ? 'dorada' : ''));
  on('stage', d => bot.on && rec('evento', 'reina_crece', d.stage.name));
  on('goal', d => bot.on && rec('evento', 'objetivo', d.text));
  on('queenDeath', d => { if (!bot.on) return; rec('evento', 'reina_muere', `generación ${d.gen}, +${d.gain} ADN`); closeColony('murió'); deadReal = 0; });
  on('victory', d => {
    if (!bot.on) return;
    rec('evento', 'victoria', `generación ${d.gen}, ${fmtTime(d.time)} de juego`);
    closeColony('ganó');
    bot.done = { gameS: d.time, realS: realS(), gen: d.gen };
    // partida terminada: se apunta y se empieza otra desde cero con el mismo perfil
    bot.runs.push({ n: bot.runs.length + 1, profile: bot.profile, gameS: d.time, realS: realS() - bot.run0.real, gens: d.gen, colonies: bot.colonies.length });
    console.info(summary().text);
    persist();
    setTimeout(() => {
      if (!bot.on) return;
      api.newGame();
      bot.colonies = []; bot.cur = null; bot.done = null; bot.run0 = { game: 0, real: realS() };
      openColony();
      rec('bot', 'nueva_partida', 'partida ' + (bot.runs.length + 1) + ' · perfil ' + bot.profile);
      renderPanel(true);
    }, 1500);
  });

  /* ---------- control ---------- */
  function start(speed) {
    if (bot.on) return;
    bot.on = true; bot.log = []; bot.colonies = []; bot.done = null; bot.clicks = 0; bot.buys = 0; bot.t0 = performance.now();
    bot.runs = []; bot.run0 = { game: 0, real: 0 };
    if (speed) api.setSpeed(+speed);
    if ($('intro') && !$('intro').hidden) $('start').click();
    openColony();
    rec('bot', 'inicio', `velocidad ×${api.getSpeed()}`);
    console.info('[bot] en marcha. __ax.bot.summary() para ver el resumen, __ax.bot.download() para el registro.');
    togglePanel(true);
  }
  function stop(reason = 'parado') {
    if (!bot.on) return;
    rec('bot', 'fin', reason);
    bot.on = false; persist(); renderPanel(true);
  }
  function toggle() { bot.on ? stop() : start(); }

  /* ---------- un paso de juego (se llama en cada tick, también con ×N) ---------- */
  function step(dt) {
    if (!bot.on || dt <= 0) return;
    const G = api.getG();
    if (G.phase === 'dead') return;
    if (!bot.cur) openColony();
    const colT = (G.total || 0) - bot.cur.gameStart;

    const P = BOT_PROFILES[bot.profile] || BOT_PROFILES.promedio;
    if ((cpsT -= dt) <= 0) { cpsT = 5; bot.cps = Brain.cpsFor(G, colT) * P.cpsK; }
    // ráfagas sobre una misma cosa y pausas (brain.makeTapper); un toque por paso como mucho: nunca varios a la vez
    pending = Math.min(3, pending + tapper.step(dt, bot.cps));
    if (tapper.fresh) {
      aim = G.foes && G.foes.arrive <= 0 && Math.random() < P.foe ? 'enemy' : (G.larvae[0] || G.eggs[0]) && Math.random() < 0.5 ? 'brood' : 'queen';
      aimId = aim === 'brood' ? (G.larvae[0] || G.eggs[0]).id : null; // toda la ráfaga sobre el mismo huevo o larva
    }
    if (pending >= 1) { pending--; tapOnce(G, aim); if (G.phase === 'dead') return; }

    if ((buyT += dt) >= P.buyEvery) { buyT = 0; think(G); }
  }

  /** Un toque al objetivo de la ráfaga actual: 'enemy', 'brood' (la cría más avanzada) o 'queen'. */
  function tapOnce(G, aim) {
    const visual = visualTokens >= 1;
    if (visual) visualTokens--;
    bot.clicks++; bot.cur.clicks++;
    if (aim === 'enemy' && G.foes && G.foes.arrive <= 0) {
      api.tap({ kind: 'enemy', pos: Scene.entityPos('enemy') }, visual);
      rec('toque', 'enemigo'); return;
    }
    // el de la ráfaga; si ya nació, el siguiente más avanzado
    let target = aimId != null && (G.larvae.find(e => e.id === aimId) || G.eggs.find(e => e.id === aimId));
    if (!target) { target = G.larvae[0] || G.eggs[0]; aimId = target ? target.id : null; }
    if (aim === 'brood' && target) {
      const kind = G.larvae.includes(target) ? 'larva' : 'egg';
      api.tap({ kind, id: target.id, slot: target.slot, pos: Scene.entityPos(kind, target.slot) }, visual);
      rec('toque', kind === 'egg' ? 'huevo' : 'larva', `${Math.round(target.p * 100)}%`);
    } else {
      const q = Scene.entityPos('queen'), click = { x: q.x - 60 + (Math.random() - 0.5) * 120, y: q.y - 40 + (Math.random() - 0.5) * 50 };
      api.tap({ kind: 'queen', pos: q, click }, visual);
      rec('toque', 'reina');
    }
  }

  /** Mira el árbol y compra; luego decide si fundar antes de una noche perdida. */
  function think(G) {
    for (let n = 0; n < 20; n++) {
      const D = Game.calc(G), pick = Brain.pickSmart(G, 'skills', { cps: bot.cps, warW: Brain.warWeight(G), income: Game.forageRate(G, D) / 2 });
      if (!pick) break;
      if (pick.wait) { if (lastWait !== pick.wait) { lastWait = pick.wait; rec('ahorra', pick.wait, `${Game.SKILLS[pick.wait].name} · ${pick.why}`); } break; }
      const c = Game.nodeCost(G, 'skills', pick.id);
      if (!api.buy('skills', pick.id)) break;
      lastWait = null; bot.buys++; bot.cur.buys++;
      rec('compra', pick.id, `${Game.SKILLS[pick.id].name} · ${Math.round(c.n)} ${c.cur} · ${pick.why}`);
    }
    if (Brain.shouldFound(G)) {
      const gain = Game.legacy(G).gain;
      if (api.leave()) { rec('funda', 'princesa', `antes de una noche perdida, +${gain} ADN`); closeColony('fundó'); deadReal = 0; }
    }
  }

  /* ---------- cada fotograma, en tiempo real ---------- */
  function update(realDt) {
    visualTokens = Math.min(VISUAL_PER_SEC, visualTokens + realDt * VISUAL_PER_SEC);
    if ((panelT += realDt) > 0.5) { panelT = 0; renderPanel(); }
    if (!bot.on) return;
    if ($('intro') && !$('intro').hidden && !$('start').disabled) $('start').click();
    const G = api.getG();
    if (G.phase !== 'dead') return;
    // la reina ha caído (o la princesa se va): espera a que salga la pantalla, gasta el ADN y funda
    deadReal += realDt;
    if (deadReal < 2.2) return;
    deadReal = 0;
    if ($('deathView')) $('deathView').hidden = true;
    while (Game.canEvolve(G)) { const i = (G.evo || 0) + 1, cost = Game.evoCost(i); if (!api.buy('evo')) break; rec('evoluciona', Game.EVOS[i].name, `${cost} ADN`); }
    if (Brain.saveForEvo(G)) rec('ahorra', 'evolución', `guarda ${G.adn} ADN para ${Game.EVOS[(G.evo || 0) + 1].name}`);
    else for (let n = 0; n < 40; n++) {
      const pick = Brain.pickSmart(G, 'perm', { cps: bot.cps });
      if (!pick || !pick.id) break;
      const c = Game.nodeCost(G, 'perm', pick.id);
      if (!api.buy('perm', pick.id)) break;
      rec('linaje', pick.id, `${Game.PERKS[pick.id].name} · ${c.n} ADN`);
    }
    if (api.found()) { openColony(); rec('nueva_colonia', 'gen ' + api.getG().gen, `empieza con ${api.getG().ants} hormigas`); }
  }

  /* ---------- resumen y registro ---------- */
  function summary() {
    const G = api.getG(), cols = bot.colonies.map(c => ({
      gen: c.gen, resultado: c.cause, noche: c.night, juego: fmtTime(c.gameS), real: fmtTime(c.realS), juego_s: Math.round(c.gameS), real_s: Math.round(c.realS),
      ADN: c.adn, evo: c.evo, toques: c.clicks, compras: c.buys
    }));
    const gameS = bot.done ? bot.done.gameS : (G.total || 0), rs = bot.done ? bot.done.realS : realS();
    const lines = [
      `ANTIGENESIS · resumen del bot`,
      bot.done ? `Juego superado en la generación ${bot.done.gen}: ${fmtTime(gameS)} de juego, ${fmtTime(rs)} reales.` : `Sin terminar: generación ${G.gen}, noche ${G.level}, ${fmtTime(gameS)} de juego, ${fmtTime(rs)} reales.`,
      `Toques: ${bot.clicks} · compras: ${bot.buys} · colonias: ${bot.colonies.length} · perfil: ${bot.profile}`,
      ...(bot.runs.length ? ['', 'Partidas completadas:', ...bot.runs.map(r => '  ' + r.n + '. ' + r.profile + ': ' + fmtTime(r.gameS) + ' de juego, ' + fmtTime(r.realS) + ' reales, ' + r.gens + ' generaciones')] : []),
      '', 'gen  resultado  noche  tiempo de juego  tiempo real  ADN',
      ...bot.colonies.map(c => `${String(c.gen).padStart(3)}  ${c.cause.padEnd(9)}  ${String(c.night).padStart(5)}  ${fmtTime(c.gameS).padStart(15)}  ${fmtTime(c.realS).padStart(11)}  +${c.adn}`)
    ];
    return { done: !!bot.done, profile: bot.profile, runs: bot.runs, gameS, realS: rs, clicks: bot.clicks, buys: bot.buys, colonies: cols, text: lines.join('\n') };
  }

  function download(kind = 'csv') {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    let body, type;
    if (kind === 'json') { body = JSON.stringify({ summary: summary(), log: bot.log }, null, 1); type = 'application/json'; }
    else if (kind === 'txt') { body = summary().text; type = 'text/plain'; }
    else {
      const cols = ['real_s', 'game_s', 'speed', 'gen', 'night', 'phase', 'act', 'target', 'detail', 'jelly', 'bio', 'adn', 'ants', 'cps'];
      const esc = v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      body = [cols.join(','), ...bot.log.map(r => cols.map(c => esc(r[c])).join(','))].join('\n'); type = 'text/csv';
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type }));
    a.download = `antigenesis-bot-${stamp}.${kind}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /** Guarda el resumen de colonias (el registro entero puede no caber en localStorage). */
  function persist() {
    try { localStorage.setItem('antigenesis.bot.last', JSON.stringify({ at: Date.now(), summary: summary() })); } catch (e) { /* lleno o bloqueado */ }
  }

  /* ---------- panel ---------- */
  function togglePanel(force) {
    panelOn = force ?? !panelOn;
    let p = $('botPanel');
    if (!p) {
      p = document.createElement('div'); p.id = 'botPanel'; p.className = 'panel';
      p.addEventListener('click', e => {
        const b = e.target.closest('[data-bot]'); if (!b) return;
        const a = b.dataset.bot;
        if (a === 'toggle') toggle();
        else if (a === 'speed') api.setSpeed(+b.dataset.v);
        else if (a === 'profile') bot.profile = b.dataset.v;
        else if (a === 'close') togglePanel(false);
        else download(a);
        renderPanel(true);
      });
      $('app').appendChild(p);
    }
    p.hidden = !panelOn;
    renderPanel(true);
  }

  let lastHtml = '';
  function renderPanel(force) {
    const p = $('botPanel');
    if (!p || p.hidden) return;
    const G = api.getG(), sp = api.getSpeed(), s = summary();
    const colGame = bot.cur ? (G.total || 0) - bot.cur.gameStart : 0;
    const rows = bot.colonies.slice(-6).map(c => `<tr><td>${c.gen}</td><td>${c.cause}</td><td>N${c.night}</td><td>${fmtTime(c.gameS)}</td><td>${fmtTime(c.realS)}</td></tr>`).join('');
    const html = `<div class="bp-head"><b>Bot</b><span class="${bot.on ? 'on' : ''}">${bot.on ? '● jugando' : bot.done ? '✔ terminado' : '○ parado'}</span><button data-bot="close" aria-label="Cerrar">×</button></div>
      <div class="bp-row"><button class="btn-plain${bot.on ? ' on' : ''}" data-bot="toggle">${bot.on ? 'Parar' : 'Empezar'}</button>
        ${SPEEDS.map(v => `<button class="btn-plain sm${sp === v ? ' on' : ''}" data-bot="speed" data-v="${v}">×${v}</button>`).join('')}</div>
      <div class="bp-row">${Object.entries(BOT_PROFILES).map(([k, p]) => '<button class="btn-plain sm' + (bot.profile === k ? ' on' : '') + '" data-bot="profile" data-v="' + k + '">' + p.name + '</button>').join('')}</div>
      ${bot.runs.length ? '<div class="bp-stats">Partidas: ' + bot.runs.map(r => r.n + ') ' + fmtTime(r.gameS)).join(' · ') + '</div>' : ''}
      <div class="bp-stats">${bot.cps.toFixed(1)} toques/s · ${s.clicks} toques · ${s.buys} compras<br>
        Colonia ${G.gen}: noche ${G.level} · ${fmtTime(colGame)}<br>Total: ${fmtTime(s.gameS)} de juego · ${fmtTime(s.realS)} reales</div>
      ${rows ? `<table><tr><th>gen</th><th></th><th>noche</th><th>juego</th><th>real</th></tr>${rows}</table>` : ''}
      <div class="bp-row"><button class="btn-plain sm" data-bot="csv">Registro CSV</button><button class="btn-plain sm" data-bot="json">JSON</button><button class="btn-plain sm" data-bot="txt">Resumen</button></div>`;
    if (force || html !== lastHtml) { lastHtml = html; p.innerHTML = html; }
  }

  return bot;
}
