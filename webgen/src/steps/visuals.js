import { join } from 'node:path';
import { log } from '../logger.js';
import { writeJson, writeText, writeBinary, readJson } from '../util/fsx.js';
import { geminiImage } from '../services/gemini.js';
import { heroSvg, logoSvg, transitionSvg } from '../templates/art.js';

function pickDirection(directions, wanted) {
  const found = directions.directions.find((d) => d.id === wanted);
  return found || directions.directions[0];
}

function heroPrompt(brand, direction) {
  const { palette } = direction;
  return [
    `Marketing website hero image for "${brand.name}".`,
    direction.heroConcept,
    `Visual mood: ${direction.mood}`,
    `Color palette: primary ${palette.primary}, accent ${palette.accent}, background ${palette.bg}.`,
    'Wide 16:10 composition, no text, no logos, no watermarks, high detail, polished and modern.',
  ].join(' ');
}

export async function runVisuals({ workspace, directionId, config }) {
  log.step('Create hero visuals + transition motion');
  const brand = readJson(join(workspace, 'brand.json'));
  const directions = readJson(join(workspace, 'directions.json'));
  const direction = pickDirection(directions, directionId);
  log.detail('Direction', `#${direction.id} ${direction.name}`);

  const assetsDir = join(workspace, 'assets');
  const prompt = heroPrompt(brand, direction);

  // Logo + transition are always generated locally as crisp SVG.
  const logoPath = join(assetsDir, 'logo.svg');
  writeText(logoPath, logoSvg(brand.name, direction.palette));

  const transitionPath = join(assetsDir, 'transition.svg');
  writeText(transitionPath, transitionSvg(direction.palette));

  let hero = { file: 'assets/hero.svg', type: 'svg', source: 'mock' };

  if (config.gemini.apiKey) {
    try {
      const img = await geminiImage({
        apiKey: config.gemini.apiKey,
        model: config.gemini.imageModel,
        prompt,
      });
      const ext = img.mime.includes('jpeg') ? 'jpg' : 'png';
      writeBinary(
        join(assetsDir, `hero.${ext}`),
        Buffer.from(img.base64, 'base64'),
      );
      hero = { file: `assets/hero.${ext}`, type: ext, source: 'gemini' };
      log.live(`Hero image generated with ${config.gemini.imageModel}.`);
    } catch (err) {
      log.warn(`Gemini image step failed (${err.message}); using SVG hero art.`);
    }
  } else {
    log.mock('No Gemini key — generated layered SVG hero + transition art.');
  }

  if (hero.source === 'mock') {
    writeText(join(assetsDir, 'hero.svg'), heroSvg(direction.palette, brand.name));
  }

  const visuals = {
    generatedAt: new Date().toISOString(),
    directionId: direction.id,
    heroPrompt: prompt,
    hero,
    transition: { file: 'assets/transition.svg', type: 'animated-svg' },
    logo: { file: 'assets/logo.svg', type: 'svg' },
  };
  const path = join(workspace, 'visuals.json');
  writeJson(path, visuals);

  log.ok('Visuals ready.');
  log.detail('Hero', `${hero.file} (${hero.source})`);
  log.detail('Transition', visuals.transition.file);
  log.detail('Logo', visuals.logo.file);
  return visuals;
}
