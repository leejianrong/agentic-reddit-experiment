import { RedditApiError } from './errors.js';
import {
  accessTokenSchema,
  listingSchema,
  type RedditPost,
  redditPostSchema,
  type SubmitResult,
  submitResponseSchema,
  type ThreadState,
  threadStateSchema,
} from './types.js';

export interface RedditClientConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  userAgent: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

/**
 * Thin OAuth REST client over Reddit's API (ADR-0005). Only implements the
 * surface this project actually uses: list new posts, fetch a thread's
 * current state (for the pre-publish freshness recheck, ADR-0003), and
 * submit a comment or post.
 */
export class RedditClient {
  private cachedToken: CachedToken | null = null;

  constructor(
    private readonly config: RedditClientConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async listNew(subreddit: string, limit = 25): Promise<RedditPost[]> {
    const body = await this.request(`/r/${subreddit}/new?limit=${limit}&raw_json=1`);
    const listing = listingSchema.parse(body);
    return listing.data.children
      .filter((child) => child.kind === 't3')
      .map((child) => redditPostSchema.parse(child.data));
  }

  /** Returns null if the thread no longer resolves (deleted/unavailable). */
  async getThreadState(fullname: string): Promise<ThreadState | null> {
    const body = await this.request(`/api/info?id=${fullname}&raw_json=1`);
    const listing = listingSchema.parse(body);
    const child = listing.data.children[0];
    return child ? threadStateSchema.parse(child.data) : null;
  }

  async submitComment(parentFullname: string, text: string): Promise<SubmitResult> {
    const body = await this.request('/api/comment', {
      method: 'POST',
      body: new URLSearchParams({ api_type: 'json', thing_id: parentFullname, text }),
    });
    return parseSubmitResponse(body);
  }

  async submitPost(subreddit: string, title: string, text: string): Promise<SubmitResult> {
    const body = await this.request('/api/submit', {
      method: 'POST',
      body: new URLSearchParams({
        api_type: 'json',
        sr: subreddit,
        kind: 'self',
        title,
        text,
      }),
    });
    return parseSubmitResponse(body);
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.accessToken;
    }
    const basicAuth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
      'base64',
    );
    const response = await this.fetchImpl('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'User-Agent': this.config.userAgent,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
      }),
    });
    const body = await safeJson(response);
    if (!response.ok) {
      throw new RedditApiError('Failed to refresh Reddit access token', response.status, body);
    }
    const parsed = accessTokenSchema.parse(body);
    this.cachedToken = {
      accessToken: parsed.access_token,
      expiresAt: Date.now() + (parsed.expires_in - 60) * 1000,
    };
    return this.cachedToken.accessToken;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const accessToken = await this.getAccessToken();
    const response = await this.fetchImpl(`https://oauth.reddit.com${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': this.config.userAgent,
      },
    });
    const body = await safeJson(response);
    if (!response.ok) {
      throw new RedditApiError(`Reddit API request failed: ${path}`, response.status, body);
    }
    return body;
  }
}

function parseSubmitResponse(body: unknown): SubmitResult {
  const parsed = submitResponseSchema.parse(body);
  if (parsed.json.errors.length > 0) {
    throw new RedditApiError(
      `Reddit rejected the submission: ${JSON.stringify(parsed.json.errors)}`,
      200,
      body,
    );
  }
  const data = parsed.json.data;
  if (!data?.id || !data.name) {
    throw new RedditApiError('Reddit submission response missing id/name', 200, body);
  }
  return { id: data.id, name: data.name };
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
