import { withAlpha, lighten, darken } from '../util/color.js';

// All generators below return self-contained SVG markup. SVG keeps the
// pipeline dependency-free and gives crisp, deterministic placeholder art
// when the Gemini image API is not configured.

export function initialsOf(name) {
  const words = String(name || 'W')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'W';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function logoSvg(name, palette) {
  const initials = initialsOf(name);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="${name} logo">
  <defs>
    <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.primary}"/>
      <stop offset="1" stop-color="${palette.accent}"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="108" height="108" rx="26" fill="url(#lg)"/>
  <text x="60" y="60" dy="0.36em" text-anchor="middle"
    font-family="Inter, -apple-system, Segoe UI, sans-serif" font-size="46"
    font-weight="700" fill="${palette.onPrimary}">${initials}</text>
</svg>`;
}

export function heroSvg(palette, label = '') {
  const { bg, surfaceAlt, primary, accent, muted } = palette;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" role="img" aria-label="${label || 'Hero visual'}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${lighten(bg, 0.04)}"/>
      <stop offset="1" stop-color="${darken(surfaceAlt, 0.05)}"/>
    </linearGradient>
    <radialGradient id="glowA" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${withAlpha(primary, 0.95)}"/>
      <stop offset="1" stop-color="${withAlpha(primary, 0)}"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${withAlpha(accent, 0.9)}"/>
      <stop offset="1" stop-color="${withAlpha(accent, 0)}"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="34"/></filter>
  </defs>
  <rect width="1600" height="1000" fill="url(#bg)"/>
  <g opacity="0.5">
    <ellipse cx="470" cy="360" rx="430" ry="430" fill="url(#glowA)" filter="url(#soft)"/>
    <ellipse cx="1180" cy="690" rx="500" ry="500" fill="url(#glowB)" filter="url(#soft)"/>
  </g>
  <g fill="none" stroke="${withAlpha(muted, 0.16)}" stroke-width="1.4">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 200}" y1="0" x2="${i * 200}" y2="1000"/>`).join('\n    ')}
    ${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${i * 200}" x2="1600" y2="${i * 200}"/>`).join('\n    ')}
  </g>
  <g transform="translate(800 500)">
    <circle r="232" fill="none" stroke="${withAlpha(accent, 0.55)}" stroke-width="2"/>
    <circle r="168" fill="none" stroke="${withAlpha(primary, 0.7)}" stroke-width="2"/>
    <rect x="-118" y="-118" width="236" height="236" rx="44"
      fill="${withAlpha(primary, 0.16)}" stroke="${withAlpha(accent, 0.8)}" stroke-width="2.5"
      transform="rotate(45)"/>
    <circle r="58" fill="${accent}"/>
  </g>
</svg>`;
}

// An animated SVG that loops — stands in for the "transition video" asset.
export function transitionSvg(palette) {
  const { bg, primary, accent, surfaceAlt } = palette;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 500" role="img" aria-label="Transition motion asset">
  <defs>
    <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${primary}">
        <animate attributeName="stop-color" values="${primary};${accent};${primary}" dur="6s" repeatCount="indefinite"/>
      </stop>
      <stop offset="1" stop-color="${accent}">
        <animate attributeName="stop-color" values="${accent};${primary};${accent}" dur="6s" repeatCount="indefinite"/>
      </stop>
    </linearGradient>
  </defs>
  <rect width="1600" height="500" fill="${darken(bg, 0.04)}"/>
  <rect width="1600" height="500" fill="url(#sweep)" opacity="0.22"/>
  ${Array.from({ length: 5 }, (_, i) => {
    const cx = 180 + i * 320;
    const dur = 4 + i * 0.7;
    return `<circle cx="${cx}" cy="250" r="${36 + i * 10}" fill="${withAlpha(i % 2 ? accent : primary, 0.55)}">
    <animate attributeName="cy" values="250;${180 + i * 14};250" dur="${dur}s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.25;0.7;0.25" dur="${dur}s" repeatCount="indefinite"/>
  </circle>`;
  }).join('\n  ')}
  <rect x="0" y="486" width="1600" height="14" fill="${surfaceAlt}"/>
</svg>`;
}
