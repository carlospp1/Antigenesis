// Interfaz en DOM al estilo de la referencia: barra superior con recursos, objetivo, alarma,
// pestañas laterales, tarjetas inferiores, etiquetas ancladas a la escena, hojas modales y avisos.
import * as Game from '../game/index.js';
import * as Audio from '../audio/audio.js';
import { fmt, fmtTime, fmtMult } from '../core/format.js';
import { toScreen, anchors, broodBars, isLiveMap } from '../scene/index.js';
import { icon } from './icons.js';

const $ = id => document.getElementById(id);
/** Versión del juego (se ve en Ajustes). */
const VERSION = '0.1.2';
// speed: velocidad del jugador (×1, ×2, ×3 o ×5: botón junto al reloj) · devSpeed: la de depuración (×1–×60, manda si es > 1)
export const ui = { sheet: null, holding: false, paused: false, speed: 1, devSpeed: 1, tab: 'colony', debug: false, devOpen: false };
let lastDock = '', lastSheet = '', statsT = 0;
const cache = {};
const setText = (id, v) => { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } };
const setHTML = (el, v, key) => { if (cache[key] !== v) { cache[key] = v; el.innerHTML = v; } };

export const evoUnlocked = G => G.level - 1 >= Game.BAL.foundAfter || G.gen > 1 || G.adnTotal > 0;

/* ---------- barra superior, objetivo y alarma ---------- */
function renderTop(G, D) {
  const night = G.phase === 'night', dusk = !night && G.t <= 10;
  setText('lv', 'Lv. ' + G.level);
  setText('vJelly', Game.debug.free ? '∞' : fmt(Math.floor(G.jelly)));
  setText('vRate', '+' + fmt(G.rate, G.rate < 10 ? 1 : 0) + '/s');
  setText('vBio', Game.debug.free ? '∞' : fmt(G.bio));
  setText('vAnts', fmt(G.ants));
  setText('vDay', (night ? 'Noche ' : 'Día ') + G.level);
  setText('vDayLeft', G.phase === 'dead' ? (G.leaving ? 'la princesa se prepara' : 'la reina ha caído') : (night ? 'amanece en ' : 'anochece en ') + fmtTime(G.t));
  $('vDayBar').style.width = 100 * G.t / (night ? D.night.time : Game.DAY) + '%';
  $('clock').className = 'pill panel clock ' + (night ? 'night' : dusk ? 'dusk' : '');
  setHTML($('clockIc'), icon(night ? 'moon' : 'sun'), 'clockIc');
  $('bSkip').hidden = !(D.skipDay && G.phase === 'day' && !dusk);
  setText('vSpeed', '×' + ui.speed);
  $('bSpeed').classList.toggle('on', ui.speed > 1);
  $('bSpeed').title = ui.speed < 5 ? 'Acelerar el tiempo' : 'Volver a la velocidad normal';

  const o = Game.OBJ[G.obj];
  $('quest').hidden = !o;
  if (o) {
    setText('questText', o[0]);
    $('questBarWrap').hidden = !o[3];
    if (o[3]) $('questBar').style.width = Math.min(100, 100 * Math.max(0, o[3](G))) + '%';
  }

  const f = G.phase === 'dead' ? null : G.foes, al = $('alarm');
  al.hidden = !(dusk || f);
  document.body.classList.toggle('danger', !!(dusk || f));
  if (dusk) setHTML(al, `<b>¡Alarma! Cae la noche</b><span>Se acercan ${D.night.text}. Llegan en ${fmtTime(G.t)}.</span>`, 'alarm');
  else if (f) {
    const tot = D.night.totalHp, left = f.count > 0 ? (f.count - 1) * D.night.hpEach + f.cur + f.boss : f.boss;
    const human = D.night.boss && D.night.boss.final;
    // los humanos pisan: se cuenta cuántos pisotones aguantan todavía
    const who = !human ? f.count + ' ' + (f.count === 1 ? D.night.era.one : D.night.era.many) + (f.boss > 0 ? ' y ' + D.night.boss.name : '')
      : Game.immuneBoss(G, D.night) ? 'Los humanos · un pisotón las mata a todas: hace falta la Hormiga titán'
      : G.ants <= 0 ? 'Los humanos · el pie va a por el nido'
      : !f.halved ? 'Los humanos · el próximo pisotón aplasta a la mitad'
      : `Los humanos · aguantan ${Math.max(0, D.stompHits - (f.stomps || 0) - 1)} pisotones más`;
    setHTML(al, `<b>${G.ants > 0 ? '¡Nos atacan!' : '¡No queda nadie en la entrada!'}</b><div class="meter"><i style="width:${Math.max(0, 100 * left / tot)}%"></i></div><span>${who}. Bajas: ${fmt(f.lost)}</span>`, 'alarm');
  }
  Audio.setTension(!!f);

  setText('vAdn', Game.debug.free ? '∞' : fmt(G.adn));
  const lg = Game.legacy(G);
  $('bFound').hidden = !lg.ready;
  if (lg.ready && !ui.foundArmed) { setText('vFound', '+' + lg.gain); setText('vFoundTxt', 'ADN · Fundar'); }
  $('pAdn').hidden = !(G.adnTotal > 0 || Game.debug.free);

  // pestañas: Linaje bloqueado hasta tener ADN; punto verde si hay algo que comprar
  const evo = $('tabEvo'), unlocked = evoUnlocked(G);
  evo.classList.toggle('locked', !unlocked);
  $('tabEvolve').classList.toggle('locked', !unlocked);
  $('tabEvolve').classList.toggle('hot', unlocked && Game.canEvolve(G));
  evo.title = unlocked ? '' : 'Se desbloquea cuando muera tu primera reina o al superar la noche ' + Game.BAL.foundAfter;
  $('tabTree').classList.toggle('hot', Game.anyBuyable(G, 'skills'));
  evo.classList.toggle('hot', unlocked && (Game.anyBuyable(G, 'perm') || Game.legacy(G).ready));
}

