import { describe, expect, it, vi } from 'vitest';
import type { AnthropicMessagesClient } from '../../src/llm/client.js';
import { draftContent, redraftContent } from '../../src/llm/draft.js';

function fakeClient(text: string): AnthropicMessagesClient {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text }] }),
      parse: vi.fn(),
    },
  };
}

const context = {
  subreddit: 'Python',
  kind: 'comment' as const,
  title: 'Best way to structure a CLI tool?',
  body: '',
  angle: 'Share the argparse subcommands pattern',
  persona: 'test persona',
};

describe('draftContent', () => {
  it('extracts the text block from the response', async () => {
    const client = fakeClient('Use argparse subparsers for this.');

    const text = await draftContent(client, 'claude-sonnet-5', context);

    expect(text).toBe('Use argparse subparsers for this.');
  });

  it('throws when the response has no text block', async () => {
    const client: AnthropicMessagesClient = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [] }),
        parse: vi.fn(),
      },
    };

    await expect(draftContent(client, 'claude-sonnet-5', context)).rejects.toThrow('no text block');
  });
});

describe('redraftContent', () => {
  it('sends the previous draft and feedback as conversation history', async () => {
    const client = fakeClient('Revised text.');

    const text = await redraftContent(
      client,
      'claude-sonnet-5',
      context,
      'Original text.',
      'make it shorter',
    );

    expect(text).toBe('Revised text.');
    const call = vi.mocked(client.messages.create).mock.calls[0]?.[0];
    expect(call?.messages).toHaveLength(3);
    expect(call?.messages[1]).toMatchObject({ role: 'assistant', content: 'Original text.' });
  });
});
