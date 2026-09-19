import { loadConfig } from './config.js';
import { buildApp } from './mastra/index.js';

async function runScanCycle(app: Awaited<ReturnType<typeof buildApp>>): Promise<void> {
  try {
    const scanWorkflow = app.mastra.getWorkflow('scan-subreddits');
    const run = await scanWorkflow.createRun();
    const result = await run.start({ inputData: {} });
    if (result.status === 'success') {
      console.log(
        `Scan cycle complete: ${result.result.opportunitiesCreated} opportunity(ies) created.`,
      );
    } else {
      console.error(`Scan cycle did not complete successfully: ${result.status}`);
    }
  } catch (error) {
    console.error('Scan cycle failed:', error);
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  console.log(`agentic-reddit-experiment starting (DRY_RUN=${config.DRY_RUN})`);

  const app = await buildApp(config);

  void app.telegramAdapter.runForever();

  await runScanCycle(app);
  setInterval(
    () => {
      void runScanCycle(app);
    },
    config.SCAN_INTERVAL_MINUTES * 60 * 1000,
  );
}

main().catch((error: unknown) => {
  console.error('Fatal startup error:', error);
  process.exitCode = 1;
});
