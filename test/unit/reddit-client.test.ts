import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedditClient } from '../../src/reddit/client.js';
import { RedditApiError } from '../../src/reddit/errors.js';

const config = {
  clientId: 'id',
  clientSecret: 'secret',
  refreshToken: 'refresh',
  userAgent: 'test-agent/0.0.0',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const tokenResponse = () =>
  jsonResponse(200, {
    access_token: 'token-abc',
    token_type: 'bearer',
    expires_in: 3600,
    scope: '*',
  });

describe('RedditClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
  });

  it('fetches an access token once and reuses it across requests', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(200, { kind: 'Listing', data: { children: [] } }))
      .mockResolvedValueOnce(jsonResponse(200, { kind: 'Listing', data: { children: [] } }));

    const client = new RedditClient(config, fetchMock as unknown as typeof fetch);
    await client.listNew('python');
    await client.listNew('python');

    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('access_token'));
    expect(tokenCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('parses new posts from a listing response', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(
      jsonResponse(200, {
        kind: 'Listing',
        data: {
          children: [
            {
              kind: 't3',
              data: {
                id: 'abc123',
                name: 't3_abc123',
                title: 'A helpful question',
                selftext: 'body text',
                subreddit: 'python',
                permalink: '/r/python/comments/abc123/a_helpful_question/',
                url: 'https://reddit.com/r/python/comments/abc123',
                author: 'someone',
                created_utc: 1700000000,
                num_comments: 3,
                locked: false,
              },
            },
          ],
        },
      }),
    );

    const client = new RedditClient(config, fetchMock as unknown as typeof fetch);
    const posts = await client.listNew('python');

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ name: 't3_abc123', title: 'A helpful question' });
  });

  it('returns null from getThreadState when the thread no longer resolves', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(200, { kind: 'Listing', data: { children: [] } }));

    const client = new RedditClient(config, fetchMock as unknown as typeof fetch);
    const state = await client.getThreadState('t3_gone');

    expect(state).toBeNull();
  });

  it('reports a locked thread via getThreadState', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(
      jsonResponse(200, {
        kind: 'Listing',
        data: {
          children: [
            {
              kind: 't3',
              data: { name: 't3_locked', author: 'someone', locked: true, num_comments: 10 },
            },
          ],
        },
      }),
    );

    const client = new RedditClient(config, fetchMock as unknown as typeof fetch);
    const state = await client.getThreadState('t3_locked');

    expect(state?.locked).toBe(true);
  });

  it('submits a comment and returns its identity', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(
      jsonResponse(200, {
        json: { errors: [], data: { id: 'newcomment', name: 't1_newcomment' } },
      }),
    );

    const client = new RedditClient(config, fetchMock as unknown as typeof fetch);
    const result = await client.submitComment('t3_parent', 'a genuinely helpful reply');

    expect(result).toEqual({ id: 'newcomment', name: 't1_newcomment' });
  });

  it('throws when Reddit rejects a submission with errors', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(
      jsonResponse(200, {
        json: { errors: [['RATELIMIT', 'you are doing that too much', 'ratelimit']], data: {} },
      }),
    );

    const client = new RedditClient(config, fetchMock as unknown as typeof fetch);
    await expect(client.submitComment('t3_parent', 'text')).rejects.toThrow(RedditApiError);
  });

  it('throws RedditApiError on a non-ok HTTP response', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(403, { message: 'Forbidden' }));

    const client = new RedditClient(config, fetchMock as unknown as typeof fetch);
    await expect(client.listNew('python')).rejects.toThrow(RedditApiError);
  });
});
