import { loadConfig } from './config.js';

function main(): void {
  const config = loadConfig();
  console.log(`agentic-reddit-experiment starting (DRY_RUN=${config.DRY_RUN})`);
  console.log('Scan/draft/approval workflow not wired up yet — see SLICES.md V1.');
}

main();
