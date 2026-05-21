import { join, basename, relative, sep } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { log, c } from '../logger.js';
import { writeJson, fileExists } from '../util/fsx.js';
import { vercelDeploy } from '../services/vercel.js';

const BINARY_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'ico', 'avif']);

function collectFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const abs = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else {
        const rel = relative(dir, abs).split(sep).join('/');
        const ext = entry.name.split('.').pop().toLowerCase();
        if (BINARY_EXT.has(ext)) {
          out.push({
            file: rel,
            data: readFileSync(abs).toString('base64'),
            encoding: 'base64',
          });
        } else {
          out.push({ file: rel, data: readFileSync(abs, 'utf8') });
        }
      }
    }
  };
  walk(dir);
  return out;
}

export async function runDeploy({ workspace, config }) {
  log.step('Deploy with GitHub + Vercel');
  const siteDir = join(workspace, 'site');
  if (!fileExists(join(siteDir, 'index.html'))) {
    throw new Error(`No site found at ${siteDir} — run the build step first.`);
  }

  const projectName = basename(workspace);
  writeJson(join(siteDir, 'vercel.json'), {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    cleanUrls: true,
    trailingSlash: false,
  });

  const files = collectFiles(siteDir);
  log.detail('Project', projectName);
  log.detail('Files', `${files.length} file(s) in ${siteDir}`);

  if (!config.vercel.token) {
    log.mock('No Vercel token — printing the manual GitHub + Vercel steps.');
    log.info('');
    log.info(c.bold('  To publish this site:'));
    log.info(`  ${c.dim('1.')} cd ${siteDir}`);
    log.info(`  ${c.dim('2.')} git init && git add -A && git commit -m "Initial site"`);
    log.info(`  ${c.dim('3.')} Create a GitHub repo and push it`);
    log.info(`  ${c.dim('4.')} Import the repo at https://vercel.com/new (no build step needed)`);
    log.info(`  ${c.dim('—')} or set VERCEL_TOKEN in .env and re-run for a one-command deploy.`);
    return { deployed: false, projectName, siteDir };
  }

  try {
    const result = await vercelDeploy({
      token: config.vercel.token,
      teamId: config.vercel.teamId,
      name: projectName,
      files,
    });
    log.live('Deployed to Vercel.');
    log.ok(`Live: ${result.url || '(pending)'}`);
    if (result.inspectorUrl) log.detail('Inspect', result.inspectorUrl);
    return { deployed: true, projectName, siteDir, ...result };
  } catch (err) {
    log.error(`Vercel deploy failed: ${err.message}`);
    log.info(`  The built site is ready at ${siteDir} — deploy it manually.`);
    return { deployed: false, projectName, siteDir, error: err.message };
  }
}
