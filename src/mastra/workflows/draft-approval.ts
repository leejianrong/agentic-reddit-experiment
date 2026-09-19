import type { Client } from '@libsql/client';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import {
  countRealPublishesSince,
  insertDraft,
  insertPostingRecord,
  updateDraft,
} from '../../db/repository.js';
import type { AnthropicMessagesClient } from '../../llm/client.js';
import { draftContent, redraftContent } from '../../llm/draft.js';
import type { RedditClient } from '../../reddit/client.js';
import type { DraftNotifier } from '../../workflow-types.js';

export interface RateCaps {
  commentsPerDay: number;
  postsPerDays: number;
}

export interface DraftApprovalDeps {
  db: Client;
  anthropic: AnthropicMessagesClient;
  draftModel: string;
  persona: string;
  notifier: DraftNotifier;
  redditClient: RedditClient;
  dryRun: boolean;
  rateCaps: RateCaps;
}

export const opportunityInputSchema = z.object({
  opportunityId: z.string(),
  fullname: z.string(),
  subreddit: z.string(),
  kind: z.enum(['comment', 'post']),
  title: z.string(),
  body: z.string().default(''),
  permalink: z.string(),
  angle: z.string(),
});
export type OpportunityInput = z.infer<typeof opportunityInputSchema>;

const draftOutputSchema = z.object({
  draftId: z.string(),
  text: z.string(),
  approved: z.boolean(),
});

const suspendSchema = z.object({
  draftId: z.string(),
  text: z.string(),
  version: z.number(),
});

const resumeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject') }),
  z.object({ action: z.literal('edit'), feedback: z.string() }),
]);

export const publishOutputSchema = z.object({
  outcome: z.enum(['published', 'dry-run', 'rejected', 'skipped-stale', 'rate-limited']),
  detail: z.string().optional(),
});

export function createDraftApprovalWorkflow(deps: DraftApprovalDeps) {
  const draftStep = createStep({
    id: 'draft-and-await-approval',
    inputSchema: opportunityInputSchema,
    outputSchema: draftOutputSchema,
    resumeSchema,
    suspendSchema,
    execute: async ({ inputData, resumeData, suspend, suspendData, runId }) => {
      const context = {
        subreddit: inputData.subreddit,
        kind: inputData.kind,
        title: inputData.title,
        body: inputData.body,
        angle: inputData.angle,
        persona: deps.persona,
      };

      if (!resumeData) {
        const text = await draftContent(deps.anthropic, deps.draftModel, context);
        const draftId = crypto.randomUUID();
        await insertDraft(deps.db, {
          id: draftId,
          opportunityId: inputData.opportunityId,
          runId,
          text,
          version: 1,
          status: 'pending',
        });
        await deps.notifier.sendApprovalRequest({
          runId,
          subreddit: inputData.subreddit,
          kind: inputData.kind,
          title: inputData.title,
          permalink: inputData.permalink,
          angle: inputData.angle,
          text,
        });
        return suspend({ draftId, text, version: 1 });
      }

      if (!suspendData) {
        throw new Error('Resumed without prior suspend data');
      }

      if (resumeData.action === 'reject') {
        await updateDraft(deps.db, suspendData.draftId, { status: 'rejected' });
        return { draftId: suspendData.draftId, text: suspendData.text, approved: false };
      }

      if (resumeData.action === 'approve') {
        await updateDraft(deps.db, suspendData.draftId, { status: 'approved' });
        return { draftId: suspendData.draftId, text: suspendData.text, approved: true };
      }

      const newText = await redraftContent(
        deps.anthropic,
        deps.draftModel,
        context,
        suspendData.text,
        resumeData.feedback,
      );
      const newVersion = suspendData.version + 1;
      await updateDraft(deps.db, suspendData.draftId, { text: newText, version: newVersion });
      await deps.notifier.sendApprovalRequest({
        runId,
        subreddit: inputData.subreddit,
        kind: inputData.kind,
        title: inputData.title,
        permalink: inputData.permalink,
        angle: inputData.angle,
        text: newText,
      });
      return suspend({ draftId: suspendData.draftId, text: newText, version: newVersion });
    },
  });

  const publishStep = createStep({
    id: 'publish',
    inputSchema: draftOutputSchema,
    outputSchema: publishOutputSchema,
    execute: async ({ inputData, getInitData }) => {
      if (!inputData.approved) {
        return { outcome: 'rejected' as const };
      }

      const opportunity = getInitData<OpportunityInput>();

      const threadState = await deps.redditClient.getThreadState(opportunity.fullname);
      if (!threadState || threadState.locked) {
        await insertPostingRecord(deps.db, {
          draftId: inputData.draftId,
          outcome: 'skipped-stale',
          dryRun: deps.dryRun,
        });
        return { outcome: 'skipped-stale' as const, detail: 'Thread is gone or locked' };
      }

      const isComment = opportunity.kind === 'comment';
      const windowMs = (isComment ? 1 : deps.rateCaps.postsPerDays) * 24 * 60 * 60 * 1000;
      const cap = isComment ? deps.rateCaps.commentsPerDay : 1;
      const recentCount = await countRealPublishesSince(
        deps.db,
        opportunity.kind,
        Date.now() - windowMs,
      );
      if (recentCount >= cap) {
        await insertPostingRecord(deps.db, {
          draftId: inputData.draftId,
          outcome: 'rate-limited',
          dryRun: deps.dryRun,
        });
        return { outcome: 'rate-limited' as const };
      }

      if (deps.dryRun) {
        await insertPostingRecord(deps.db, {
          draftId: inputData.draftId,
          outcome: 'dry-run',
          dryRun: true,
          detail: inputData.text,
        });
        return { outcome: 'dry-run' as const, detail: inputData.text };
      }

      const result = isComment
        ? await deps.redditClient.submitComment(opportunity.fullname, inputData.text)
        : await deps.redditClient.submitPost(
            opportunity.subreddit,
            opportunity.title,
            inputData.text,
          );

      await insertPostingRecord(deps.db, {
        draftId: inputData.draftId,
        outcome: 'published',
        dryRun: false,
        redditFullname: result.name,
      });
      return { outcome: 'published' as const, detail: result.name };
    },
  });

  return createWorkflow({
    id: 'draft-approval',
    inputSchema: opportunityInputSchema,
    outputSchema: publishOutputSchema,
  })
    .then(draftStep)
    .then(publishStep)
    .commit();
}