/* ---------- tarjetas (información; las mejoras están en el Árbol) ---------- */
function infoCard(art, title, lines, row = '', note = '') {
  return `<div class="card panel"><div class="art">${icon(art)}</div><div><h4>${title}</h4>${lines}</div>${row ? `<div class="row">${row}</div>` : ''}${note}</div>`;
}

function dockColony(G, D) {
  const fc = Game.forecast(G, D), fill = Math.min(1, G.lay / D.eggCost), nx = D.next, st = Game.STAGES[G.stage];
  const nBuy = Game.buyable(G, 'skills');
  const cards = [
    // solo el huevo y lo que le falta para crecer: el resto (toques, racha, suerte…) está en Estadísticas
    infoCard('crown', st.name, `<span class="fx">Huevo: ${fmt(Math.min(G.lay, D.eggCost), 0)} / ${fmt(D.eggCost, 0)}</span><div class="meter"><i style="width:${fill * 100}%"></i></div>
      ${nx ? `<span class="fx">${nx.name}: ${fmt(Math.min(G.eaten, nx.at), 0)} / ${fmt(nx.at, 0)}</span><div class="meter green"><i style="width:${Math.min(100, 100 * G.eaten / nx.at)}%"></i></div>` : ''}`),
    infoCard('egg', 'Cría', `<span class="fx">Huevo ${fmt(Game.BAL.eggTime / D.brood, 1)} s · larva ${fmt(Game.BAL.larvaTime / D.brood, 1)} s</span>`),
    infoCard('shield', G.phase === 'night' ? 'Noche ' + G.level : 'Esta noche', `<span class="fx">${D.night.text}</span><span class="fx stats"><small>Tus hormigas: daño ${fmt(D.dmg, 1)} · vida ${fmt(D.hp, 0)}</small></span>`, '',
      // previsión como chip: se lee de un vistazo (el detalle, en la frase de al lado en pantallas grandes)
      `<p class="note ${!G.ants || !fc.win ? 'warn' : 'good'}"><b class="chip">${!G.ants ? 'Sin hormigas' : fc.immune ? 'Inmunes' : fc.win ? 'Ganáis' : 'No aguantan'}</b><span class="why">${whyText(G, D, fc)}</span></p>`),
    infoCard('arrows', 'Árbol', `<span class="fx">${nBuy ? nBuy + (nBuy === 1 ? ' mejora disponible' : ' mejoras disponibles') : 'Sigue recolectando jalea'}</span>`, `<button class="btn-green${nBuy ? '' : ' no'}" data-act="openTree" data-id="skills">Abrir</button>`)
  ];
  const l = Game.legacy(G);
  if (l.ready) cards.push(infoCard('dna', 'Fundar colonia', `<span class="fx">Ganas +${l.gain} ADN y eliges mejoras de Linaje antes de empezar</span>`, `<button class="btn-green" data-act="prestige">${icon('dna')}Fundar</button>`));
  return cards.join('');
}

