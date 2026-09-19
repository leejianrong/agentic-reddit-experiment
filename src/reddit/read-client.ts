import type { RedditPost, ThreadState } from './types.js';

/**
 * The read surface this project needs from a Reddit source. `RedditClient`
 * (official OAuth API) satisfies this in full; `RedlibClient` (ADR-0009)
 * only implements `listNew` — `getThreadState` is an optional capability
 * since RSS has no lookup-by-id endpoint.
 */
export interface RedditReadClient {
  listNew(subreddit: string, limit?: number): Promise<RedditPost[]>;
  getThreadState?(fullname: string): Promise<ThreadState | null>;
}
