import type { Client } from '@libsql/client';
import type { Mastra } from '@mastra/core';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import type { SubredditConfig } from '../../config/subreddits.js';
import { insertOpportunity, isSeen, markSeen } from '../../db/repository.js';
import type { LlmClient } from '../../llm/client.js';
import { scoreCandidate } from '../../llm/score.js';
import type { RedditReadClient } from '../../reddit/read-client.js';

export interface ScanDeps {
  db: Client;
  redditReadClient: RedditReadClient;
  llm: LlmClient;
  scoringModel: string;
  persona: string;
  subreddits: SubredditConfig[];
  maxOpportunitiesPerCycle: number;
  /** Lazy accessor: the scan workflow starts draft-approval runs, but the Mastra
   * instance that registers both workflows doesn't exist yet when this factory runs. */
  getMastra: () => Mastra;
}

const scanOutputSchema = z.object({ opportunitiesCreated: z.number() });

export function createScanWorkflow(deps: ScanDeps) {
  const scanStep = createStep({
    id: 'scan-and-start-drafts',
    inputSchema: z.object({}),
    outputSchema: scanOutputSchema,
    execute: async () => {
      let created = 0;

      for (const subreddit of deps.subreddits) {
        if (!subreddit.enabled) {
          continue;
        }
        created += await scanSubreddit(deps, subreddit, deps.maxOpportunitiesPerCycle - created);
        if (created >= deps.maxOpportunitiesPerCycle) {
          break;
        }
      }

      return { opportunitiesCreated: created };
    },
  });

  return createWorkflow({
    id: 'scan-subreddits',
    inputSchema: z.object({}),
    outputSchema: scanOutputSchema,
  })
    .then(scanStep)
    .commit();
}

async function scanSubreddit(
  deps: ScanDeps,
  subreddit: SubredditConfig,
  remainingBudget: number,
): Promise<number> {
  if (remainingBudget <= 0) {
    return 0;
  }

  const posts = await deps.redditReadClient.listNew(subreddit.name, 10);
  let created = 0;

  for (const post of posts) {
    if (created >= remainingBudget) {
      break;
    }
    if (await isSeen(deps.db, post.name)) {
      continue;
    }
    await markSeen(deps.db, post.name, subreddit.name);

    const score = await scoreCandidate(deps.llm, deps.scoringModel, {
      subreddit: subreddit.name,
      post,
      persona: deps.persona,
    });
    if (!score.relevant) {
      continue;
    }

    const opportunityId = crypto.randomUUID();
    await insertOpportunity(deps.db, {
      id: opportunityId,
      fullname: post.name,
      subreddit: subreddit.name,
      kind: 'comment',
      title: post.title,
      permalink: post.permalink,
      angle: score.angle,
    });

    const draftApprovalWorkflow = deps.getMastra().getWorkflow('draft-approval');
    const run = await draftApprovalWorkflow.createRun();
    await run.start({
      inputData: {
        opportunityId,
        fullname: post.name,
        subreddit: subreddit.name,
        kind: 'comment' as const,
        title: post.title,
        body: post.selftext,
        permalink: post.permalink,
        angle: score.angle,
      },
    });
    created += 1;
  }

  return created;
}
