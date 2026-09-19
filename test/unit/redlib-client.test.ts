import type Parser from 'rss-parser';
import { describe, expect, it, vi } from 'vitest';
import { RedlibClient } from '../../src/reddit/redlib-client.js';

function fakeParser(items: Partial<Parser.Item>[]): Parser {
  return {
    parseURL: vi.fn().mockResolvedValue({ items }),
    parseString: vi.fn(),
  } as unknown as Parser;
}

describe('RedlibClient', () => {
  it('fetches the new-sorted RSS feed for the subreddit', async () => {
    const parser = fakeParser([]);
    const client = new RedlibClient('http://redlib.local', parser);

    await client.listNew('python');

    expect(parser.parseURL).toHaveBeenCalledWith('http://redlib.local/r/python/new/.rss');
  });

  it('strips a trailing slash from the base URL', async () => {
    const parser = fakeParser([]);
    const client = new RedlibClient('http://redlib.local/', parser);

    await client.listNew('python');

    expect(parser.parseURL).toHaveBeenCalledWith('http://redlib.local/r/python/new/.rss');
  });

  it('converts RSS items into RedditPost objects', async () => {
    const parser = fakeParser([
      {
        title: 'How should I retry failed API calls?',
        link: 'http://redlib.local/r/python/comments/abc123/how_should_i_retry/',
        contentSnippet: 'What is a good backoff strategy?',
        creator: 'someone',
        pubDate: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const client = new RedlibClient('http://redlib.local', parser);

    const posts = await client.listNew('python');

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      id: 'abc123',
      name: 't3_abc123',
      title: 'How should I retry failed API calls?',
      selftext: 'What is a good backoff strategy?',
      subreddit: 'python',
      author: 'someone',
      locked: false,
    });
  });

  it('respects the limit parameter', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      title: `Post ${i}`,
      link: `http://redlib.local/r/python/comments/id${i}/post/`,
    }));
    const parser = fakeParser(items);
    const client = new RedlibClient('http://redlib.local', parser);

    const posts = await client.listNew('python', 2);

    expect(posts).toHaveLength(2);
  });

  it('falls back gracefully when a link has no comments id', async () => {
    const parser = fakeParser([{ title: 'Weird item', link: 'http://redlib.local/r/python/' }]);
    const client = new RedlibClient('http://redlib.local', parser);

    const posts = await client.listNew('python');

    expect(posts).toHaveLength(1);
    expect(posts[0]?.name).toMatch(/^t3_/);
  });
});
