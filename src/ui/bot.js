// Bot que juega EN TIEMPO REAL dentro del juego:
//   · toca a la reina, a la cría y a los enemigos según su perfil de TOQUES (persona media, casual, 5, 7 o 9 por segundo)
//   · compra en el árbol y en el linaje según su perfil de ESTRATEGIA (toques, hormigas, reina, daño, equilibrado
//     o inteligente), evoluciona y funda colonias (mismo cerebro que tools/sim.mjs: src/game/brain.js)
//   · los dos perfiles se eligen por separado en el panel (y se pueden cambiar jugando: queda apuntado)
//   · todo va en tiempo de juego: con la velocidad ×2, ×6, ×20, ×40, ×60… también toca y decide más rápido
//   · al ganar cierra la partida y empieza otra desde cero; cada partida guarda su registro, sus colonias y sus perfiles
//   · el JSON trae todas las partidas, cada una por separado, y un resumen por bot (combinación de perfiles)
//   · para muchas partidas a la vez y sin gráficos: node tools/sim.mjs --clicks=c9 --room=inteligente
//
// Activar: botón «Bot» en Ajustes, tecla B, o abrir el juego con ?bot=1 (&speed=6 &clicks=c9 &room=toques).
// Consola: __ax.bot.start(), .stop(), .summary(), .download('csv' | 'json' | 'txt')
import * as Game from '../game/index.js';
import * as Brain from '../game/brain.js';
import * as Scene from '../scene/index.js';
import { on } from '../core/events.js';
import { fmtTime } from '../core/format.js';

const $ = id => document.getElementById(id);
const VISUAL_PER_SEC = 8;   // toques con animación y sonido por segundo real (el resto solo cuenta)
const TAP_ROW_S = 10;       // los toques se apuntan juntos: una fila del registro cada 10 s de juego
const HITOS = [4, 8, 12, 16, 20, 24, 25]; // noches que se apuntan en el resumen (minuto en que se llega)
const CAT = { food: 'recol', war: 'guerra', tap: 'toques', brood: 'cría' };
const SPEEDS = [1, 2, 4, 6, 10, 20, 40, 60];
const { CLICK_PROFILES, ROOM_PROFILES } = Brain;
// perfiles de antes (?profile=…): cuánto tocaban
const OLD = { promedio: 'humano', activo: 'c5', casual: 'casual' };
const botName = (c, r) => `${CLICK_PROFILES[c]?.name || c} · ${ROOM_PROFILES[r]?.name || r}`;

/**
 * api (la pone main.js): getG(), tap(hit, visual), buy(tree, id) → bool, leave() → bool, found() → bool,
 * getSpeed(), setSpeed(n), newGame()
 */
