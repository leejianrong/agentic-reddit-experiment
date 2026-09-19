import type { Client } from '@libsql/client';
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { DEFAULT_PERSONA } from '../config/persona.js';
import { SUBREDDITS } from '../config/subreddits.js';
import type { AppConfig } from '../config.js';
import { createDbClient, initSchema } from '../db/client.js';
import { type AnthropicMessagesClient, createAnthropicClient } from '../llm/client.js';
import { RedditClient } from '../reddit/client.js';
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
  redditClient?: RedditClient;
  anthropic?: AnthropicMessagesClient;
  telegramClient?: TelegramClientLike;
}

const DRAFT_APPROVAL_WORKFLOW_KEY = 'draft-approval';

export async function buildApp(
  config: AppConfig,
  overrides: BuildAppOverrides = {},
): Promise<AppRuntime> {
  const appDb = createDbClient(config.DATABASE_URL);
  await initSchema(appDb);

  const redditClient =
    overrides.redditClient ??
    new RedditClient({
      clientId: config.REDDIT_CLIENT_ID,
      clientSecret: config.REDDIT_CLIENT_SECRET,
      refreshToken: config.REDDIT_REFRESH_TOKEN,
      userAgent: config.REDDIT_USER_AGENT,
    });
  const anthropic = overrides.anthropic ?? createAnthropicClient(config.ANTHROPIC_API_KEY);
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
      return { status: 'success', outcome: result.result.outcome, detail: result.result.detail };
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
    anthropic,
    draftModel: config.ANTHROPIC_DRAFTING_MODEL,
    persona: DEFAULT_PERSONA,
    notifier: telegramAdapter,
    redditClient,
    dryRun: config.DRY_RUN,
    rateCaps: {
      commentsPerDay: config.RATE_CAP_COMMENTS_PER_DAY,
      postsPerDays: config.RATE_CAP_POST_EVERY_DAYS,
    },
  });

  const scanWorkflow = createScanWorkflow({
    db: appDb,
    redditClient,
    anthropic,
    scoringModel: config.ANTHROPIC_SCORING_MODEL,
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
