import { join } from 'node:path';
import { log } from '../logger.js';
import { writeJson } from '../util/fsx.js';
import { firecrawlScrape, plainFetch } from '../services/firecrawl.js';
import {
  getTitle,
  getMeta,
  getHeadings,
  getParagraphs,
  extractColors,
  extractFonts,
  findLogo,
  findOgImage,
} from '../util/html.js';
import {
  normalizeHex,
  deriveAccent,
  colorFromSeed,
  hashString,
  rotateHue,
} from '../util/color.js';

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return String(url).replace(/^https?:\/\//, '').split('/')[0];
  }
}

function nameFromDomain(domain) {
  const core = domain.split('.').slice(0, -1).join(' ') || domain;
  return core
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'your', 'you', 'our', 'are', 'that', 'this',
  'from', 'all', 'can', 'get', 'has', 'have', 'into', 'more', 'now', 'new',
]);

function keywordsFrom(text, max = 8) {
  const counts = new Map();
  for (const raw of text.toLowerCase().match(/[a-z]{4,}/g) || []) {
    if (STOP.has(raw)) continue;
    counts.set(raw, (counts.get(raw) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}

// Builds a brand profile when no page content is available.
function syntheticBrand(url, domain) {
  const seed = hashString(domain);
  const primary = colorFromSeed(seed);
  const name = nameFromDomain(domain);
  return {
    name,
    tagline: `${name} — built for what's next`,
    description: `${name} helps teams move faster with a focused, modern product.`,
    colors: [primary, rotateHue(primary, 40)],
    fonts: [],
    logo: '',
    ogImage: '',
    themeColor: primary,
    headings: [],
    paragraphs: [
      `${name} brings your most important workflows into one calm, fast interface.`,
      'Ship faster with a product that gets out of your way.',
    ],
    keywords: keywordsFrom(`${name} product platform workflow team modern fast`),
    primary,
    accent: deriveAccent(primary),
  };
}

// Parses scraped HTML into a brand profile.
function parseBrand(html, metadata, url, domain) {
  const title = metadata.title || getTitle(html);
  const description =
    metadata.description ||
    getMeta(html, 'description') ||
    getMeta(html, 'og:description');
  const headings = getHeadings(html);
  const paragraphs = getParagraphs(html);
  const colors = extractColors(html);
  const themeColor = normalizeHex(getMeta(html, 'theme-color')) || '';

  const siteName =
    getMeta(html, 'og:site_name') ||
    (title ? title.split(/[|\-—:·]/)[0].trim() : '') ||
    nameFromDomain(domain);

  const primary = colors[0] || themeColor || colorFromSeed(hashString(domain));
  const accent = colors[1] || deriveAccent(primary);

  return {
    name: siteName,
    tagline: title && title !== siteName ? title : `${siteName}`,
    description: description || `${siteName} — official site.`,
    colors: colors.length ? colors : [primary, accent],
    fonts: extractFonts(html),
    logo: findLogo(html, url),
    ogImage: findOgImage(html, url),
    themeColor,
    headings: headings.slice(0, 6),
    paragraphs: paragraphs.slice(0, 6),
    keywords: keywordsFrom(
      `${title} ${description} ${headings.join(' ')} ${paragraphs.join(' ')}`,
    ),
    primary,
    accent,
  };
}

export async function runBranding({ url, workspace, config }) {
  log.step('Extract branding assets');
  log.detail('Source', url);

  let source = 'synthetic';
  let raw = { html: '', markdown: '', metadata: {} };
  const domain = domainOf(url);

  if (config.firecrawl.apiKey) {
    try {
      raw = await firecrawlScrape(url, config.firecrawl.apiKey);
      source = 'firecrawl';
      log.live('Firecrawl scrape complete.');
    } catch (err) {
      log.warn(`Firecrawl failed (${err.message}); trying a direct fetch.`);
    }
  }

  if (source === 'synthetic') {
    try {
      raw = await plainFetch(url);
      source = 'fetch';
      log.mock('No Firecrawl key — used a plain HTTP fetch instead.');
    } catch (err) {
      log.warn(`Direct fetch failed (${err.message}); synthesizing a brand.`);
    }
  }

  const profile =
    source === 'synthetic'
      ? syntheticBrand(url, domain)
      : parseBrand(raw.html, raw.metadata, url, domain);

  const brand = {
    source,
    url,
    domain,
    fetchedAt: new Date().toISOString(),
    ...profile,
  };

  const path = join(workspace, 'brand.json');
  writeJson(path, brand);

  log.ok(`Brand "${brand.name}" captured (${source}).`);
  log.detail('Palette', brand.colors.slice(0, 5).join('  '));
  log.detail('Fonts', brand.fonts.length ? brand.fonts.join(', ') : '(none found)');
  log.detail('Saved', path);
  return brand;
}
