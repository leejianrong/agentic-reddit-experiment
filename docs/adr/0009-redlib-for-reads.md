# ADR-0009: Redlib as the default Reddit read source

- Status: Accepted
- Date: 2026-09-19
- Deciders: Jian

## Context

Reddit's Responsible Builder Policy (effective late 2025) gates new OAuth
app registration behind manual review — confirmed directly, not
hypothetical: Jian hit this wall attempting to register a script app at
reddit.com/prefs/apps. Reddit's own unauthenticated `.json` endpoints
(`www.reddit.com/r/*.json`, `old.reddit.com/r/*.json`) are also dead as of
2026 — verified directly (403 / forced login), not just the developer API.
Teddit, which historically offered the same `.json`/`.rss` convenience with
zero setup, shut down in 2023 and has no revival.

Jian doesn't want to wait on manual review to start using the tool. Given
ADR-0010 removes the need for Reddit *write* access entirely, the only
remaining requirement is read access — and that opens up an option that
wouldn't work for writing: Redlib, a privacy-focused Reddit front-end that
still functions in 2026 by proxying Reddit's public content, and exposes a
documented per-subreddit RSS feed (`/r/<subreddit>/new/.rss`, mirroring
Reddit's own historical RSS convention) with no account or credentials
needed.

## Decision

Add `RedlibClient` (`src/reddit/redlib-client.ts`), reading a self-hosted
Redlib instance's RSS feeds via the `rss-parser` package, and use it as the
default Reddit read source when no official OAuth credentials are
configured. `src/reddit/read-client.ts` defines the `RedditReadClient`
interface both `RedlibClient` and the official `RedditClient` satisfy;
`listNew` is required, `getThreadState` is optional (Redlib/RSS has no
lookup-by-id endpoint, so the pre-publish freshness check in
`draft-approval.ts` simply skips it when unavailable rather than failing).

`docker-compose.yml` runs a self-hosted Redlib instance
(`quay.io/redlib/redlib`) alongside the app by default, reachable only over
the internal Compose network — self-hosting was chosen over a public
instance for reliability (public instances are shared and rate-limited by
Reddit per-IP). `buildRedditReadClient` in `src/mastra/index.ts` prefers the
official `RedditClient` when `REDDIT_CLIENT_ID` etc. are set, falling back
to `RedlibClient` via `REDLIB_URL` otherwise — swapping to official access
later, if it's ever approved, is a config change, not a code change.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Teddit | Confirmed dead — shut down 2023, no revival. |
| Reddit's own public `.json` endpoints, no proxy | Confirmed dead as of 2026 — tested directly, both `www.` and `old.` variants now block or force login. |
| A public Redlib instance instead of self-hosting | Zero setup, but shared public instances are more exposed to Reddit's per-IP rate limiting under any real usage; self-hosting is one extra Compose service for meaningfully better reliability. |
| Scrape Redlib's rendered HTML pages (e.g. with Cheerio, as some Reddit MCP servers do) | Redlib's RSS feeds are a stable, documented, structured format for exactly this use case — parsing arbitrary HTML markup would be far more fragile for no benefit. |

## Consequences

- No Reddit credentials are required to run this project at all now — a
  fresh clone works out of the box with `docker compose up` once Telegram
  and OpenRouter secrets are set.
- Scraping Reddit's content via a proxy, even read-only and anonymous, is
  still technically outside Reddit's User Agreement — a materially lower
  risk than automated posting (no account involved, no write action,
  operational risk lands on the Redlib instance's IP) but not zero. This is
  a deliberate, informed tradeoff, not an oversight.
- `RedditPost.num_comments` and `.locked` are always defaulted (`0`,
  `false`) for Redlib-sourced posts — RSS doesn't carry that metadata. This
  only affects display/scoring nuance, not correctness of the core loop.
- If Reddit changes Redlib's access (as it has done to prior frontends),
  this read path degrades; the official-API path remains the durable
  long-term option and this project is structured so switching to it later
  costs nothing beyond getting approved.
