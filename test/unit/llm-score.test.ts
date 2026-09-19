import { describe, expect, it, vi } from 'vitest';
import type { AnthropicMessagesClient } from '../../src/llm/client.js';
import { scoreCandidate } from '../../src/llm/score.js';

function fakeClient(parsedOutput: unknown): AnthropicMessagesClient {
  return {
    messages: {
      parse: vi.fn().mockResolvedValue({ parsed_output: parsedOutput }),
      create: vi.fn(),
    },
  };
}

describe('scoreCandidate', () => {
  const post = {
    id: 'abc',
    name: 't3_abc',
    title: 'How do I debug a memory leak in my training loop?',
    selftext: 'body',
    subreddit: 'MachineLearning',
    permalink: '/r/MachineLearning/comments/abc',
    url: 'https://reddit.com',
    author: 'someone',
    created_utc: 1700000000,
    num_comments: 2,
    locked: false,
  };

  it('returns the parsed relevance decision', async () => {
    const client = fakeClient({ relevant: true, angle: 'Explain tensor retention gotchas' });

    const result = await scoreCandidate(client, 'claude-haiku-4-5-20251001', {
      subreddit: 'MachineLearning',
      post,
      persona: 'test persona',
    });

    expect(result).toEqual({ relevant: true, angle: 'Explain tensor retention gotchas' });
  });

  it('defaults to not relevant when the model returns no parsed output', async () => {
    const client = fakeClient(undefined);

    const result = await scoreCandidate(client, 'claude-haiku-4-5-20251001', {
      subreddit: 'MachineLearning',
      post,
      persona: 'test persona',
    });

    expect(result).toEqual({ relevant: false, angle: '' });
  });
});
