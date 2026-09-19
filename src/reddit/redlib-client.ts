import Parser from 'rss-parser';
import type { RedditReadClient } from './read-client.js';
import type { RedditPost } from './types.js';
import { redditPostSchema } from './types.js';

const PERMALINK_ID_PATTERN = /\/comments\/([a-z0-9]+)\//i;

/**
 * Reads subreddits via a self-hosted Redlib instance's RSS feeds instead of
 * Reddit's own API (ADR-0009) — no OAuth app, no credentials, works while
 * Reddit's Responsible Builder Policy blocks new app registration. Read-only
 * by construction: Redlib has no authenticated write path, which is fine
 * since publishing is a manual human action (ADR-0010).
 */
export class RedlibClient implements RedditReadClient {
  constructor(
    private readonly baseUrl: string,
    private readonly parser: Parser = new Parser(),
  ) {}

  async listNew(subreddit: string, limit = 25): Promise<RedditPost[]> {
    const feedUrl = `${this.baseUrl.replace(/\/$/, '')}/r/${subreddit}/new/.rss`;
    const feed = await this.parser.parseURL(feedUrl);
    return (feed.items ?? []).slice(0, limit).map((item) => toRedditPost(item, subreddit));
  }

  // No getThreadState: RSS has no lookup-by-id endpoint, so the pre-publish
  // freshness recheck is simply unavailable on this read source (see
  // publishStep in draft-approval.ts, which treats it as an optional
  // capability and skips the check when absent).
}

function toRedditPost(item: Parser.Item, subreddit: string): RedditPost {
  const link = item.link ?? '';
  const id = PERMALINK_ID_PATTERN.exec(link)?.[1] ?? crypto.randomUUID().slice(0, 8);
  const permalink = new URL(link, 'https://reddit.com').pathname;

  return redditPostSchema.parse({
    id,
    name: `t3_${id}`,
    title: item.title ?? '(untitled)',
    selftext: item.contentSnippet ?? item.content ?? '',
    subreddit,
    permalink,
    url: link,
    author: item.creator ?? 'unknown',
    created_utc: item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) : 0,
    num_comments: 0,
    locked: false,
  });
}
