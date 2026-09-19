import { describe, expect, it, vi } from 'vitest';
import type { LlmClient } from '../../src/llm/client.js';
import { draftContent, redraftContent } from '../../src/llm/draft.js';

function fakeClient(text: string): LlmClient {
  return { chatCompletion: vi.fn().mockResolvedValue(text) };
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
  it('returns the trimmed completion text', async () => {
    const client = fakeClient('  Use argparse subparsers for this.  \n');

    const text = await draftContent(client, 'deepseek/deepseek-v4-flash', context);

    expect(text).toBe('Use argparse subparsers for this.');
  });
});

describe('redraftContent', () => {
  it('sends the previous draft and feedback as conversation history', async () => {
    const client = fakeClient('Revised text.');

    const text = await redraftContent(
      client,
      'deepseek/deepseek-v4-flash',
      context,
      'Original text.',
      'make it shorter',
    );

    expect(text).toBe('Revised text.');
    const call = vi.mocked(client.chatCompletion).mock.calls[0];
    const messages = call?.[1];
    expect(messages).toHaveLength(4);
    expect(messages?.[2]).toMatchObject({ role: 'assistant', content: 'Original text.' });
    expect(messages?.[3]).toMatchObject({
      role: 'user',
      content: expect.stringContaining('make it shorter'),
    });
  });
});
