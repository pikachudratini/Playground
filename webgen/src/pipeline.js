import { join } from 'node:path';
import { log } from './logger.js';
import { runBranding } from './steps/branding.js';
import { runDirections } from './steps/directions.js';
import { runVisuals } from './steps/visuals.js';
import { runBuild } from './steps/build.js';
import { runImprove } from './steps/improve.js';
import { runDeploy } from './steps/deploy.js';

// Runs the full extract → directions → visuals → build → improve → deploy chain.
export async function runPipeline({ url, workspace, directionId, config, deploy }) {
  log.resetSteps();

  await runBranding({ url, workspace, config });
  await runDirections({ workspace, config });
  await runVisuals({ workspace, directionId, config });
  const { siteDir } = await runBuild({ workspace, directionId });
  await runImprove({ inputPath: join(siteDir, 'index.html'), config });

  let deployResult = null;
  if (deploy) {
    deployResult = await runDeploy({ workspace, config });
  } else {
    log.step('Deploy with GitHub + Vercel');
    log.info('Skipped (--no-deploy).');
  }

  return { workspace, siteDir, deployResult };
}
