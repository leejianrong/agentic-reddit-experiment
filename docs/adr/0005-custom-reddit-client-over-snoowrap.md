# ADR-0005: Thin custom Reddit REST client instead of snoowrap

- Status: Accepted
- Date: 2026-09-19
- Deciders: Jian (assumed default, not user-escalated)

## Context

`snoowrap`, the long-standing Node.js Reddit API wrapper, has had no
meaningful maintenance activity in several years and its bundled types
predate current OAuth response shapes. The project is TypeScript-first and
only needs a small surface: OAuth2 (script-app grant), fetch new/hot listings
per subreddit, submit a comment, submit a post, fetch a thread's current
state (for the freshness recheck in ADR-0003).

## Decision

Build a small internal Reddit client module using native `fetch` against
Reddit's OAuth REST API directly, with `zod` schemas validating the handful
of response shapes actually used. No third-party Reddit wrapper dependency.

## Alternatives considered

| Option | Why not |
|--------|---------|
| snoowrap | Unmaintained; typed against stale OAuth shapes; pulls in a dependency for a surface area smaller than what would need patching around it anyway. |
| Newer typed/MCP-oriented Reddit packages (e.g. `redditapis-mcp`) | Aimed at MCP-tool-calling and read-heavy/data use cases with per-call pricing; this project needs direct OAuth posting/commenting under its own Reddit app credentials, not a metered read API. |

## Consequences

- Full control over retry/backoff and rate-limit handling (needed for
  ADR-0003's guardrails) instead of inheriting a wrapper's behaviour.
- More code to write and maintain than pulling in a library, but the surface
  is small (list, get, submit comment, submit post, edit-check) and stable.
- If Reddit's API shape changes, this project absorbs that directly rather
  than waiting on a wrapper's maintainer.