export function createBot(api) {
  const bot = {
    on: false, clickProfile: 'humano', room: 'inteligente', cps: 0,
    games: [],   // partidas terminadas (o paradas), cada una con su registro
    game: null,  // la partida en curso
    start, stop, toggle, step, update, summary, download, clear, panel: togglePanel,
    get profile() { return bot.clickProfile; }, set profile(v) { setClicks(OLD[v] || v); }
  };
  const tapper = Brain.makeTapper(); // ráfagas cortas y pausas, como una persona (o ritmo fijo)
  let aim = 'queen', aimId = null, pending = 0, buyT = 0, cpsT = 0, visualTokens = VISUAL_PER_SEC, deadReal = 0, lastWait = null, panelOn = false, panelT = 0;
  let t0 = performance.now(), tapAgg = {}, tapAggT = 0, thinkReal = 0;
  // sin tocar: busy s de juego (en el Árbol o moviendo el dedo); inTree: al acabar la espera, compra
  let busy = 0, inTree = false, lastTap = -Infinity;

  const realS = () => (performance.now() - t0) / 1000;
  const cur = () => bot.game && bot.game.cur;
  function rec(act, target = '', detail = '') {
    const G = api.getG(), g = bot.game;
    if (!g) return;
    g.log.push({
      real_s: +(realS() - g.realStart).toFixed(2), game_s: +(G.total || 0).toFixed(2), speed: api.getSpeed(), gen: G.gen, night: G.level, phase: G.phase,
      act, target, detail, jelly: Math.floor(G.jelly), bio: G.bio, adn: G.adn, ants: G.ants, cps: +bot.cps.toFixed(2),
      clicks: bot.clickProfile, room: bot.room
    });
  }
  /** Apunta los toques acumulados en una sola fila («reina 42 · huevo 10»). */
  function flushTaps() {
    const parts = Object.entries(tapAgg).filter(([, n]) => n > 0);
    if (parts.length) rec('toques', String(parts.reduce((s, [, n]) => s + n, 0)), parts.map(([k, n]) => `${k} ${n}`).join(' · '));
    tapAgg = {}; tapAggT = 0;
  }

  /* ---------- partidas ---------- */
  function openGame(note) {
    const G = api.getG();
    bot.game = {
      n: bot.games.length + 1, clicks: bot.clickProfile, room: bot.room, bot: botName(bot.clickProfile, bot.room),
      changes: [], date: new Date().toISOString(), fromScratch: (G.total || 0) < 1 && (G.gen || 1) === 1,
      realStart: realS(), gameStart: G.total || 0, startGen: G.gen, startNight: G.level,
      result: 'en curso', clicksN: 0, buys: 0, colonies: [], cur: null, log: [],
      hitos: {}, lin: [], evos: [], debug: !!Game.debug.free // para el resumen: noche a la que se llega, linaje y evoluciones con su minuto
    };
    openColony();
    rec('bot', 'nueva_partida', `partida ${bot.game.n} · ${bot.game.bot}${note ? ' · ' + note : ''}`);
  }
  function closeGame(result, d) {
    const g = bot.game, G = api.getG();
    if (!g) return;
    flushTaps();
    if (g.cur) closeColony(result === 'ganó' ? 'ganó' : 'sin terminar');
    Object.assign(g, {
      result, gameS: d ? d.time - g.gameStart : (G.total || 0) - g.gameStart, realS: realS() - g.realStart,
      gens: d ? d.gen : G.gen, night: G.level, best: G.best || 0, evo: G.evo || 0
    });
    // si cambiaste de perfil jugando, la partida lleva los dos nombres (y cuenta aparte en el resumen por bot)
    if (g.changes.length) { g.endClicks = bot.clickProfile; g.endRoom = bot.room; g.bot += ' → ' + botName(bot.clickProfile, bot.room); }
    bot.games.push(g); bot.game = null;
    persist();
  }

  /* ---------- colonias (prestigios) ---------- */
  function openColony() {
    const G = api.getG();
    bot.game.cur = { gen: G.gen, gameStart: G.total || 0, realStart: realS(), clicks: 0, buys: 0, startNight: G.level,
      cats: {}, won: 0, lost: 0, maxCombo: 0, visits: 0, drops: 0, born: 0 };
  }
  function closeColony(cause) {
    const G = api.getG(), c = cur();
    if (!c) return;
    flushTaps();
    Object.assign(c, { cause, night: G.level, adn: G.pendingAdn || 0, gameS: (G.total || 0) - c.gameStart, realS: realS() - c.realStart, evo: G.evo || 0 });
    bot.game.colonies.push(c); bot.game.cur = null;
    rec('fin_colonia', 'gen ' + c.gen, `${cause} en la noche ${c.night}, ${fmtTime(c.gameS)} de juego, ${fmtTime(c.realS)} reales, +${c.adn} ADN`);
    persist();
  }

  /* ---------- eventos del juego (para el registro) ---------- */
  on('night', d => bot.on && rec('evento', 'noche', `noche ${d.def.n}: ${d.def.text}`));
  on('nightWin', d => { if (!bot.on) return; if (cur()) cur().won++; rec('evento', 'noche_ganada', `noche ${d.level}, bajas ${d.lost}, premio ${Math.round(d.prize)}`); });
  on('nightLost', d => { if (!bot.on) return; if (cur()) cur().lost++; rec('evento', 'noche_perdida', `bajas ${d.lost}`); });
  on('born', d => { if (!bot.on) return; if (cur()) cur().born++; rec('evento', 'nace', d.shiny ? 'dorada' : ''); });
  on('stage', d => bot.on && rec('evento', 'reina_crece', d.stage.name));
  on('goal', d => bot.on && rec('evento', 'objetivo', d.text));
  on('queenDeath', d => { if (!bot.on) return; rec('evento', 'reina_muere', `generación ${d.gen}, +${d.gain} ADN`); closeColony('murió'); deadReal = 0; });
  on('victory', d => {
    if (!bot.on || !bot.game) return;
    rec('evento', 'victoria', `generación ${d.gen}, ${fmtTime(d.time)} de juego`);
    closeGame('ganó', d);
    console.info(summary().text);
    // partida terminada: se empieza otra desde cero con los perfiles que estén elegidos
    setTimeout(() => {
      if (!bot.on) return;
      api.newGame();
      openGame();
      renderPanel(true);
    }, 1500);
  });

  /* ---------- perfiles ---------- */
  function setClicks(k) {
    if (!CLICK_PROFILES[k] || k === bot.clickProfile) return;
    bot.clickProfile = k; cpsT = 0;
    if (bot.game) { bot.game.changes.push({ game_s: +(api.getG().total || 0).toFixed(1), clicks: k }); rec('bot', 'perfil_toques', CLICK_PROFILES[k].name); }
  }
  function setRoom(k) {
    if (!ROOM_PROFILES[k] || k === bot.room) return;
    bot.room = k; lastWait = null;
    if (bot.game) { bot.game.changes.push({ game_s: +(api.getG().total || 0).toFixed(1), room: k }); rec('bot', 'perfil_estrategia', ROOM_PROFILES[k].name); }
  }

  /* ---------- control ---------- */
  function start(speed) {
    if (bot.on) return;
    bot.on = true;
    if (!CLICK_PROFILES[bot.clickProfile]) bot.clickProfile = OLD[bot.clickProfile] || 'humano';
    if (!ROOM_PROFILES[bot.room]) bot.room = 'inteligente';
    if (speed) api.setSpeed(+speed);
    if ($('intro') && !$('intro').hidden) $('start').click();
    const wasDebug = Game.debug.free;
    if (wasDebug) Game.debug.free = false; // con compras gratis las partidas no sirven para medir nada
    openGame(`velocidad ×${api.getSpeed()}${wasDebug ? ' · modo debug apagado' : ''}`);
    if (wasDebug) console.warn('[bot] el modo debug (jalea, biomasa y ADN infinitos) estaba encendido: lo he apagado.');
    console.info('[bot] en marcha. __ax.bot.summary() para ver el resumen, __ax.bot.download("json") para el registro.');
    togglePanel(true);
  }
  function stop(reason = 'parado') {
    if (!bot.on) return;
    rec('bot', 'fin', reason);
    bot.on = false;
    closeGame('parado'); // la partida sin terminar también queda guardada (con su registro)
    renderPanel(true);
  }
  function toggle() { bot.on ? stop() : start(); }
  /**
   * Borra todos los registros: las partidas guardadas, el resumen del navegador y lo apuntado de la partida en curso
   * (si el bot está jugando, sigue con esa partida pero su registro empieza de nuevo desde aquí).
   */
  function clear() {
    if (!confirm('¿Borrar todos los registros del bot?')) return;
    bot.games = []; tapAgg = {}; tapAggT = 0;
    try { localStorage.removeItem('antigenesis.bot.last'); } catch (e) { /* bloqueado */ }
    if (bot.game) openGame('registros borrados');
    renderPanel(true);
  }

  /* ---------- un paso de juego (se llama en cada tick, también con ×N) ---------- */
  function step(dt) {
    if (!bot.on || dt <= 0 || !bot.game) return;
    const G = api.getG();
    if (G.phase === 'dead') return;
    if (!cur()) openColony();
    const g = bot.game, mins = Math.round(((G.total || 0) - g.gameStart) / 60);
    if (Game.debug.free && !g.debug) { g.debug = true; rec('bot', 'debug', 'modo debug encendido: esta partida no vale para medir'); }
    for (const m of HITOS) if (g.hitos['N' + m] == null && G.level >= m) g.hitos['N' + m] = mins;
    const colT = (G.total || 0) - cur().gameStart;
    const CP = CLICK_PROFILES[bot.clickProfile], steady = CP.cps !== 'curva';
    if ((cpsT -= dt) <= 0) { cpsT = 5; bot.cps = Brain.profileCps(CP, G, colT); }
    if ((tapAggT += dt) >= TAP_ROW_S) flushTaps();
    // en el Árbol o moviendo el dedo: no toca
    if (busy > 0) {
      busy -= dt;
      if (busy > 0) return;
      if (inTree) { inTree = false; visitTree(G); if (busy > 0) return; }
    }
    // ráfagas sobre una misma cosa y pausas (o ritmo fijo); si el fotograma fue largo, hasta 3 toques seguidos
    pending = Math.min(3, pending + tapper.step(dt, bot.cps, steady));
    if (tapper.fresh) {
      const prev = aim;
      aim = G.foes && G.foes.arrive <= 0 && Math.random() < CP.foe ? 'enemy' : (G.larvae[0] || G.eggs[0]) && Math.random() < 0.5 ? 'brood' : 'queen';
      aimId = aim === 'brood' ? (G.larvae[0] || G.eggs[0]).id : null; // toda la ráfaga sobre el mismo huevo o larva
      // cambiar de objetivo lleva un momento (ir hasta los enemigos y volver, más): la racha puede caer
      busy = Brain.travelTime(prev, aim);
      if (busy > 0) { pending = 0; return; }
    }
    while (pending >= 1) { pending--; tapOnce(G, aim); if (G.phase === 'dead') return; }

    // vistazo al árbol cada buyEvery s de juego, y como mucho 10 por segundo real (a ×60, uno cada 6 s de juego: no frena el juego)
    if ((buyT += dt) >= CP.buyEvery && realS() - thinkReal >= 0.1) { buyT = 0; thinkReal = realS(); think(G); }
  }

  /**
   * La racha se mide en reloj real (G.clock): a ×20, una pausa de 1 s de juego son 0,05 s de reloj y nunca la
   * cortaría. El bot juega «como a ×1»: si desde su último toque han pasado más de comboGap s DE JUEGO, la corta él.
   */
  function gapCheck(G) {
    const gap = (G.total || 0) - lastTap;
    lastTap = G.total || 0;
    if (!G.comboLive || gap <= Game.BAL.comboGap) return;
    const D = Game.calc(G);
    if (gap > D.comboGap) { const n = G.combo; Game.comboDrop(G, D); cur().drops++; rec('racha', 'se pierde', `${n} toques: ${gap.toFixed(2)} s sin tocar`); }
  }

  /** Un toque al objetivo de la ráfaga actual: 'enemy', 'brood' (la cría más avanzada) o 'queen'. */
  function tapOnce(G, aim) {
    gapCheck(G);
    const visual = visualTokens >= 1;
    if (visual) visualTokens--;
    bot.game.clicksN++; cur().clicks++;
    if ((G.combo || 0) > cur().maxCombo) cur().maxCombo = G.combo;
    const count = k => { tapAgg[k] = (tapAgg[k] || 0) + 1; };
    if (aim === 'enemy' && G.foes && G.foes.arrive <= 0) {
      api.tap({ kind: 'enemy', pos: Scene.entityPos('enemy') }, visual);
      count('enemigo'); return;
    }
    // el de la ráfaga; si ya nació, el siguiente más avanzado
    let target = aimId != null && (G.larvae.find(e => e.id === aimId) || G.eggs.find(e => e.id === aimId));
    if (!target) { target = G.larvae[0] || G.eggs[0]; aimId = target ? target.id : null; }
    if (aim === 'brood' && target) {
      const kind = G.larvae.includes(target) ? 'larva' : 'egg';
      api.tap({ kind, id: target.id, slot: target.slot, pos: Scene.entityPos(kind, target.slot) }, visual);
      count(kind === 'egg' ? 'huevo' : 'larva');
    } else {
      const q = Scene.entityPos('queen'), click = { x: q.x - 60 + (Math.random() - 0.5) * 120, y: q.y - 40 + (Math.random() - 0.5) * 50 };
      api.tap({ kind: 'queen', pos: q, click }, visual);
      count('reina');
    }
  }

  const buyOpts = () => ({ cps: bot.cps, streak: Brain.profileStreak(CLICK_PROFILES[bot.clickProfile], bot.cps) });

  /**
   * ¿Hay algo que comprar? Entonces deja de tocar y entra en el Árbol (la racha se pierde: queda lo que guarden
   * «Racha tenaz» / «Racha blindada»), espera medio segundo y compra (visitTree). Luego decide si fundar.
   */
  function think(G) {
    const D = Game.calc(G), pick = Brain.pickRoom(G, 'skills', bot.room, { ...buyOpts(), income: Game.forageRate(G, D) / 2 });
    if (pick && pick.wait && lastWait !== pick.wait) { lastWait = pick.wait; rec('ahorra', pick.wait, `${Game.SKILLS[pick.wait].name} · ${pick.why}`); }
    if (pick && pick.id) {
      const n = G.combo || 0, live = G.comboLive;
      cur().visits++; if (live) cur().drops++;
      Game.comboDrop(G, D);
      inTree = true; busy = Brain.BOT_TIME.tree; pending = 0;
      rec('arbol', 'entra', live ? `pierde la racha de ${n} (queda ${G.combo || 0})` : 'sin racha');
      return;
    }
    if (Brain.shouldFound(G)) {
      const gain = Game.legacy(G).gain;
      if (api.leave()) { rec('funda', 'princesa', `antes de una noche perdida, +${gain} ADN`); closeColony('fundó'); deadReal = 0; }
    }
  }

  /** Dentro del Árbol (tras el medio segundo): compra lo que toque; cada compra más, otro momento sin tocar. */
  function visitTree(G) {
    let bought = 0;
    for (let n = 0; n < 20; n++) {
      const D = Game.calc(G), pick = Brain.pickRoom(G, 'skills', bot.room, { ...buyOpts(), income: Game.forageRate(G, D) / 2 });
      if (!pick) break;
      if (pick.wait) { if (lastWait !== pick.wait) { lastWait = pick.wait; rec('ahorra', pick.wait, `${Game.SKILLS[pick.wait].name} · ${pick.why}`); } break; }
      const c = Game.nodeCost(G, 'skills', pick.id);
      if (!api.buy('skills', pick.id)) break;
      lastWait = null; bot.game.buys++; cur().buys++; bought++;
      const cat = CAT[Game.SKILLS[pick.id].cat] || Game.SKILLS[pick.id].cat; cur().cats[cat] = (cur().cats[cat] || 0) + 1;
      rec('compra', pick.id, `${Game.SKILLS[pick.id].name} · ${Math.round(c.n)} ${c.cur} · ${pick.why}`);
    }
    // cada compra más lleva su momento, y luego vuelve a la reina
    busy = Brain.BOT_TIME.perBuy * Math.max(0, bought - 1) + Brain.travelTime('tree', aim);
    pending = 0; lastTap = G.total || 0; // la racha ya se cortó al entrar
  }

  /* ---------- cada fotograma, en tiempo real ---------- */
  function update(realDt) {
    visualTokens = Math.min(VISUAL_PER_SEC, visualTokens + realDt * VISUAL_PER_SEC);
    if ((panelT += realDt) > 0.5) { panelT = 0; renderPanel(); }
    if (!bot.on || !bot.game) return;
    if ($('intro') && !$('intro').hidden && !$('start').disabled) $('start').click();
    const G = api.getG();
    if (G.phase !== 'dead') return;
    // la reina ha caído (o la princesa se va): espera a que salga la pantalla, gasta el ADN y funda
    deadReal += realDt;
    if (deadReal < 2.2) return;
    deadReal = 0;
    if ($('deathView')) $('deathView').hidden = true;
    while (Game.canEvolve(G)) { const i = (G.evo || 0) + 1, cost = Game.evoCost(i); if (!api.buy('evo')) break; bot.game.evos.push(Game.EVOS[i].name + '@' + gmin(G)); rec('evoluciona', Game.EVOS[i].name, `${cost} ADN`); }
    if (Brain.saveForEvo(G)) rec('ahorra', 'evolución', `guarda ${G.adn} ADN para ${Game.EVOS[(G.evo || 0) + 1].name}`);
    else for (let n = 0; n < 40; n++) {
      const pick = Brain.pickRoom(G, 'perm', bot.room, buyOpts());
      if (!pick || !pick.id) break;
      const c = Game.nodeCost(G, 'perm', pick.id);
      if (!api.buy('perm', pick.id)) break;
      bot.game.lin.push(pick.id + '@' + gmin(G));
      rec('linaje', pick.id, `${Game.PERKS[pick.id].name} · ${c.n} ADN · ${pick.why}`);
    }
    if (api.found()) { openColony(); rec('nueva_colonia', 'gen ' + api.getG().gen, `empieza con ${api.getG().ants} hormigas`); }
  }

  /* ---------- resumen y registro ---------- */
  // El JSON es un RESUMEN para analizar (una línea por colonia); el detalle de cada acción va en el CSV.
  const gmin = G => Math.round(((G.total || 0) - (bot.game ? bot.game.gameStart : 0)) / 60);
  const r1 = v => Math.round(v * 10) / 10;
  /** Una colonia en una línea: «g3 fundó N12 14m +38ADN evo2 | 6.8 t/s racha 640 (perdió 9, árbol 31) | 44 compras: toques 20 guerra 12 … | noches 11/0 | 57 nacen». */
  const colonyLine = c => {
    const cats = Object.entries(c.cats || {}).sort((x, y) => y[1] - x[1]).map(([k, n]) => k + ' ' + n).join(' ');
    return `g${c.gen} ${c.cause} N${c.night} ${Math.round(c.gameS / 60)}m +${c.adn}ADN evo${c.evo}`
      + ` | ${r1(c.clicks / Math.max(1, c.gameS))} t/s racha ${c.maxCombo || 0} (perdió ${c.drops || 0}, árbol ${c.visits || 0})`
      + ` | ${c.buys} compras${cats ? ': ' + cats : ''} | noches ${c.won || 0}/${c.lost || 0} | ${c.born || 0} nacen`;
  };
  /** Una partida, resumida. La partida en curso sale con lo que lleva (y su colonia a medias). */
  function gameOut(g) {
    const G = api.getG(), live = g === bot.game;
    const gameS = live ? (G.total || 0) - g.gameStart : g.gameS, rs = live ? realS() - g.realStart : g.realS;
    const cols = [...g.colonies, ...(live && g.cur ? [{ ...g.cur, cause: 'en curso', night: G.level, adn: G.pendingAdn || 0, gameS: (G.total || 0) - g.cur.gameStart, evo: G.evo || 0 }] : [])];
    return {
      partida: g.n, bot: live && g.changes.length ? g.bot + ' → ' + botName(bot.clickProfile, bot.room) : g.bot,
      resultado: g.result + (g.debug ? ' (MODO DEBUG: no vale)' : ''), min: Math.round(gameS / 60), min_reales: Math.round(rs / 60),
      generaciones: live ? G.gen : g.gens, evo: live ? G.evo || 0 : g.evo, toques: g.clicksN, compras: g.buys,
      hitos: HITOS.filter(m => g.hitos['N' + m] != null).map(m => `N${m} ${g.hitos['N' + m]}m`).join(' · '),
      colonias: cols.map(colonyLine),
      linaje: g.lin.join(' '), evoluciones: g.evos.join(' · '),
      ...(g.changes.length ? { cambios_de_perfil: g.changes.map(c => `${Math.round(c.game_s / 60)}m → ${c.clicks || c.room}`).join(' · ') } : {}),
      ...(g.fromScratch ? {} : { ojo: 'no empezó desde cero' })
    };
  }
  const allGames = () => [...bot.games, ...(bot.game ? [bot.game] : [])];

  /** Resumen por bot (combinación de perfiles): partidas, ganadas y minutos de juego (sin las de modo debug). */
  function byBot() {
    const out = {};
    for (const g of bot.games) {
      if (g.debug) continue;
      const b = out[g.bot] || (out[g.bot] = { bot: g.bot, partidas: 0, ganadas: 0, min: [], gens: [] });
      b.partidas++;
      if (g.result === 'ganó') { b.ganadas++; b.min.push(g.gameS / 60); b.gens.push(g.gens); }
    }
    const avg = a => a.reduce((x, v) => x + v, 0) / a.length;
    return Object.values(out).map(b => ({
      bot: b.bot, ganadas: `${b.ganadas}/${b.partidas}`,
      ...(b.ganadas ? { min_media: Math.round(avg(b.min)), min_rango: `${Math.round(Math.min(...b.min))}–${Math.round(Math.max(...b.min))}`, generaciones_media: r1(avg(b.gens)) } : {})
    }));
  }

  function summary() {
    const games = allGames().map(gameOut), bots = byBot();
    const lines = [
      'ANTIGENESIS · resumen del bot', `Ahora: ${botName(bot.clickProfile, bot.room)} · ${bot.on ? 'jugando' : 'parado'}`,
      ...(bots.length ? ['', 'Por bot:', ...bots.map(b => `  ${b.bot}: ${b.ganadas} ganadas${b.min_media != null ? ` · media ${b.min_media} min (${b.min_rango}) · ${b.generaciones_media} generaciones` : ''}`)] : []),
      ...games.flatMap(o => ['', `Partida ${o.partida} · ${o.bot} · ${o.resultado} · ${o.min} min · ${o.generaciones} generaciones · evo ${o.evo}`,
        `  hitos: ${o.hitos || '—'}`, ...o.colonias.map(c => '  ' + c), `  linaje: ${o.linaje || '—'}`, `  evoluciones: ${o.evoluciones || '—'}`])
    ];
    return { clicks: bot.clickProfile, room: bot.room, on: bot.on, bots, games, text: lines.join('\n') };
  }

  function download(kind = 'csv') {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    if (bot.game) flushTaps();
    let body, type;
    if (kind === 'json') {
      // un solo archivo, resumido: por bot y cada partida por separado (una línea por colonia). El detalle, en el CSV
      body = JSON.stringify({ juego: 'Antigenesis', generado: new Date().toISOString(), bots: byBot(), partidas: allGames().map(gameOut) }, null, 1);
      type = 'application/json';
    } else if (kind === 'txt') { body = summary().text; type = 'text/plain'; }
    else {
      const cols = ['real_s', 'game_s', 'speed', 'gen', 'night', 'phase', 'act', 'target', 'detail', 'jelly', 'bio', 'adn', 'ants', 'cps', 'clicks', 'room'];
      const esc = v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      body = [['partida', ...cols].join(','), ...allGames().flatMap(g => g.log.map(r => [g.n, ...cols.map(c => r[c])].map(esc).join(',')))].join('\n');
      type = 'text/csv';
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type }));
    a.download = `antigenesis-bot-${stamp}.${kind}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /** Guarda el resumen de las partidas (los registros enteros pueden no caber en localStorage). */
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
        else if (a === 'clicks') setClicks(b.dataset.v);
        else if (a === 'room') setRoom(b.dataset.v);
        else if (a === 'clear') clear();
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
    const G = api.getG(), sp = api.getSpeed(), g = bot.game;
    const colGame = cur() ? (G.total || 0) - cur().gameStart : 0, gameS = g ? (G.total || 0) - g.gameStart : 0, rs = g ? realS() - g.realStart : 0;
    const pick = (kind, P, sel) => Object.entries(P).map(([k, v]) => `<button class="btn-plain sm${sel === k ? ' on' : ''}" data-bot="${kind}" data-v="${k}" title="${v.desc}">${v.name}</button>`).join('');
    const rows = g ? g.colonies.slice(-5).map(c => `<tr><td>${c.gen}</td><td>${c.cause}</td><td>N${c.night}</td><td>${fmtTime(c.gameS)}</td><td>${fmtTime(c.realS)}</td></tr>`).join('') : '';
    const done = bot.games.slice(-6).map(x => `<div>${x.n}) ${x.bot}: ${x.result === 'ganó' ? '✔ ' + fmtTime(x.gameS) : x.result}</div>`).join('');
    const html = `<div class="bp-head"><b>Bot</b><span class="${bot.on ? 'on' : ''}">${bot.on ? (inTree ? '● en el Árbol' : '● jugando') : '○ parado'}</span><button data-bot="close" aria-label="Cerrar">×</button></div>
      <div class="bp-row"><button class="btn-plain${bot.on ? ' on' : ''}" data-bot="toggle">${bot.on ? 'Parar' : 'Empezar'}</button>
        ${SPEEDS.map(v => `<button class="btn-plain sm${sp === v ? ' on' : ''}" data-bot="speed" data-v="${v}">×${v}</button>`).join('')}</div>
      <div class="bp-label">Toques</div><div class="bp-row">${pick('clicks', CLICK_PROFILES, bot.clickProfile)}</div>
      <div class="bp-label">Estrategia</div><div class="bp-row">${pick('room', ROOM_PROFILES, bot.room)}</div>
      ${Game.debug.free ? '<div class="bp-desc bp-warn">Modo debug encendido (compras gratis): al empezar, el bot lo apaga.</div>' : ''}
      <div class="bp-desc">${CLICK_PROFILES[bot.clickProfile]?.desc || ''}. ${ROOM_PROFILES[bot.room]?.desc || ''}.</div>
      ${done ? `<div class="bp-games">${done}</div>` : ''}
      <div class="bp-stats">${bot.cps.toFixed(1)} toques/s${g ? ` · partida ${g.n}: ${g.clicksN} toques · ${g.buys} compras` : ''}<br>
        Colonia ${G.gen}: noche ${G.level} · ${fmtTime(colGame)}${g ? `<br>Partida: ${fmtTime(gameS)} de juego · ${fmtTime(rs)} reales` : ''}</div>
      ${rows ? `<table><tr><th>gen</th><th></th><th>noche</th><th>juego</th><th>real</th></tr>${rows}</table>` : ''}
      <div class="bp-row"><button class="btn-plain sm" data-bot="csv">Registro CSV</button><button class="btn-plain sm" data-bot="json">JSON</button><button class="btn-plain sm" data-bot="txt">Resumen</button><button class="btn-plain sm" data-bot="clear" title="Borra todas las partidas y registros del bot">Borrar registros</button></div>`;
    if (force || html !== lastHtml) { lastHtml = html; p.innerHTML = html; }
  }

  return bot;
}