/**
 * Hoja de estadísticas: los totales de ahora (árbol + linaje + evolución + Sangre antigua), por secciones.
 * Solo enseña lo que ya tienes (una probabilidad a 0 o algo sin desbloquear no sale).
 */
function statsHTML(G) {
  const D = Game.calc(G), pct = v => fmt(v * 100, v < 0.1 ? 1 : 0) + '%', s = v => fmt(v, 1) + ' s';
  const m = Game.comboMult(G, D), taps = Game.tapClicks(G, D), tap = (Game.BAL.tapFood * D.tapQ + D.tapRate * D.income) * m * taps;
  const sec = (title, rows) => {
    const r = rows.filter(x => x && x[1] != null && x[1] !== false);
    return r.length ? `<h3>${title}</h3><div class="settings stats">${r.map(([k, v]) => `<div class="line"><span>${k}</span><b>${v}</b></div>`).join('')}</div>` : '';
  };
  return '<h2>Estadísticas</h2>' + [
    sec('Colonia', [
      ['Hormigas', fmt(G.ants)],
      ['Recolección', fmt(D.income, 1) + ' de comida/s'],
      ['Comida por viaje', fmt(D.carry, 1)],
      ['Velocidad', fmt(D.speed, 1)],
      ['La reina produce', fmt(D.reserve, 1) + ' de comida/s'],
      D.qJelly > 0 && ['La reina genera', fmt(D.qJelly, 1) + ' de jalea/s'],
      D.farm > 0 && ['Granjas', fmt(D.farm * Game.nightPrize(G, D) / 60, 1) + ' de jalea/s'],
      ['Premio de esta noche', fmt(Game.nightPrize(G, D), 0) + ' de jalea'],
      D.luck > 0 && ['Entregas dobles', pct(D.luck)],
      D.goldFood > 0 && ['Comida dorada (×5)', pct(D.goldFood)],
      D.feast > 0 && ['Festín (×50)', pct(D.feast)]
    ]),
    sec('Cría', [
      ['Coste del huevo', fmt(D.eggCost, 0) + ' de comida'],
      D.tapCut && ['Descuento guardado', '−' + fmt(G.eggCut || 0, 0) + ' por huevo (máx. ' + pct(D.cutMax) + ')'],
      ['Huevo / larva', s(Game.BAL.eggTime / D.brood) + ' · ' + s(Game.BAL.larvaTime / D.brood)],
      D.twin > 0 && ['Gemelas', pct(D.twin)],
      D.extraEgg > 0 && ['Huevo extra', pct(D.extraEgg)],
      D.freeEgg > 0 && ['Huevo sin precio', pct(D.freeEgg)],
      D.instaHatch > 0 && ['Eclosión precoz', pct(D.instaHatch)],
      D.shinyP > 0 && ['Hormigas doradas', pct(D.shinyP)]
    ]),
    sec('Toques', [
      taps > 1 && ['Cada toque vale', taps + ' clics' + (D.tapN > 1 ? ' (' + D.tapN + ' por hitos)' : '')],
      ['Toque a la reina', '+' + fmt(tap, tap < 10 ? 1 : 0) + ' de comida' + (m > 1 ? ' (racha ' + fmtMult(m) + ')' : '')],
      ['Toque a la cría', '+' + pct(Game.BAL.tapBrood * D.tapB)],
      ['Toque a los enemigos', '×' + fmt(D.tapFoe, 2)],
      D.tapCrit > 0 && ['Toques de suerte', pct(D.tapCrit) + ' (×' + D.critX + ')'],
      D.ghost > 0 && ['Manos fantasma', fmt(D.ghost, 1) + ' toques/s'],
      D.combo && ['Racha', 'hasta ' + fmt(D.comboCap) + ' toques · margen ' + s(D.comboGap)]
    ]),
    sec('Combate', [
      ['Daño por hormiga', fmt(D.dmg, 1)],
      ['Vida por hormiga', fmt(D.hp, 0)],
      D.dodge > 0 && ['Esquivar un golpe mortal', pct(D.dodge)],
      D.lives > 0 && ['Asaltos que resiste la reina', fmt(D.lives)],
      ['Biomasa por enemigo', '×' + fmt(D.bioKill, 2)],
      ['ADN por enemigo esta noche', fmt(Game.adnDrop(G.level), 2)],
      (G.evo || 0) >= Game.EVOS.length - 1 && ['Pisotones que aguantan', fmt(D.stompHits)]
    ]),
    sec('Linaje', [
      ['Evolución', Game.EVOS[G.evo || 0].name],
      ['Sangre antigua', '×' + fmt(D.blood, 2) + ' (' + fmt(G.adnTotal || 0) + ' ADN ganado)'],
      D.discount > 0 && ['Descuento del árbol', pct(D.discount)]
    ])
  ].join('');
}

