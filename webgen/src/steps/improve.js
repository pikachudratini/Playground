import { log } from '../logger.js';
import { readText, writeText } from '../util/fsx.js';
import { claudeComplete } from '../services/anthropic.js';

function titleOf(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function attrSafe(text) {
  return String(text).replace(/"/g, '&quot;');
}

// Conservative, structural improvements applied without an LLM.
function deterministicImprove(html) {
  const changes = [];
  let out = html;
  const prependHead = (snippet) => {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}\n  ${snippet}`);
  };

  if (!/^\s*<!doctype/i.test(out)) {
    out = `<!doctype html>\n${out}`;
    changes.push('Added a missing <!doctype html> declaration.');
  }
  if (/<html(?![^>]*\blang=)/i.test(out)) {
    out = out.replace(/<html/i, '<html lang="en"');
    changes.push('Added lang="en" to <html> for accessibility.');
  }
  if (!/<meta\s+charset/i.test(out)) {
    prependHead('<meta charset="utf-8">');
    changes.push('Added <meta charset="utf-8">.');
  }
  if (!/name=["']viewport["']/i.test(out)) {
    prependHead('<meta name="viewport" content="width=device-width, initial-scale=1">');
    changes.push('Added a responsive viewport meta tag.');
  }
  if (!/name=["']description["']/i.test(out)) {
    const desc = titleOf(out) || 'Website';
    prependHead(`<meta name="description" content="${attrSafe(desc)}">`);
    changes.push('Added a <meta name="description"> tag for SEO.');
  }
  if (!/property=["']og:title["']/i.test(out)) {
    const title = titleOf(out) || 'Website';
    prependHead(`<meta property="og:title" content="${attrSafe(title)}">`);
    changes.push('Added an Open Graph title for richer link previews.');
  }

  let lazied = 0;
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\bloading\s*=/i.test(tag) || /hero/i.test(tag)) return tag;
    lazied += 1;
    return tag.replace(/<img\b/i, '<img loading="lazy" decoding="async"');
  });
  if (lazied > 0) {
    changes.push(`Enabled lazy-loading on ${lazied} below-the-fold image(s).`);
  }

  return { html: out, changes };
}

function extractHtmlBlock(text) {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/<!doctype html>|<html[\s>]/i);
  if (start === -1) throw new Error('No HTML document found in model response');
  return body.slice(start).trim();
}

async function claudeImprove(html, config) {
  const system =
    'You are a senior front-end engineer and UI designer. You return one complete HTML document and nothing else.';
  const prompt = `Improve this HTML page. Keep it a single self-contained file and keep all existing references to styles.css, main.js and the assets/ folder intact.

Focus on: layout polish, spacing rhythm, tasteful animation, responsive behaviour, accessibility (landmarks, alt text, focus states) and SEO meta tags. Do not remove sections or change the copy meaning.

Return ONLY the full improved HTML inside a \`\`\`html code block.

Current page:
\`\`\`html
${html}
\`\`\``;

  const text = await claudeComplete({
    apiKey: config.anthropic.apiKey,
    model: config.anthropic.model,
    system,
    prompt,
    maxTokens: 8000,
  });
  return extractHtmlBlock(text);
}

export async function runImprove({ inputPath, outputPath, config, quiet = false }) {
  if (!quiet) log.step('Improve the HTML layout');
  const original = readText(inputPath);

  let html = original;
  let source = 'mock';
  let changes = [];

  if (config.anthropic.apiKey) {
    try {
      html = await claudeImprove(original, config);
      source = 'anthropic';
      changes = ['Claude rewrote the page with layout, motion and a11y improvements.'];
      log.live('HTML improved by Claude.');
    } catch (err) {
      log.warn(`Claude improve step failed (${err.message}); using rule-based pass.`);
    }
  }

  if (source === 'mock') {
    const result = deterministicImprove(original);
    html = result.html;
    changes = result.changes;
    log.mock('Applied a rule-based HTML enhancement pass.');
  }

  const dest = outputPath || inputPath;
  writeText(dest, html);

  if (changes.length === 0) {
    log.ok('Page already well-formed — no changes needed.');
  } else {
    log.ok(`${changes.length} improvement(s) applied → ${dest}`);
    for (const change of changes) log.detail('•', change);
  }
  return { outputPath: dest, changes, source };
}
