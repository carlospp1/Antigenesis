const UNITS = ['', ' K', ' M', ' B', ' T'];

/** Número corto en formato español: 1,5 K, 12 M… */
export function fmt(x, d) {
  if (x < 1000) return x.toFixed(d != null ? d : (x < 10 && x % 1 > 0.05 ? 1 : 0)).replace('.', ',');
  const e = Math.min(4, Math.floor(Math.log10(x) / 3)), v = x / Math.pow(1000, e);
  return v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0).replace('.', ',') + UNITS[e];
}

export function fmtTime(s) {
  if (s < 60) return Math.ceil(s) + ' s';
  if (s < 3600) return Math.floor(s / 60) + ' min';
  return Math.floor(s / 3600) + ' h ' + Math.floor((s % 3600) / 60) + ' min';
}
