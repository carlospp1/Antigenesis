// Audio procedural con Web Audio: música generativa, viento, pájaros y efectos. Sin archivos.
let ctx = null, master, started = false, tension = false, tensionGain, noiseBuf;
const bus = {}, last = {};
export const vol = { music: 0.5, sfx: 0.6, amb: 0.5, mute: false };

function env(g, t, a, peak, d) {
  g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(dest, type, f0, f1, a, d, peak, t0) {
  const t = t0 || ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
  env(g, t, a, peak, d); o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + d + 0.05);
}

function noise(dest, freq, q, a, d, peak, t0) {
  const t = t0 || ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; env(g, t, a, peak, d);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + a + d + 0.05);
}

/**
 * ¿Suena de verdad? En el móvil el contexto se suspende o se interrumpe (pestaña de fondo, llamadas, avisos)
 * y su reloj se para: lo que se programe mientras tanto no acaba nunca, se acumula (el juego va a tirones
 * y no responde) y al volver suena todo de golpe. Mientras no esté «running» no se crea ningún sonido.
 */
const live = () => !!ctx && ctx.state === 'running';
function resume() { if (ctx && ctx.state !== 'running' && ctx.state !== 'closed' && !document.hidden) ctx.resume().catch(() => {}); }

/** Debe llamarse desde un gesto del usuario (clic) por las políticas de autoplay. */
export function start() {
  if (started) { resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { ctx = new AC(); } catch (e) { return; }
  started = true;
  // el móvil solo deja reanudar desde un gesto: cualquier toque sirve; al irse la pestaña se suspende
  addEventListener('pointerdown', resume, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend().catch(() => {}); else resume(); });
  master = ctx.createGain(); master.connect(ctx.destination);
  for (const k of ['music', 'sfx', 'amb']) { bus[k] = ctx.createGain(); bus[k].connect(master); }
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < d.length; i++) { b = b * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = b * 6; }

  // eco suave para la música
  const delay = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
  delay.delayTime.value = 0.42; fb.gain.value = 0.34; lp.type = 'lowpass'; lp.frequency.value = 1500;
  bus.musicIn = ctx.createGain(); bus.musicIn.connect(bus.music); bus.musicIn.connect(delay);
  delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(bus.music);

  // viento
  const wind = ctx.createBufferSource(), wf = ctx.createBiquadFilter(), wg = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  wind.buffer = noiseBuf; wind.loop = true; wf.type = 'lowpass'; wf.frequency.value = 520; wg.gain.value = 0.16;
  lfo.frequency.value = 0.07; lg.gain.value = 0.07; lfo.connect(lg); lg.connect(wg.gain);
  wind.connect(wf); wf.connect(wg); wg.connect(bus.amb); wind.start(); lfo.start();

  // tensión de combate: un pulso grave muy contenido
  tensionGain = ctx.createGain(); tensionGain.gain.value = 0; tensionGain.connect(bus.music);
  const to = ctx.createOscillator(), tl = ctx.createOscillator(), tg = ctx.createGain(), tm = ctx.createGain();
  to.type = 'triangle'; to.frequency.value = 55; tl.frequency.value = 1.6; tg.gain.value = 0.5; tm.gain.value = 0.5;
  tl.connect(tg); tg.connect(tm.gain); to.connect(tm); tm.connect(tensionGain); to.start(); tl.start();

  apply(); schedule(); birds();
}

export function apply() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(vol.mute ? 0 : 0.9, t, 0.05);
  bus.music.gain.setTargetAtTime(vol.music * 0.55, t, 0.05);
  bus.sfx.gain.setTargetAtTime(vol.sfx * 0.8, t, 0.05);
  bus.amb.gain.setTargetAtTime(vol.amb * 0.7, t, 0.05);
}

export function set(k, v) { vol[k] = v; apply(); }

