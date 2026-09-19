import type { Client } from '@libsql/client';
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { DEFAULT_PERSONA } from '../config/persona.js';
import { SUBREDDITS } from '../config/subreddits.js';
import type { AppConfig } from '../config.js';
import { createDbClient, initSchema } from '../db/client.js';
import { createLlmClient, type LlmClient } from '../llm/client.js';
import { RedditClient } from '../reddit/client.js';
import type { RedditReadClient } from '../reddit/read-client.js';
import { RedlibClient } from '../reddit/redlib-client.js';
import { TelegramApprovalAdapter } from '../telegram/adapter.js';
import { TelegramClient, type TelegramClientLike } from '../telegram/client.js';
import type { DraftResumeAction, DraftResumeResult } from '../workflow-types.js';
import { createDraftApprovalWorkflow } from './workflows/draft-approval.js';
import { createScanWorkflow } from './workflows/scan.js';

export interface AppRuntime {
  mastra: Mastra;
  telegramAdapter: TelegramApprovalAdapter;
  appDb: Client;
}

/** Test seam: override any of the network-facing clients instead of building them from config. */
export interface BuildAppOverrides {
  redditReadClient?: RedditReadClient;
  llm?: LlmClient;
  telegramClient?: TelegramClientLike;
}

const DRAFT_APPROVAL_WORKFLOW_KEY = 'draft-approval';

export async function buildApp(
  config: AppConfig,
  overrides: BuildAppOverrides = {},
): Promise<AppRuntime> {
  const appDb = createDbClient(config.DATABASE_URL);
  await initSchema(appDb);

  const redditReadClient = overrides.redditReadClient ?? buildRedditReadClient(config);
  const llm = overrides.llm ?? createLlmClient(config.OPENROUTER_API_KEY);
  const telegramClient = overrides.telegramClient ?? new TelegramClient(config.TELEGRAM_BOT_TOKEN);

  // `mastra` isn't constructed until below, but the scan workflow and the
  // Telegram resume path both need to look workflows up on it. This closure
  // reads the binding at call time, once it's been assigned.
  let mastra: Mastra;
  const getMastra = (): Mastra => mastra;

  const resume = async (runId: string, action: DraftResumeAction): Promise<DraftResumeResult> => {
    const workflow = getMastra().getWorkflow(DRAFT_APPROVAL_WORKFLOW_KEY);
    const run = await workflow.createRun({ runId });
    const result = await run.resume({ resumeData: action });

    if (result.status === 'success') {
      return {
        status: 'success',
        outcome: result.result.outcome,
        detail: result.result.detail,
        warning: result.result.warning,
      };
    }
    if (result.status === 'suspended') {
      return { status: 'suspended' };
    }
    return { status: 'failed', detail: 'error' in result ? result.error.message : undefined };
  };

  const telegramAdapter = new TelegramApprovalAdapter(
    telegramClient,
    config.TELEGRAM_CHAT_ID,
    appDb,
    resume,
  );

  const draftApprovalWorkflow = createDraftApprovalWorkflow({
    db: appDb,
    llm,
    draftModel: config.DRAFTING_MODEL,
    persona: DEFAULT_PERSONA,
    notifier: telegramAdapter,
    redditReadClient,
  });

  const scanWorkflow = createScanWorkflow({
    db: appDb,
    redditReadClient,
    llm,
    scoringModel: config.SCORING_MODEL,
    persona: DEFAULT_PERSONA,
    subreddits: SUBREDDITS,
    maxOpportunitiesPerCycle: config.MAX_OPPORTUNITIES_PER_CYCLE,
    getMastra,
  });

  mastra = new Mastra({
    workflows: {
      [DRAFT_APPROVAL_WORKFLOW_KEY]: draftApprovalWorkflow,
      'scan-subreddits': scanWorkflow,
    },
    storage: new LibSQLStore({ id: 'mastra-storage', url: config.DATABASE_URL }),
  });

  return { mastra, telegramAdapter, appDb };
}

/**
 * Official Reddit OAuth access when configured (better reliability, and
 * required if automated publishing is ever revisited); otherwise Redlib
 * (ADR-0009), which needs no credentials at all. `loadConfig` guarantees at
 * least one of these is available.
 */
function buildRedditReadClient(config: AppConfig): RedditReadClient {
  if (config.REDDIT_CLIENT_ID && config.REDDIT_CLIENT_SECRET && config.REDDIT_REFRESH_TOKEN) {
    return new RedditClient({
      clientId: config.REDDIT_CLIENT_ID,
      clientSecret: config.REDDIT_CLIENT_SECRET,
      refreshToken: config.REDDIT_REFRESH_TOKEN,
      userAgent: config.REDDIT_USER_AGENT ?? 'agentic-reddit-experiment/0.0.0',
    });
  }
  if (!config.REDLIB_URL) {
    throw new Error(
      'No Reddit read source configured — this should have been caught by loadConfig.',
    );
  }
  return new RedlibClient(config.REDLIB_URL);
}