/** La frase de la previsión de esta noche (la noche final habla de pisotones). */
function whyText(G, D, fc) {
  const human = D.night.boss && D.night.boss.final;
  if (!G.ants) return human ? 'El primer pisotón irá directo a la reina.' : 'Si llega la noche así, matarán a la reina.';
  if (fc.immune) return 'Un pisotón las mata a todas y el siguiente, a la reina. Solo la Hormiga titán puede herir a los humanos.';
  if (human) return (fc.win ? `Caen antes del ${D.stompHits + 1}.º pisotón` : `No les da tiempo: al ${D.stompHits + 1}.º pisotón caen todas`) + '. El primero aplasta a la mitad: sigue sacando hormigas.';
  return fc.win ? 'Unas ' + fc.losses + ' bajas.' : 'Cría más o mejora en el Árbol.';
}

function renderDock(G, D) {
  const h = dockColony(G, D);
  if (h !== lastDock) { lastDock = h; const dk = $('dock'), sc = dk.scrollLeft; dk.innerHTML = h; dk.scrollLeft = sc; }
}

export function setTab(tab) {
  ui.tab = tab;
  for (const b of document.querySelectorAll('#side .tab')) b.classList.toggle('on', b.dataset.tab === tab);
}

/* ---------- etiquetas sobre la escena ---------- */
let labels = null;
function buildLabels() {
  const mk = () => { const d = document.createElement('div'); d.className = 'wlabel panel'; $('labels').appendChild(d); return d; };
  labels = { pantry: mk(), eggs: mk(), queen: mk(), larvae: mk() };
}

function renderLabels(G, D) {
  if (!labels) buildLabels();
  const n = arr => arr.reduce((s, e) => s + e.n, 0), best = arr => arr.reduce((m, e) => Math.max(m, e.p), 0);
  const fill = Math.min(1, G.lay / D.eggCost);
  setHTML(labels.pantry, `Despensa<small>${icon('leaf')}${fmt(Math.floor(G.jelly))} jalea</small>`, 'lPantry');
  setHTML(labels.eggs, `Huevos<small>${icon('egg')}${n(G.eggs)} / 12</small>${G.eggs.length ? `<div class="meter"><i style="width:${100 * best(G.eggs)}%"></i></div>` : ''}`, 'lEggs');
  setHTML(labels.queen, `${Game.STAGES[G.stage].name}<small>${icon('egg')}próximo huevo ${Math.floor(fill * 100)}%</small><div class="meter"><i style="width:${fill * 100}%"></i></div>`, 'lQueen');
  setHTML(labels.larvae, `Larvas<small>${icon('larva')}${n(G.larvae)} / 12</small>${G.larvae.length ? `<div class="meter green"><i style="width:${100 * best(G.larvae)}%"></i></div>` : ''}`, 'lLarvae');
}

