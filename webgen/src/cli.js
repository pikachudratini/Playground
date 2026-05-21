import { resolve, join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { log, c } from './logger.js';
import { loadConfig, describeConfig } from './config.js';
import { workspaceFor } from './util/fsx.js';
import { runPipeline } from './pipeline.js';
import { runBranding } from './steps/branding.js';
import { runDirections } from './steps/directions.js';
import { runVisuals } from './steps/visuals.js';
import { runBuild } from './steps/build.js';
import { runImprove } from './steps/improve.js';
import { runDeploy } from './steps/deploy.js';

const VALUE_FLAGS = new Set(['workspace', 'direction', 'out']);

function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const key = arg.slice(2);
        if (VALUE_FLAGS.has(key) && argv[i + 1] && !argv[i + 1].startsWith('--')) {
          flags[key] = argv[i + 1];
          i += 1;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

// Finds the workspace folder for a step command.
function resolveWorkspace(positional, workspaceFlag) {
  if (typeof workspaceFlag === 'string') {
    return resolve(process.cwd(), workspaceFlag);
  }
  if (positional) {
    if (/^https?:\/\//i.test(positional)) return workspaceFor(positional);
    const direct = resolve(process.cwd(), positional);
    if (existsSync(direct)) return direct;
    const underOutput = resolve(process.cwd(), 'output', positional);
    if (existsSync(underOutput)) return underOutput;
    return direct;
  }
  const base = resolve(process.cwd(), 'output');
  const dirs = existsSync(base)
    ? readdirSync(base, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];
  if (dirs.length === 1) return join(base, dirs[0]);
  if (dirs.length === 0) {
    throw new Error(
      'No project found. Run "webgen branding <url>" first, or pass --workspace <dir>.',
    );
  }
  throw new Error(
    `Multiple projects in output/. Pass --workspace <dir>:\n  ${dirs.join('\n  ')}`,
  );
}

function printHeader(config) {
  const summary = describeConfig(config)
    .map(([name, live]) => `${name} ${live ? c.magenta('live') : c.dim('mock')}`)
    .join('  ·  ');
  process.stdout.write(`\n${c.bold('webgen')} ${c.dim('— AI website generator')}\n`);
  process.stdout.write(`${c.dim('integrations:')} ${summary}\n`);
}

function printHelp() {
  process.stdout.write(`
${c.bold('webgen')} — AI website generator

Pipeline: extract branding → visual directions → hero visuals →
build site → improve HTML → deploy. Every external API is optional;
missing keys fall back to a deterministic offline mock.

${c.bold('Usage')}
  webgen run <url> [options]      Run the whole pipeline
  webgen branding <url>           Extract branding assets (Firecrawl)
  webgen directions [workspace]   Generate three visual directions
  webgen visuals [workspace]      Generate hero + transition visuals
  webgen build [workspace]        Build the static site
  webgen improve <file>           Improve an existing HTML file
  webgen deploy [workspace]       Deploy the built site to Vercel

${c.bold('Options')}
  --workspace <dir>   Project folder (default: output/<slug-of-url>)
  --direction <n>     Visual direction to use, 1-3 (default: 1)
  --out <file>        Output path for "improve" (default: in place)
  --no-deploy         Skip the deploy step in "run"
  --help              Show this help

${c.bold('Examples')}
  webgen run https://stripe.com --no-deploy
  webgen run https://example.com --direction 3
  webgen branding https://linear.app
  webgen improve ./output/linear-app/site/index.html

${c.dim('Configure API keys in webgen/.env (see .env.example).')}
`);
}

export async function main(argv) {
  const { positionals, flags } = parseArgs(argv);
  const command = positionals[0];

  if (!command || command === 'help' || flags.help) {
    printHelp();
    return;
  }

  const config = loadConfig();
  printHeader(config);

  switch (command) {
    case 'run': {
      const url = positionals[1];
      if (!url) throw new Error('Usage: webgen run <url> [--direction n] [--no-deploy]');
      const workspace =
        typeof flags.workspace === 'string'
          ? resolve(process.cwd(), flags.workspace)
          : workspaceFor(url);
      const result = await runPipeline({
        url,
        workspace,
        directionId: Number(flags.direction) || 1,
        config,
        deploy: !flags['no-deploy'],
      });
      process.stdout.write(
        `\n${c.green(c.bold('Done.'))} Site at ${c.cyan(result.siteDir)}\n` +
          `${c.dim('Preview locally:')} npx serve "${result.siteDir}"\n\n`,
      );
      return;
    }
    case 'branding': {
      const url = positionals[1];
      if (!url) throw new Error('Usage: webgen branding <url> [--workspace dir]');
      const workspace =
        typeof flags.workspace === 'string'
          ? resolve(process.cwd(), flags.workspace)
          : workspaceFor(url);
      log.resetSteps();
      await runBranding({ url, workspace, config });
      return;
    }
    case 'directions': {
      log.resetSteps();
      await runDirections({
        workspace: resolveWorkspace(positionals[1], flags.workspace),
        config,
      });
      return;
    }
    case 'visuals': {
      log.resetSteps();
      await runVisuals({
        workspace: resolveWorkspace(positionals[1], flags.workspace),
        directionId: Number(flags.direction) || 1,
        config,
      });
      return;
    }
    case 'build': {
      log.resetSteps();
      await runBuild({
        workspace: resolveWorkspace(positionals[1], flags.workspace),
        directionId: Number(flags.direction) || 1,
      });
      return;
    }
    case 'improve': {
      const file = positionals[1];
      if (!file) throw new Error('Usage: webgen improve <file.html> [--out dir]');
      log.resetSteps();
      await runImprove({
        inputPath: resolve(process.cwd(), file),
        outputPath:
          typeof flags.out === 'string'
            ? resolve(process.cwd(), flags.out)
            : undefined,
        config,
      });
      return;
    }
    case 'deploy': {
      log.resetSteps();
      await runDeploy({
        workspace: resolveWorkspace(positionals[1], flags.workspace),
        config,
      });
      return;
    }
    default:
      throw new Error(`Unknown command: "${command}". Run "webgen --help".`);
  }
}
