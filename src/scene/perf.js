// Tope de hormigas visibles según lo que aguante el aparato.
// La simulación sigue contando todas; solo se dibujan hasta CAP.ants (layout.js).
import { CAP } from './layout.js';
import { mobile } from './context.js';

/** Por tramo: mínimo al que puede bajar si va justo, y máximo si va sobrado. */
const TIER = {
  low: { min: 10, max: 16 },
  mid: { min: 14, max: 24 },
  high: { min: 20, max: 32 },
  ultra: { min: 24, max: 40 }
};

let tier = 'mid', cool = 0, fpsSmooth = 60;

/** Mira núcleos, RAM, si es móvil y (si se deja) la GPU. */
function detect() {
  const m = mobile();
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || (m ? 3 : 8);
  let s = m ? -1 : 2;
  if (cores >= 8) s += 2; else if (cores >= 4) s += 1;
  if (mem >= 8) s += 2; else if (mem >= 4) s += 1;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        const gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
        if (/mali|adreno [1-5]|powervr|intel hd|intel\(r\) hd|intel uhd 6/.test(gpu)) s -= 1;
        if (/rtx|radeon rx|geforce (gtx|rtx)|apple m[1-9]|arc a/.test(gpu)) s += 2;
      }
    }
  } catch (e) { /* sin WebGL */ }
  if (s <= 1) return 'low';
  if (s <= 3) return 'mid';
  if (s <= 5) return 'high';
  return 'ultra';
}

/** Al arrancar la escena: fija el tope según el aparato. */
export function initPerf() {
  tier = detect();
  CAP.ants = TIER[tier].max;
  cool = 0;
  fpsSmooth = 60;
}

/**
 * Cada fotograma: si el FPS va bajo, quita 2 hormigas dibujadas; si va alto, puede recuperar.
 * Con enfriamiento para no oscilar. Devuelve true si cambió el tope (hay que re-sincronizar agentes).
 */
export function tickPerf(realDt) {
  if (!(realDt > 0)) return false;
  fpsSmooth = fpsSmooth * 0.9 + Math.min(120, 1 / realDt) * 0.1;
  cool -= realDt;
  if (cool > 0) return false;
  const { min, max } = TIER[tier];
  if (fpsSmooth < 40 && CAP.ants > min) {
    CAP.ants = Math.max(min, CAP.ants - 2);
    cool = 2;
    return true;
  }
  if (fpsSmooth > 55 && CAP.ants < max) {
    CAP.ants = Math.min(max, CAP.ants + 1);
    cool = 3;
    return true;
  }
  return false;
}

export const perfInfo = () => ({ tier, antCap: CAP.ants, fps: Math.round(fpsSmooth) });
