import { join } from 'node:path';
import { log } from '../logger.js';
import { writeJson, readJson } from '../util/fsx.js';
import { claudeComplete, extractJson } from '../services/anthropic.js';
import {
  darken,
  lighten,
  mix,
  withAlpha,
  saturate,
  contrastText,
} from '../util/color.js';

// Three creative archetypes used when Claude is not available.
const ARCHETYPES = [
  {
    name: 'Midnight Editorial',
    mood: 'Confident and premium — a dark canvas, oversized serif headlines, generous whitespace.',
    motion: 'Slow cinematic fades and gentle parallax (600–900ms ease-out).',
    heroConcept:
      'A moody, high-contrast hero with a single focal object lit dramatically against deep shadow.',
    headingFont: 'Fraunces',
    bodyFont: 'Inter',
    paletteKind: 'dark',
  },
  {
    name: 'Bright Minimal',
    mood: 'Clean and trustworthy — a light layout, crisp geometric type, lots of breathing room.',
    motion: 'Short, snappy transitions (180–260ms) with a precise cubic-bezier.',
    heroConcept:
      'An airy, well-lit hero with a clean product shot or abstract geometric composition on white.',
    headingFont: 'Space Grotesk',
    bodyFont: 'Inter',
    paletteKind: 'light',
  },
  {
    name: 'Vivid Gradient',
    mood: 'Energetic and modern — saturated gradients, bold type, a playful sense of motion.',
    motion: 'Springy entrances with slight overshoot and animated gradient shifts.',
    heroConcept:
      'A vibrant gradient hero with layered translucent shapes and a strong, glowing focal point.',
    headingFont: 'Sora',
    bodyFont: 'Inter',
    paletteKind: 'vivid',
  },
];

function buildPalette(kind, primary, accent) {
  if (kind === 'light') {
    return {
      kind,
      bg: '#ffffff',
      surface: mix('#ffffff', primary, 0.045),
      surfaceAlt: mix('#ffffff', primary, 0.09),
      text: '#13151a',
      muted: '#5b6270',
      border: mix('#e6e8ec', primary, 0.08),
      primary,
      accent,
      onPrimary: contrastText(primary),
    };
  }
  if (kind === 'vivid') {
    const p = saturate(primary, 0.12);
    const bg = mix(darken(primary, 0.62), '#101018', 0.55);
    return {
      kind,
      bg,
      surface: lighten(bg, 0.08),
      surfaceAlt: lighten(bg, 0.13),
      text: '#fbfbfd',
      muted: mix('#fbfbfd', bg, 0.5),
      border: withAlpha('#ffffff', 0.12),
      primary: p,
      accent: saturate(accent, 0.12),
      onPrimary: contrastText(p),
    };
  }
  // dark (default)
  const bg = mix(darken(primary, 0.8), '#0a0b10', 0.72);
  return {
    kind: 'dark',
    bg,
    surface: lighten(bg, 0.06),
    surfaceAlt: lighten(bg, 0.11),
    text: '#f4f5f8',
    muted: mix('#f4f5f8', bg, 0.52),
    border: lighten(bg, 0.15),
    primary,
    accent,
    onPrimary: contrastText(primary),
  };
}

const FONT_STACKS = {
  serif: '"Times New Roman", Georgia, serif',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

function fontStack(name) {
  const serif = /fraunces|playfair|lora|serif|garamond|merriweather/i.test(name);
  return `"${name}", ${serif ? FONT_STACKS.serif : FONT_STACKS.sans}`;
}

function assembleDirection(id, spec, brand) {
  const kind = ['dark', 'light', 'vivid'].includes(spec.paletteKind)
    ? spec.paletteKind
    : 'dark';
  // Prefer fonts discovered on the original site for the heading.
  const headingName = brand.fonts?.[0] || spec.headingFont;
  const bodyName = spec.bodyFont;
  return {
    id,
    name: spec.name,
    mood: spec.mood,
    motion: spec.motion,
    heroConcept: spec.heroConcept,
    palette: buildPalette(kind, brand.primary, brand.accent),
    typography: {
      heading: fontStack(headingName),
      body: fontStack(bodyName),
      googleFonts: [...new Set([headingName, bodyName])],
    },
  };
}

async function claudeDirections(brand, config) {
  const system =
    'You are a senior brand and web art director. You return only valid JSON.';
  const prompt = `Given this brand profile, propose THREE distinct visual directions for its marketing website.

Brand profile:
${JSON.stringify(
  {
    name: brand.name,
    description: brand.description,
    keywords: brand.keywords,
    colors: brand.colors,
    fonts: brand.fonts,
  },
  null,
  2,
)}

Return a JSON object of this exact shape:
{
  "directions": [
    {
      "name": "short evocative name",
      "mood": "one sentence on the feeling and layout",
      "motion": "one sentence describing animation style",
      "heroConcept": "one sentence describing the hero visual to generate",
      "headingFont": "a Google Font family name",
      "bodyFont": "a Google Font family name",
      "paletteKind": "dark | light | vivid"
    }
  ]
}
Make the three directions genuinely different from each other. Return JSON only.`;

  const text = await claudeComplete({
    apiKey: config.anthropic.apiKey,
    model: config.anthropic.model,
    system,
    prompt,
    maxTokens: 1500,
  });
  const parsed = extractJson(text);
  const list = parsed.directions;
  if (!Array.isArray(list) || list.length < 3) {
    throw new Error('Claude did not return three directions');
  }
  return list.slice(0, 3).map((d) => ({
    name: String(d.name || 'Untitled'),
    mood: String(d.mood || ''),
    motion: String(d.motion || ''),
    heroConcept: String(d.heroConcept || ''),
    headingFont: String(d.headingFont || 'Inter'),
    bodyFont: String(d.bodyFont || 'Inter'),
    paletteKind: d.paletteKind,
  }));
}

export async function runDirections({ workspace, config }) {
  log.step('Generate visual directions');
  const brand = readJson(join(workspace, 'brand.json'));

  let specs = ARCHETYPES;
  let source = 'mock';

  if (config.anthropic.apiKey) {
    try {
      specs = await claudeDirections(brand, config);
      source = 'anthropic';
      log.live('Directions written by Claude.');
    } catch (err) {
      log.warn(`Claude direction step failed (${err.message}); using archetypes.`);
    }
  } else {
    log.mock('No Anthropic key — using three built-in archetypes.');
  }

  const directions = specs.map((spec, i) => assembleDirection(i + 1, spec, brand));
  const result = { source, generatedAt: new Date().toISOString(), directions };

  const path = join(workspace, 'directions.json');
  writeJson(path, result);

  for (const d of directions) {
    log.detail(`#${d.id}`, `${d.name} — ${d.palette.kind} · ${d.mood}`);
  }
  log.ok(`${directions.length} directions saved to ${path}`);
  return result;
}