export function setTension(onOff) {
  if (!ctx || tension === onOff) return;
  tension = onOff;
  tensionGain.gain.setTargetAtTime(onOff ? 0.09 : 0, ctx.currentTime, 1.2);
}

// música generativa: acordes lentos y notas sueltas en pentatónica
const CH = [[220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 392], [164.8, 207.7, 246.9, 329.6]];
const PENTA = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
let bar = 0;

function schedule() {
  if (!ctx) return;
  if (!live()) { setTimeout(schedule, 1000); return; } // sin reloj: se espera, sin acumular acordes
  const t = ctx.currentTime + 0.1, ch = CH[bar % 4], len = 9;
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = ch[i] * (i === 0 ? 0.5 : 1); o.detune.value = (i - 1) * 6;
    f.type = 'lowpass'; f.frequency.value = 700;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.085, t + 3);
    g.gain.linearRampToValueAtTime(0.06, t + len - 2); g.gain.linearRampToValueAtTime(0.0001, t + len + 2);
    o.connect(f); f.connect(g); g.connect(bus.music); o.start(t); o.stop(t + len + 2.2);
  }
  let tt = t + Math.random() * 1.5;
  while (tt < t + len) {
    if (Math.random() < 0.72) {
      const f = PENTA[Math.floor(Math.random() * PENTA.length)] * (Math.random() < 0.2 ? 2 : 1);
      tone(bus.musicIn, 'sine', f, f, 0.01, 1.6, 0.075, tt); tone(bus.musicIn, 'sine', f * 2, f * 2, 0.005, 0.5, 0.018, tt);
    }
    tt += [0.75, 1.5, 1.5, 2.25, 3][Math.floor(Math.random() * 5)];
  }
  bar++;
  setTimeout(schedule, len * 1000);
}

function birds() {
  if (!ctx) return;
  if (live() && !document.hidden) {
    const t = ctx.currentTime + 0.05, n = 2 + Math.floor(Math.random() * 4), base = 2200 + Math.random() * 1600;
    for (let i = 0; i < n; i++) tone(bus.amb, 'sine', base * (1 + Math.random() * 0.15), base * (0.8 + Math.random() * 0.5), 0.02, 0.09 + Math.random() * 0.06, 0.035, t + i * (0.11 + Math.random() * 0.05));
  }
  setTimeout(birds, 4000 + Math.random() * 9000);
}

