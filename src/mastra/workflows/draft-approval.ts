import type { Client } from '@libsql/client';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { insertDraft, insertDraftOutcome, updateDraft } from '../../db/repository.js';
import type { LlmClient } from '../../llm/client.js';
import { draftContent, redraftContent } from '../../llm/draft.js';
import type { RedditReadClient } from '../../reddit/read-client.js';
import type { DraftNotifier } from '../../workflow-types.js';

export interface DraftApprovalDeps {
  db: Client;
  llm: LlmClient;
  draftModel: string;
  persona: string;
  notifier: DraftNotifier;
  redditReadClient: RedditReadClient;
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
  outcome: z.enum(['ready-to-post', 'rejected']),
  detail: z.string().optional(),
  warning: z.string().optional(),
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
        const text = await draftContent(deps.llm, deps.draftModel, context);
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
        deps.llm,
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

  // Named "finalize", not "publish": the app never calls Reddit's write API
  // (ADR-0010) — this step just hands the approved text back for the human
  // to paste into Reddit themselves, with a best-effort staleness warning.
  const finalizeStep = createStep({
    id: 'finalize',
    inputSchema: draftOutputSchema,
    outputSchema: publishOutputSchema,
    execute: async ({ inputData, getInitData }) => {
      if (!inputData.approved) {
        await insertDraftOutcome(deps.db, { draftId: inputData.draftId, outcome: 'rejected' });
        return { outcome: 'rejected' as const };
      }

      const opportunity = getInitData<OpportunityInput>();

      let warning: string | undefined;
      if (deps.redditReadClient.getThreadState) {
        const threadState = await deps.redditReadClient
          .getThreadState(opportunity.fullname)
          .catch(() => null);
        if (!threadState || threadState.locked) {
          warning = 'Heads up: this thread may be gone or locked now — check before posting.';
        }
      }

      await insertDraftOutcome(deps.db, {
        draftId: inputData.draftId,
        outcome: 'ready-to-post',
        detail: inputData.text,
        warning,
      });
      return { outcome: 'ready-to-post' as const, detail: inputData.text, warning };
    },
  });

  return createWorkflow({
    id: 'draft-approval',
    inputSchema: opportunityInputSchema,
    outputSchema: publishOutputSchema,
  })
    .then(draftStep)
    .then(finalizeStep)
    .commit();
}
