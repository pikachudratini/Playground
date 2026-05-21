import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  const text = readFileSync(path, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

// Loads .env (if present) without overriding real process env vars.
export function loadConfig(cwd = process.cwd()) {
  const fileEnv = parseEnvFile(resolve(cwd, '.env'));
  const get = (key) => {
    const v = process.env[key] ?? fileEnv[key];
    return v && String(v).trim() ? String(v).trim() : '';
  };

  return {
    firecrawl: { apiKey: get('FIRECRAWL_API_KEY') },
    gemini: {
      apiKey: get('GEMINI_API_KEY'),
      imageModel: get('GEMINI_IMAGE_MODEL') || 'gemini-2.5-flash-image-preview',
    },
    anthropic: {
      apiKey: get('ANTHROPIC_API_KEY'),
      model: get('ANTHROPIC_MODEL') || 'claude-sonnet-4-6',
    },
    vercel: {
      token: get('VERCEL_TOKEN'),
      teamId: get('VERCEL_TEAM_ID'),
    },
  };
}

// Human-readable summary of which integrations are live vs. mocked.
export function describeConfig(config) {
  return [
    ['Firecrawl', !!config.firecrawl.apiKey],
    ['Gemini', !!config.gemini.apiKey],
    ['Anthropic', !!config.anthropic.apiKey],
    ['Vercel', !!config.vercel.token],
  ];
}