const S = {
  click() { tone(bus.sfx, 'sine', 520 + Math.random() * 60, 360, 0.004, 0.09, 0.2); },
  lay() { const t = ctx.currentTime; tone(bus.sfx, 'sine', 392, 392, 0.005, 0.16, 0.16, t); tone(bus.sfx, 'sine', 587, 587, 0.005, 0.22, 0.14, t + 0.07); },
  hatch() { tone(bus.sfx, 'sine', 440, 700, 0.01, 0.16, 0.12); },
  pupate() { tone(bus.sfx, 'triangle', 330, 262, 0.01, 0.2, 0.1); },
  born() { const t = ctx.currentTime; [523.3, 659.3, 784].forEach((f, i) => tone(bus.sfx, 'sine', f, f, 0.006, 0.5, 0.11, t + i * 0.06)); },
  buy() { const t = ctx.currentTime; tone(bus.sfx, 'triangle', 330, 330, 0.008, 0.28, 0.14, t); tone(bus.sfx, 'triangle', 494, 494, 0.008, 0.34, 0.12, t + 0.06); tone(bus.sfx, 'sine', 659, 659, 0.008, 0.4, 0.08, t + 0.12); },
  skill() { const t = ctx.currentTime; [392, 494, 587, 784].forEach((f, i) => tone(bus.sfx, 'sine', f, f, 0.01, 0.7, 0.11, t + i * 0.09)); },
  deny() { tone(bus.sfx, 'sine', 196, 150, 0.006, 0.14, 0.14); },
  deposit() { noise(bus.sfx, 1800, 2.5, 0.003, 0.05, 0.1); },
  hit() { noise(bus.sfx, 900 + Math.random() * 500, 3, 0.002, 0.045, 0.09); },
  poof() { noise(bus.sfx, 500, 1, 0.01, 0.2, 0.18); tone(bus.sfx, 'sine', 300, 520, 0.01, 0.15, 0.06); },
  wave() { const t = ctx.currentTime; tone(bus.sfx, 'triangle', 146.8, 146.8, 0.15, 0.9, 0.16, t); tone(bus.sfx, 'triangle', 220, 220, 0.15, 1.1, 0.13, t + 0.45); },
  win() { const t = ctx.currentTime; [392, 523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(bus.sfx, 'triangle', f, f, 0.01, 0.6, 0.12, t + i * 0.1)); },
  retreat() { const t = ctx.currentTime; tone(bus.sfx, 'triangle', 294, 294, 0.02, 0.5, 0.12, t); tone(bus.sfx, 'triangle', 247, 247, 0.02, 0.7, 0.12, t + 0.22); },
  objective() { const t = ctx.currentTime; [523.3, 784].forEach((f, i) => tone(bus.sfx, 'sine', f, f, 0.01, 0.8, 0.12, t + i * 0.14)); },
  alarm() {
    const t = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const f = i % 2 ? 440 : 660;
      tone(bus.sfx, 'square', f, f, 0.02, 0.26, 0.09, t + i * 0.3);
      tone(bus.sfx, 'sawtooth', f / 2, f / 2, 0.02, 0.26, 0.05, t + i * 0.3);
    }
  },
  stomp() { noise(bus.sfx, 120, 0.7, 0.005, 0.7, 0.9); tone(bus.sfx, 'sine', 90, 38, 0.005, 0.6, 0.5); },
  death() { tone(bus.sfx, 'triangle', 300, 110, 0.005, 0.22, 0.12); },
  /** Combo: cada toque seguido suena un semitono más agudo (vuelve a empezar cada octava). */
  combo(n = 3) { const f = 523.3 * Math.pow(2, ((n - 3) % 12) / 12); tone(bus.sfx, 'sine', f, f * 1.01, 0.004, 0.12, 0.09); tone(bus.sfx, 'triangle', f * 2, f * 2, 0.004, 0.08, 0.03); },
  /** Una moneda que llega al contador (sube un poco con cada una). */
  coin(i = 0) { const f = 1318.5 * Math.pow(2, (i % 8) / 24); tone(bus.sfx, 'sine', f, f, 0.002, 0.09, 0.06); tone(bus.sfx, 'sine', f * 1.5, f * 1.5, 0.002, 0.07, 0.03); },
  /** Fanfarria de celebración; más larga cuanto más importante. */
  fanfare(tier = 2) {
    const t = ctx.currentTime, notes = tier >= 3 ? [523.3, 659.3, 784, 1046.5, 784, 1046.5, 1318.5] : [523.3, 659.3, 784, 1046.5];
    notes.forEach((f, i) => { tone(bus.sfx, 'triangle', f, f, 0.01, 0.45, 0.11, t + i * 0.085); tone(bus.sfx, 'sine', f * 2, f * 2, 0.01, 0.3, 0.035, t + i * 0.085); });
  }
};
const GAP = { death: 0.15, click: 0.03, deposit: 0.35, hit: 0.12, hatch: 0.12, pupate: 0.12, born: 0.2, lay: 0.15, poof: 0.1, buy: 0.05, combo: 0.02, coin: 0.03, fanfare: 0.8 };

export function play(id, arg) {
  if (!live() || vol.mute || document.hidden || !S[id]) return;
  const t = ctx.currentTime;
  if (last[id] && t - last[id] < (GAP[id] || 0)) return;
  last[id] = t;
  try { S[id](arg); } catch (e) { /* el audio nunca debe romper el juego */ }
}
