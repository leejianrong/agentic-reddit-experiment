import { describe, expect, it, vi } from 'vitest';
import type { LlmClient } from '../../src/llm/client.js';
import { scoreCandidate } from '../../src/llm/score.js';

function fakeClient(responseText: string): LlmClient {
  return { chatCompletion: vi.fn().mockResolvedValue(responseText) };
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
    const client = fakeClient('{"relevant": true, "angle": "Explain tensor retention gotchas"}');

    const result = await scoreCandidate(client, 'deepseek/deepseek-v4-flash', {
      subreddit: 'MachineLearning',
      post,
      persona: 'test persona',
    });

    expect(result).toEqual({ relevant: true, angle: 'Explain tensor retention gotchas' });
  });

  it('extracts JSON even when wrapped in a markdown code fence', async () => {
    const client = fakeClient('```json\n{"relevant": false, "angle": ""}\n```');

    const result = await scoreCandidate(client, 'deepseek/deepseek-v4-flash', {
      subreddit: 'MachineLearning',
      post,
      persona: 'test persona',
    });

    expect(result).toEqual({ relevant: false, angle: '' });
  });

  it('defaults to not relevant when the model response is not valid JSON', async () => {
    const client = fakeClient('Sure, I can help with that! Let me think...');

    const result = await scoreCandidate(client, 'deepseek/deepseek-v4-flash', {
      subreddit: 'MachineLearning',
      post,
      persona: 'test persona',
    });

    expect(result).toEqual({ relevant: false, angle: '' });
  });
});
