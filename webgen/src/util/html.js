import { normalizeHex, isNeutral } from './color.js';

// Lightweight, dependency-free HTML scraping helpers. Regex-based on purpose:
// branding extraction only needs coarse signals (title, meta, colors, fonts).

export function decodeEntities(str = '') {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x?[0-9a-f]+;/gi, ' ')
    .trim();
}

export function stripTags(html = '') {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? m[1].trim() : '';
}

export function getTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]) : '';
}

export function getMeta(html, key) {
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metas) {
    const name = (attr(tag, 'name') || attr(tag, 'property')).toLowerCase();
    if (name === key.toLowerCase()) return decodeEntities(attr(tag, 'content'));
  }
  return '';
}

export function getHeadings(html) {
  const out = [];
  const re = /<(h[12])[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[2]);
    if (text && text.length <= 140) out.push(text);
  }
  return out;
}

export function getParagraphs(html) {
  const out = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[1]);
    if (text.length >= 40 && text.length <= 320) out.push(text);
  }
  return out;
}

// Extracts candidate brand colors, ranked by frequency, neutrals removed.
export function extractColors(html) {
  const counts = new Map();
  const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
  const rgbRe = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi;
  let m;
  while ((m = hexRe.exec(html)) !== null) {
    const hex = normalizeHex(m[0].slice(0, 7));
    if (hex) counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  while ((m = rgbRe.exec(html)) !== null) {
    const r = (+m[1]).toString(16).padStart(2, '0');
    const g = (+m[2]).toString(16).padStart(2, '0');
    const b = (+m[3]).toString(16).padStart(2, '0');
    const hex = normalizeHex(`#${r}${g}${b}`);
    if (hex) counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    .filter((hex) => !isNeutral(hex))
    .slice(0, 8);
}

const GENERIC_FONTS = new Set([
  'sans-serif', 'serif', 'monospace', 'system-ui', 'inherit',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', 'cursive', 'fantasy',
  '-apple-system', 'blinkmacsystemfont', 'arial', 'helvetica',
]);

export function extractFonts(html) {
  const fonts = new Set();
  const re = /font-family\s*:\s*([^;"'}]+)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const first = m[1].split(',')[0].trim().replace(/^["']|["']$/g, '');
    if (first && !GENERIC_FONTS.has(first.toLowerCase()) && first.length <= 40) {
      fonts.add(first);
    }
  }
  // Google Fonts <link> hrefs are a strong signal.
  const linkRe = /fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/gi;
  while ((m = linkRe.exec(html)) !== null) {
    const name = decodeURIComponent(m[1].split(':')[0]).replace(/\+/g, ' ').trim();
    if (name) fonts.add(name);
  }
  return [...fonts].slice(0, 4);
}

export function findLogo(html, baseUrl) {
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  for (const tag of imgs) {
    const src = attr(tag, 'src');
    const alt = attr(tag, 'alt').toLowerCase();
    const cls = attr(tag, 'class').toLowerCase();
    if (!src) continue;
    if (/logo|brand|wordmark/.test(`${src} ${alt} ${cls}`)) {
      return absolutize(src, baseUrl);
    }
  }
  return '';
}

export function findOgImage(html, baseUrl) {
  const og = getMeta(html, 'og:image') || getMeta(html, 'twitter:image');
  return og ? absolutize(og, baseUrl) : '';
}

export function absolutize(src, baseUrl) {
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}
