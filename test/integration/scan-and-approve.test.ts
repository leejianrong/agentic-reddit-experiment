import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../src/config.js';
import type { ChatMessage, LlmClient } from '../../src/llm/client.js';
import { buildApp } from '../../src/mastra/index.js';
import { RedditClient } from '../../src/reddit/client.js';
import type { TelegramClientLike } from '../../src/telegram/client.js';
import type { TelegramMessage, TelegramUpdate } from '../../src/telegram/types.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fakeRedditFetch(): typeof fetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('access_token')) {
      return jsonResponse(200, {
        access_token: 'tok',
        token_type: 'bearer',
        expires_in: 3600,
        scope: '*',
      });
    }
    if (url.includes('/r/Python/new')) {
      return jsonResponse(200, {
        kind: 'Listing',
        data: {
          children: [
            {
              kind: 't3',
              data: {
                id: 'abc123',
                name: 't3_abc123',
                title: 'How should I retry failed API calls?',
                selftext: 'What is a good backoff strategy for flaky HTTP calls?',
                subreddit: 'Python',
                permalink: '/r/Python/comments/abc123/',
                url: 'https://reddit.com/r/Python/comments/abc123',
                author: 'someone',
                created_utc: 1700000000,
                num_comments: 2,
                locked: false,
              },
            },
          ],
        },
      });
    }
    if (url.includes('/api/info')) {
      return jsonResponse(200, {
        kind: 'Listing',
        data: {
          children: [
            {
              kind: 't3',
              data: { name: 't3_abc123', author: 'someone', locked: false, num_comments: 2 },
            },
          ],
        },
      });
    }
    if (url.includes('/new')) {
      // any other subreddit's listing — nothing to find
      return jsonResponse(200, { kind: 'Listing', data: { children: [] } });
    }
    if (url.includes('/api/comment')) {
      throw new Error('submitComment must never be called — publishing is manual (ADR-0010)');
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  }) as unknown as typeof fetch;
}

function fakeLlm(draftText: string): LlmClient {
  return {
    chatCompletion: vi.fn(async (_model: string, messages: ChatMessage[]) => {
      const systemPrompt = messages[0]?.content ?? '';
      if (systemPrompt.includes('JSON object')) {
        return JSON.stringify({ relevant: true, angle: 'Explain exponential backoff with jitter' });
      }
      return draftText;
    }),
  };
}

function fakeTelegramClient(): TelegramClientLike & {
  sent: { chatId: string; text: string; buttons?: { text: string; callback_data: string }[][] }[];
} {
  let nextMessageId = 500;
  const sent: {
    chatId: string;
    text: string;
    buttons?: { text: string; callback_data: string }[][];
  }[] = [];
  return {
    sent,
    sendMessage: vi.fn(async (chatId, text, buttons) => {
      const message: TelegramMessage = { message_id: nextMessageId++, chat: { id: chatId } };
      sent.push({ chatId, text, buttons });
      return message;
    }),
    editMessageText: vi.fn(async () => {}),
    answerCallbackQuery: vi.fn(async () => {}),
    getUpdates: vi.fn().mockResolvedValue([]),
  };
}

const DRAFT_TEXT = 'Exponential backoff with jitter works well here — start at 200ms.';

async function setUpScannedApp(dbPath: string, draftText = DRAFT_TEXT) {
  const config = loadConfig({
    REDDIT_CLIENT_ID: 'id',
    REDDIT_CLIENT_SECRET: 'secret',
    REDDIT_REFRESH_TOKEN: 'refresh',
    REDDIT_USER_AGENT: 'test-agent/0.0.0',
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_CHAT_ID: 'chat-1',
    OPENROUTER_API_KEY: 'openrouter-key',
    DATABASE_URL: `file:${dbPath}`,
  });

  const redditReadClient = new RedditClient(
    {
      clientId: config.REDDIT_CLIENT_ID as string,
      clientSecret: config.REDDIT_CLIENT_SECRET as string,
      refreshToken: config.REDDIT_REFRESH_TOKEN as string,
      userAgent: config.REDDIT_USER_AGENT as string,
    },
    fakeRedditFetch(),
  );
  const llm = fakeLlm(draftText);
  const telegramClient = fakeTelegramClient();

  const app = await buildApp(config, { redditReadClient, llm, telegramClient });

  const scanRun = await app.mastra.getWorkflow('scan-subreddits').createRun();
  const scanResult = await scanRun.start({ inputData: {} });
  if (scanResult.status !== 'success' || scanResult.result.opportunitiesCreated !== 1) {
    throw new Error(`Expected scan to create exactly one opportunity, got: ${scanResult.status}`);
  }

  const approveButton = telegramClient.sent[0]?.buttons?.[0]?.[0];
  const runId = approveButton?.callback_data.replace(/^(approve|reject):/, '');
  if (!runId) throw new Error('No runId captured from the draft message buttons');

  return { app, telegramClient, runId };
}

function callbackUpdate(
  action: 'approve' | 'reject',
  runId: string,
  text?: string,
): TelegramUpdate {
  return {
    update_id: 1,
    callback_query: {
      id: 'cbq-1',
      data: `${action}:${runId}`,
      message: { message_id: 500, text, chat: { id: 'chat-1' } },
    },
  };
}

describe('scan -> draft -> Telegram approve -> dry-run publish', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = join(tmpdir(), `agentic-reddit-test-${randomUUID()}.db`);
  });

  afterEach(async () => {
    await rm(dbPath, { force: true });
    await rm(`${dbPath}-wal`, { force: true });
    await rm(`${dbPath}-shm`, { force: true });
  });

  it('finds one opportunity, drafts it, and hands off the final text once approved', async () => {
    const { app, telegramClient, runId } = await setUpScannedApp(dbPath);

    expect(telegramClient.sent).toHaveLength(1);
    expect(telegramClient.sent[0]?.text).toContain('Exponential backoff with jitter');

    vi.mocked(telegramClient.getUpdates).mockResolvedValueOnce([
      callbackUpdate('approve', runId, telegramClient.sent[0]?.text),
    ]);
    await app.telegramAdapter.pollOnce(0);

    // R0 invariant: the app never calls Reddit's write endpoint (ADR-0010) —
    // fakeRedditFetch throws if /api/comment is called — it only marks the
    // draft ready and hands the final text back for the human to post.
    const draftRow = await app.appDb.execute('SELECT status FROM drafts');
    expect(draftRow.rows[0]).toMatchObject({ status: 'approved' });

    const outcomeRow = await app.appDb.execute('SELECT outcome, detail FROM draft_outcomes');
    expect(outcomeRow.rows[0]).toMatchObject({
      outcome: 'ready-to-post',
      detail: DRAFT_TEXT,
    });

    expect(telegramClient.sent.some((m) => m.text.includes('Ready'))).toBe(true);
  });

  it('never hands off a rejected draft as ready to post', async () => {
    const { app, telegramClient, runId } = await setUpScannedApp(dbPath);

    vi.mocked(telegramClient.getUpdates).mockResolvedValueOnce([
      callbackUpdate('reject', runId, telegramClient.sent[0]?.text),
    ]);
    await app.telegramAdapter.pollOnce(0);

    const draftRow = await app.appDb.execute('SELECT status FROM drafts');
    expect(draftRow.rows[0]).toMatchObject({ status: 'rejected' });

    const outcomeRows = await app.appDb.execute('SELECT outcome FROM draft_outcomes');
    expect(outcomeRows.rows).toEqual([{ outcome: 'rejected' }]);

    expect(telegramClient.sent.some((m) => m.text.includes('Rejected'))).toBe(true);
  });
});
