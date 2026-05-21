const clamp = (n, lo = 0, hi = 255) => Math.min(hi, Math.max(lo, n));

export function hexToRgb(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const to = (n) => clamp(Math.round(n)).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Returns a clean #rrggbb string, or null if the input is not a color.
export function normalizeHex(input) {
  const rgb = hexToRgb(input);
  return rgb ? rgbToHex(rgb) : null;
}

export function mix(a, b, t = 0.5) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return a;
  return rgbToHex({
    r: x.r + (y.r - x.r) * t,
    g: x.g + (y.g - x.g) * t,
    b: x.b + (y.b - x.b) * t,
  });
}

export const lighten = (hex, t = 0.2) => mix(hex, '#ffffff', t);
export const darken = (hex, t = 0.2) => mix(hex, '#000000', t);

export function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channels = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

// Picks black or white text for legible contrast against a background.
export function contrastText(bg) {
  return luminance(bg) > 0.42 ? '#0c0d12' : '#ffffff';
}

export function withAlpha(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  const cVal = (1 - Math.abs(2 * l - 1)) * s;
  const x = cVal * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - cVal / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [cVal, x, 0];
  else if (h < 120) [r, g, b] = [x, cVal, 0];
  else if (h < 180) [r, g, b] = [0, cVal, x];
  else if (h < 240) [r, g, b] = [0, x, cVal];
  else if (h < 300) [r, g, b] = [x, 0, cVal];
  else [r, g, b] = [cVal, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function rotateHue(hex, deg) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb);
  hsl.h = (hsl.h + deg + 360) % 360;
  return rgbToHex(hslToRgb(hsl));
}

export function saturate(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb);
  hsl.s = Math.min(1, Math.max(0, hsl.s + amount));
  return rgbToHex(hslToRgb(hsl));
}

// True when a color is close to neutral grey/black/white.
export function isNeutral(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const { s } = rgbToHsl(rgb);
  return s < 0.12;
}

// A complementary accent derived from a primary color.
export function deriveAccent(primary) {
  return saturate(rotateHue(primary, 165), 0.15);
}

// Deterministic, vivid color from an integer seed — used for synthetic brands.
export function colorFromSeed(seed, { sat = 0.64, light = 0.52 } = {}) {
  const h = ((seed % 360) + 360) % 360;
  return rgbToHex(hslToRgb({ h, s: sat, l: light }));
}

// FNV-1a string hash → unsigned 32-bit integer.
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
