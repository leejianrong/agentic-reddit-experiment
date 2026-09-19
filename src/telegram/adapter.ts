import type { Client } from '@libsql/client';
import {
  deletePendingApproval,
  getPendingApproval,
  savePendingApproval,
} from '../db/repository.js';
import type {
  ApprovalRequestPayload,
  DraftNotifier,
  DraftResumeAction,
  DraftResumeResult,
} from '../workflow-types.js';
import type { TelegramClientLike } from './client.js';
import type { TelegramCallbackQuery, TelegramMessage, TelegramUpdate } from './types.js';

const RETRY_BACKOFF_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ResumeFn = (runId: string, action: DraftResumeAction) => Promise<DraftResumeResult>;

const outcomeLabels: Record<string, string> = {
  'ready-to-post': '✅ Ready — copy this to Reddit yourself:',
  rejected: '❌ Rejected',
  failed: '⚠️ Failed',
};

export class TelegramApprovalAdapter implements DraftNotifier {
  constructor(
    private readonly client: TelegramClientLike,
    private readonly chatId: string,
    private readonly db: Client,
    private readonly resume: ResumeFn,
  ) {}

  async sendApprovalRequest(payload: ApprovalRequestPayload): Promise<void> {
    const message = await this.client.sendMessage(this.chatId, formatDraftMessage(payload), [
      [
        { text: '✅ Approve', callback_data: `approve:${payload.runId}` },
        { text: '❌ Reject', callback_data: `reject:${payload.runId}` },
      ],
    ]);
    await savePendingApproval(this.db, message.message_id, payload.runId);
  }

  /** Processes one batch of updates and returns the next offset to poll from. */
  async pollOnce(offset: number): Promise<number> {
    const updates = await this.client.getUpdates(offset, 30);
    for (const update of updates) {
      await this.handleUpdate(update);
    }
    const last = updates.at(-1);
    return last ? last.update_id + 1 : offset;
  }

  async runForever(startOffset = 0): Promise<never> {
    let offset = startOffset;
    for (;;) {
      try {
        offset = await this.pollOnce(offset);
      } catch (error) {
        console.error('Telegram poll failed, backing off before retrying:', error);
        await sleep(RETRY_BACKOFF_MS);
      }
    }
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return;
    }
    if (update.message?.reply_to_message && update.message.text) {
      await this.handleEditReply(update.message);
    }
  }

  private async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    const [action, runId] = (query.data ?? '').split(':');
    if (!runId || (action !== 'approve' && action !== 'reject')) {
      await this.client.answerCallbackQuery(query.id);
      return;
    }

    await this.client.answerCallbackQuery(query.id, action === 'approve' ? 'Approved' : 'Rejected');

    if (query.message) {
      const statusLine = action === 'approve' ? '\n\n✅ Approved' : '\n\n❌ Rejected';
      await this.client.editMessageText(
        query.message.chat.id,
        query.message.message_id,
        `${query.message.text ?? ''}${statusLine}`,
      );
      await deletePendingApproval(this.db, query.message.message_id);
    }

    const result = await this.resume(runId, { action });
    if (query.message) {
      await this.sendOutcomeFollowUp(query.message.chat.id, result);
    }
  }

  private async handleEditReply(message: TelegramMessage): Promise<void> {
    const replyToId = message.reply_to_message?.message_id;
    if (!replyToId || !message.text) {
      return;
    }
    const pending = await getPendingApproval(this.db, replyToId);
    if (!pending) {
      return;
    }
    await deletePendingApproval(this.db, replyToId);
    await this.resume(pending.runId, { action: 'edit', feedback: message.text });
  }

  private async sendOutcomeFollowUp(
    chatId: string | number,
    result: DraftResumeResult,
  ): Promise<void> {
    if (result.status === 'suspended') {
      return; // an edit round re-suspended and already sent its own new draft message
    }
    const label = result.outcome ? (outcomeLabels[result.outcome] ?? result.outcome) : 'Done';
    const warning = result.warning ? `\n\n⚠️ ${result.warning}` : '';
    const detail = result.detail ? `\n\n${result.detail}` : '';
    await this.client.sendMessage(String(chatId), `${label}${detail}${warning}`);
  }
}

function formatDraftMessage(payload: ApprovalRequestPayload): string {
  return (
    `r/${payload.subreddit} — ${payload.kind}\n` +
    `${payload.title}\n` +
    `${payload.permalink}\n\n` +
    `Why: ${payload.angle}\n\n` +
    `---\n${payload.text}`
  );
}
