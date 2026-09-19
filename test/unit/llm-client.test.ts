import { describe, expect, it, vi } from 'vitest';
import { OpenRouterClient } from '../../src/llm/client.js';
import { LlmApiError } from '../../src/llm/errors.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('OpenRouterClient', () => {
  it('returns the completion content on success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'hello there' } }] }));
    const client = new OpenRouterClient('test-key', fetchMock as unknown as typeof fetch);

    const result = await client.chatCompletion(
      'deepseek/deepseek-v4-flash',
      [{ role: 'user', content: 'hi' }],
      100,
    );

    expect(result).toBe('hello there');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-key' });
  });

  it('throws when the response has no content', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: null } }] }));
    const client = new OpenRouterClient('test-key', fetchMock as unknown as typeof fetch);

    await expect(
      client.chatCompletion('deepseek/deepseek-v4-flash', [{ role: 'user', content: 'hi' }], 100),
    ).rejects.toThrow(LlmApiError);
  });

  it('throws LlmApiError on a non-ok HTTP response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'unauthorized' }));
    const client = new OpenRouterClient('bad-key', fetchMock as unknown as typeof fetch);

    await expect(
      client.chatCompletion('deepseek/deepseek-v4-flash', [{ role: 'user', content: 'hi' }], 100),
    ).rejects.toThrow(LlmApiError);
  });
});
