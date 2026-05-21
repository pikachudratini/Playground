import { join, basename } from 'node:path';
import { log } from '../logger.js';
import { readJson, writeText, copyFile } from '../util/fsx.js';
import { renderSite } from '../templates/site.js';
import { hashString } from '../util/color.js';

const MOTION = {
  light: { duration: '0.22s', easing: 'cubic-bezier(.2,.7,.2,1)', revealY: '14px' },
  dark: { duration: '0.5s', easing: 'cubic-bezier(.16,1,.3,1)', revealY: '26px' },
  vivid: { duration: '0.42s', easing: 'cubic-bezier(.34,1.4,.64,1)', revealY: '30px' },
};

const LEAD_INS = [
  'The new standard for',
  'A brighter home for',
  'Built around',
  'Say hello to',
  'The modern face of',
];

const FEATURE_TITLES = [
  'Designed with intent',
  'Fast by default',
  'Ready to ship',
];

function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function truncate(text, max) {
  const s = clean(text);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

// Drops a leading "Brand — " / "Brand: " prefix so titles don't repeat it.
function stripBrandPrefix(text, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return clean(text).replace(new RegExp(`^${escaped}\\s*[—\\-:|·]+\\s*`, 'i'), '');
}

function pickDirection(directions, wanted) {
  return directions.directions.find((d) => d.id === wanted) || directions.directions[0];
}

function buildHeadline(brand) {
  const real = (brand.headings || []).find(
    (h) => h.length >= 14 && h.length <= 70 && clean(h) !== clean(brand.name),
  );
  if (real) {
    const words = clean(real).split(' ');
    if (words.length <= 3) return { pre: '', emphasis: real };
    const emphasisCount = Math.max(1, Math.round(words.length * 0.4));
    return {
      pre: words.slice(0, words.length - emphasisCount).join(' '),
      emphasis: words.slice(words.length - emphasisCount).join(' '),
    };
  }
  const lead = LEAD_INS[hashString(brand.domain) % LEAD_INS.length];
  return { pre: lead, emphasis: brand.name };
}

function buildFeatures(brand) {
  const realParas =
    brand.source !== 'synthetic' ? brand.paragraphs || [] : [];
  const fallbackBodies = [
    `Every screen in the ${brand.name} experience is considered — clean layouts, clear hierarchy, nothing in your way.`,
    `${brand.name} stays quick as you grow, so your momentum never depends on waiting.`,
    'Launch with confidence: a polished, responsive experience that looks right on every device.',
  ];
  return FEATURE_TITLES.map((title, i) => ({
    title,
    body: realParas[i] ? truncate(realParas[i], 165) : fallbackBodies[i],
  }));
}

function buildModel(brand, direction, visuals) {
  const headline = buildHeadline(brand);
  const subhead =
    truncate(brand.description, 150) ||
    truncate((brand.paragraphs || [])[0], 150) ||
    `${brand.name} brings your team a faster, calmer way to work.`;
  const tagline = stripBrandPrefix(brand.tagline || '', brand.name);
  const eyebrow =
    tagline && clean(tagline) !== clean(brand.name)
      ? truncate(tagline, 46)
      : 'Built for modern teams';

  return {
    brand: { name: brand.name, domain: brand.domain, url: brand.url },
    meta: {
      title: `${brand.name} — ${truncate(tagline || brand.description, 60)}`,
      description: subhead,
    },
    year: new Date().getFullYear(),
    directionName: direction.name,
    palette: direction.palette,
    typography: direction.typography,
    motion: MOTION[direction.palette.kind] || MOTION.dark,
    assets: {
      hero: visuals.hero.file,
      transition: visuals.transition.file,
    },
    nav: [
      { label: 'Features', href: '#features' },
      { label: 'In motion', href: '#showcase' },
    ],
    copy: {
      eyebrow,
      headlinePre: headline.pre,
      headlineEmphasis: headline.emphasis,
      subhead,
      primaryCta: { label: 'Get started', href: '#start' },
      secondaryCta: { label: 'See features', href: '#features' },
      featuresEyebrow: `Why ${brand.name}`,
      featuresTitle: `What makes ${brand.name} different`,
      featuresIntro: 'A few of the things people notice first.',
      features: buildFeatures(brand),
      showcase: {
        eyebrow: 'In motion',
        title: 'Designed to move',
        body: `Considered transitions and motion — the ${direction.name} direction, brought to life.`,
      },
      closing: {
        title: `Ready to see ${brand.name} in action?`,
        body: `Start exploring today and bring the ${brand.name} experience to your audience.`,
        cta: { label: `Visit ${brand.domain}`, href: brand.url },
      },
    },
  };
}

export async function runBuild({ workspace, directionId }) {
  log.step('Build the website structure');
  const brand = readJson(join(workspace, 'brand.json'));
  const directions = readJson(join(workspace, 'directions.json'));
  const visuals = readJson(join(workspace, 'visuals.json'));
  const direction = pickDirection(directions, directionId);

  const model = buildModel(brand, direction, visuals);
  const { html, css, js } = renderSite(model);

  const siteDir = join(workspace, 'site');
  writeText(join(siteDir, 'index.html'), html);
  writeText(join(siteDir, 'styles.css'), css);
  writeText(join(siteDir, 'main.js'), js);

  // Make the site folder self-contained for deployment.
  const assetsSrc = join(workspace, 'assets');
  const assetsDest = join(siteDir, 'assets');
  for (const file of [
    basename(visuals.hero.file),
    basename(visuals.transition.file),
    basename(visuals.logo.file),
  ]) {
    copyFile(join(assetsSrc, file), join(assetsDest, file));
  }

  log.ok(`Static site built with the "${direction.name}" direction.`);
  log.detail('Output', siteDir);
  log.detail('Pages', 'index.html (hero · features · showcase · cta)');
  return { siteDir, model };
}