/** Se llama cada fotograma: recoloca las etiquetas si la cámara se mueve. */
/** Barritas de huevos y larvas: HTML con el estilo de la interfaz, recolocadas cada fotograma. */
const bars = [];
export function placeLabels() {
  const list = broodBars(), box = $('labels');
  while (bars.length < list.length) { const d = document.createElement('div'); d.className = 'bbar'; d.innerHTML = '<i></i>'; box.appendChild(d); bars.push(d); }
  bars.forEach((d, i) => {
    const b = list[i];
    if (!b) { d.hidden = true; return; }
    const p = toScreen(b);
    d.hidden = false;
    d.className = 'bbar ' + b.st + (b.ready ? ' ready' : '');
    d.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    d.style.zIndex = Math.round(b.z);
    d.firstChild.style.width = (b.p * 100).toFixed(1) + '%';
  });
}

/* ---------- hitos (feats.js): de toda la partida, dan estadísticas para siempre ---------- */
function featsHTML(G) {
  const got = G.feats || {}, n = Game.FEATS.filter(f => got[f.id]).length;
  return `<h3 class="sheet-sub">Hitos · ${n}/${Game.FEATS.length} <small>(para siempre, también al fundar)</small></h3><ul class="flist">` + Game.FEATS.map(f => {
    const done = !!got[f.id], v = Math.min(f.at, Game.featValue(G, f)), [, unit] = Game.featStat(f);
    const goal = f.stat === 'night' ? 'Supera la noche ' + f.at : f.stat === 'gen' ? 'Llega a la generación ' + f.at : fmt(f.at) + ' ' + unit;
    return `<li class="${done ? 'done' : ''}">${icon(done ? 'check' : 'trophy')}<span>${f.name}</span><em>${done ? '✓' : fmt(Math.floor(v)) + ' / ' + fmt(f.at)}</em>`
      + `<small>${goal} → ${f.prize}</small>${done ? '' : `<i class="bar"><u style="width:${(100 * v / f.at).toFixed(1)}%"></u></i>`}</li>`;
  }).join('') + '</ul>';
}

/* ---------- hojas modales ---------- */
function renderSheet(G) {
  if (ui.holding) return;
  let h = '';
  if (ui.sheet === 'guide') h = $('guideTpl').innerHTML;
  else if (ui.sheet === 'stats') {
    // las cifras cambian a cada momento: se repinta dos veces por segundo, no en cada fotograma
    if (lastSheet && performance.now() - statsT < 500) return;
    statsT = performance.now(); h = statsHTML(G);
  }
  else if (ui.sheet === 'goals') {
    h = '<h2>Objetivos</h2><ul class="olist">' + Game.OBJ.map((o, i) => {
      const st = i < G.obj ? 'done' : i === G.obj ? 'cur' : '';
      return `<li class="${st}">${icon(i < G.obj ? 'check' : 'trophy')}<span>${o[0]}</span>${o[2] ? `<em>${icon('leaf')}${fmt(o[2])}</em>` : ''}</li>`;
    }).join('') + '</ul>' + featsHTML(G);
  } else if (ui.sheet === 'settings') {
    // cada fila: nombre a la izquierda, controles a la derecha (y una nota debajo si hace falta)
    const row = (name, ctl, note = '') => `<div class="line"><span>${name}</span><div class="ctl">${ctl}${note ? `<small>${note}</small>` : ''}</div></div>`;
    const btn = (on, act, label, id = '') => `<button class="btn-plain${on ? ' on' : ''}" data-act="${act}"${id ? ` data-id="${id}"` : ''}>${label}</button>`;
    let code = false; try { code = localStorage.getItem('antigenesis.antModel') === 'code'; } catch (e) { /* nada */ }
    const pct = v => Math.round(v * 100);
    const slide = (key, val) => `<input class="vol" type="range" min="0" max="100" step="1" value="${pct(val)}" data-vol="${key}" aria-label="${key}">`;
    h = `<h2>Ajustes</h2><div class="settings">
      ${row('Música', btn(!Audio.vol.muteMusic, 'muteMusic', icon(Audio.vol.muteMusic ? 'mute' : 'music') + (Audio.vol.muteMusic ? ' Silenciada' : ' Encendida')) + slide('music', Audio.vol.music), 'incluye ambiente (viento y pájaros)')}
      ${row('Efectos', btn(!Audio.vol.muteSfx, 'muteSfx', icon(Audio.vol.muteSfx ? 'mute' : 'sound') + (Audio.vol.muteSfx ? ' Silenciados' : ' Encendidos')) + slide('sfx', Audio.vol.sfx))}
      ${row('Juego', btn(ui.paused, 'pause', ui.paused ? 'Reanudar' : 'Pausar'))}
      ${row('Partida', '<button class="btn-plain" data-act="reset" id="bReset">Reiniciar</button>')}
      ${row('Versión', `<b>${VERSION}</b>`)}
      <button class="dev-head${ui.devOpen ? ' open' : ''}" data-act="dev" aria-expanded="${!!ui.devOpen}">Pruebas y depuración</button>
      ${ui.devOpen ? `<div class="dev">
        ${row('Velocidad (debug)', [1, 2, 4, 6, 10, 20, 40, 60].map(v => btn(ui.devSpeed === v, 'devSpeed', '×' + v, v)).join(''), 'manda sobre el botón ×1–×3 del juego')}
        ${row('Final', btn(false, 'ending', 'Ver cinemática'), 'la reina sale del nido y la colonia conquista el planeta')}
        ${row('Bot', btn(false, 'bot', 'Abrir panel'), 'tecla B · juega solo y registra cada acción')}
        ${row('Hormigas', btn(!code, 'antModel', 'Ilustradas', 'glb') + btn(code, 'antModel', 'En código', 'code'), 'se aplica al recargar')}
        ${row('Festín', btn(false, 'feastNow', 'Ahora') + btn(false, 'feastNext', 'Próximo toque'), 'un toque a la reina que vale ×50, con su lluvia de comida')}
        ${row('Colisiones', btn(ui.debug, 'debug', ui.debug ? 'Visibles' : 'Ocultas'), 'tecla C')}
        ${row('Nido', btn(isLiveMap(), 'liveMap', isLiveMap() ? '3D en vivo' : 'Foto fija'), 'la foto es más ligera; el 3D sigue ahí si lo quieres')}
        ${row('Modo debug', btn(Game.debug.free, 'free', Game.debug.free ? 'Activado' : 'Apagado'), 'jalea, biomasa y ADN ∞ · compras gratis')}
        ${Game.debug.free ? row('Maxear', btn(false, 'debugSkills', 'Árbol') + btn(false, 'debugPerm', 'Linaje'), 'sube de golpe todas las habilidades o el linaje') : ''}
      </div>` : ''}</div>`;
  }
  if (h !== lastSheet) { lastSheet = h; $('sheetBody').innerHTML = h; }
}

