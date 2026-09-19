import type { Client } from '@libsql/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDbClient, initSchema } from '../../src/db/client.js';
import { getPendingApproval } from '../../src/db/repository.js';
import { TelegramApprovalAdapter } from '../../src/telegram/adapter.js';
import type { TelegramClientLike } from '../../src/telegram/client.js';
import type { TelegramUpdate } from '../../src/telegram/types.js';

function fakeTelegramClient(): TelegramClientLike & {
  sent: { chatId: string; text: string }[];
  edits: { messageId: number; text: string }[];
} {
  let nextMessageId = 100;
  const sent: { chatId: string; text: string }[] = [];
  const edits: { messageId: number; text: string }[] = [];
  return {
    sent,
    edits,
    sendMessage: vi.fn(async (chatId: string, text: string) => {
      sent.push({ chatId, text });
      return { message_id: nextMessageId++, chat: { id: chatId } };
    }),
    editMessageText: vi.fn(async (_chatId, messageId: number, text: string) => {
      edits.push({ messageId, text });
    }),
    answerCallbackQuery: vi.fn(async () => {}),
    getUpdates: vi.fn(async () => []),
  };
}

describe('TelegramApprovalAdapter', () => {
  let db: Client;

  beforeEach(async () => {
    db = createDbClient(':memory:');
    await initSchema(db);
  });

  it('sends a draft message and records the pending approval mapping', async () => {
    const client = fakeTelegramClient();
    const resume = vi.fn();
    const adapter = new TelegramApprovalAdapter(client, 'chat-1', db, resume);

    await adapter.sendApprovalRequest({
      runId: 'run-1',
      subreddit: 'python',
      kind: 'comment',
      title: 'A question',
      permalink: '/r/python/comments/abc',
      angle: 'Explain the gotcha',
      text: 'Here is a helpful answer.',
    });

    expect(client.sent).toHaveLength(1);
    expect(client.sent[0]?.text).toContain('Here is a helpful answer.');
    expect(await getPendingApproval(db, 100)).toEqual({ runId: 'run-1' });
  });

  it('resumes with approve on a callback query and edits the message', async () => {
    const client = fakeTelegramClient();
    const resume = vi.fn().mockResolvedValue({ status: 'success', outcome: 'ready-to-post' });
    const adapter = new TelegramApprovalAdapter(client, 'chat-1', db, resume);

    await adapter.sendApprovalRequest({
      runId: 'run-1',
      subreddit: 'python',
      kind: 'comment',
      title: 'A question',
      permalink: '/r/python/comments/abc',
      angle: 'Explain the gotcha',
      text: 'Here is a helpful answer.',
    });

    const update: TelegramUpdate = {
      update_id: 1,
      callback_query: {
        id: 'cbq-1',
        data: 'approve:run-1',
        message: {
          message_id: 100,
          text: client.sent[0]?.text,
          chat: { id: 'chat-1' },
        },
      },
    };
    client.getUpdates = vi.fn().mockResolvedValue([update]);

    const nextOffset = await adapter.pollOnce(0);

    expect(nextOffset).toBe(2);
    expect(resume).toHaveBeenCalledWith('run-1', { action: 'approve' });
    expect(client.edits[0]?.text).toContain('✅ Approved');
    expect(await getPendingApproval(db, 100)).toBeNull();
    expect(client.sent.some((m) => m.text.includes('Ready'))).toBe(true);
  });

  it('treats a text reply to a tracked draft as an edit', async () => {
    const client = fakeTelegramClient();
    const resume = vi.fn().mockResolvedValue({ status: 'suspended' });
    const adapter = new TelegramApprovalAdapter(client, 'chat-1', db, resume);

    await adapter.sendApprovalRequest({
      runId: 'run-1',
      subreddit: 'python',
      kind: 'comment',
      title: 'A question',
      permalink: '/r/python/comments/abc',
      angle: 'Explain the gotcha',
      text: 'Here is a helpful answer.',
    });

    const update: TelegramUpdate = {
      update_id: 1,
      message: {
        message_id: 101,
        text: 'make it shorter',
        reply_to_message: { message_id: 100 },
        chat: { id: 'chat-1' },
      },
    };
    client.getUpdates = vi.fn().mockResolvedValue([update]);

    await adapter.pollOnce(0);

    expect(resume).toHaveBeenCalledWith('run-1', { action: 'edit', feedback: 'make it shorter' });
    expect(await getPendingApproval(db, 100)).toBeNull();
  });

  it('ignores a reply that does not match a tracked draft message', async () => {
    const client = fakeTelegramClient();
    const resume = vi.fn();
    const adapter = new TelegramApprovalAdapter(client, 'chat-1', db, resume);

    const update: TelegramUpdate = {
      update_id: 1,
      message: {
        message_id: 999,
        text: 'random reply',
        reply_to_message: { message_id: 42 },
        chat: { id: 'chat-1' },
      },
    };
    client.getUpdates = vi.fn().mockResolvedValue([update]);

    await adapter.pollOnce(0);

    expect(resume).not.toHaveBeenCalled();
  });
});