export function openSheet(G, s) {
  ui.sheet = s;
  $('sheet').hidden = !s;
  lastSheet = '';
  if (s) renderSheet(G);
}

export function render(G, D) {
  renderTop(G, D);
  if (ui.sheet) renderSheet(G);
  if (!ui.holding) renderDock(G, D);
}

export function toast(text, tone) {
  const t = document.createElement('div');
  t.className = 'toast panel ' + (tone || ''); t.textContent = text;
  const box = $('toasts');
  box.appendChild(t);
  setTimeout(() => t.remove(), 6500);
  while (box.children.length > 3) box.firstChild.remove();
}

/** Número que sube desde un punto de la imagen. */
export function float(text, pos, cls, scale = 1) {
  const p = toScreen(pos), f = document.createElement('div');
  f.className = 'float ' + (cls || '');
  const t = document.createElement('span'); t.textContent = text; f.appendChild(t);
  if (scale !== 1) t.style.transform = 'scale(' + scale.toFixed(2) + ')';
  // en el teléfono el dedo tapa el sitio del toque: el número sale bastante más arriba para que se vea
  // la comida volando a la boca de la reina
  // con ratón, el número del toque (clase «tap», sale en el cursor) va arriba a la derecha: se ve el número y,
  // a la vez, la comida volando desde el cursor a la boca de la reina
  const lift = matchMedia('(max-width: 720px), (pointer: coarse)').matches ? 72 : /\btap\b/.test(cls || '') ? 68 : 0;
  const right = /\btap\b/.test(cls || '') ? 62 : 0;
  f.style.left = p.x + right + (Math.random() - 0.5) * 44 + 'px'; f.style.top = p.y - lift + (Math.random() - 0.5) * 22 + 'px';
  $('floats').appendChild(f);
  setTimeout(() => f.remove(), 1800);
}
