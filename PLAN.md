# Agentic Reddit Presence: Plan

Status: draft · Milestone: v1

## Problem

Jian wants a genuine, recognized presence as a helpful expert in a handful of
technical subreddits (Python, ML, data visualization, AI, agentic workflows,
LLMs) — the kind of reputation built by consistently showing up with good
answers and good takes. Building that manually doesn't scale: finding the
right threads, writing a quality reply, and doing it often enough to matter
takes more regular attention than he has to give it.

Self-promotion is explicitly not the goal here. That comes later, sparingly,
once a real presence exists to promote from.

## Solution

An agent continuously scans a configured list of subreddits, finds threads
and posting angles where a genuinely helpful, expert-level contribution fits
(answering a question well, adding real insight to a discussion, sharing a
useful post), and drafts a comment or post in Jian's voice. Every draft is
sent to Jian on Telegram before anything happens: he can approve it as-is,
edit the text and have it re-drafted, or reject it outright. Once approved,
the final text is handed back to him on Telegram to post to Reddit himself —
the agent never posts on Reddit's behalf (ADR-0010).

Nothing in v1 promotes Jian's own projects, tools, or content — the agent's
only job is to be useful and sound like a knowledgeable person in the room.

## Users and actors

- **Jian** — sole user, sole approver, and the one who actually publishes.
  Nothing overrides a rejection or bypasses his review, and nothing reaches
  Reddit without him physically posting it himself.
- **The agent** — non-human actor that scans, drafts, and (once approved)
  hands off the final text. Never posts to Reddit itself (ADR-0010), never
  retries a rejected draft unprompted.
- **Subreddit communities** — the audience; their subreddit-specific rules
  constrain what the agent is allowed to even draft (ADR-0004).

## Scope

**In this milestone.**
- Scanning a configurable list of subreddits (Python, ML, data viz, AI,
  agentic workflows, LLMs to start) for comment opportunities.
- Drafting genuinely helpful, non-promotional comments in a configured
  expert voice.
- Telegram-based review: approve, edit-and-redraft, or reject, per draft.
- On approval, handing the final text back to Jian on Telegram to post
  himself — the app never calls Reddit's write API (ADR-0010).
- Reading Reddit via Redlib by default, with no credentials needed
  (ADR-0009); the official OAuth API is an optional, better-reliability
  alternative when available.
- A full audit trail of every opportunity found, draft produced, and
  decision made.

**Out.**
- Any self-promotional content (mentioning Jian's own projects/tools/posts).
  This is the whole point of building presence first — reintroduced later,
  deliberately and sparingly, as its own milestone.
- Automated publishing to Reddit, in any form — not a future goal, not just
  blocked for now. Publishing is permanently a manual human action
  (ADR-0010). `RedditClient`'s write methods exist and are tested but unused,
  in case this is deliberately revisited later.
- New top-level posts (only comments for now — drafting a good post from
  scratch, rather than replying to one, is a different mechanism).
- A dedicated/second Reddit account — reads use Redlib or Jian's own
  read-only OAuth access; there's no write identity to isolate risk for.
- Replying to replies on the bot's own comments (conversation threading).
- Multi-subreddit-account support, engagement analytics/dashboards, karma
  optimization as a goal in itself.
- Slack as an approval channel (ADR-0002) — Telegram only for v1; Slack is a
  nice-to-have (R8) if it comes up later.

## Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Agent finds and drafts genuinely helpful, non-promotional comments; nothing is marked ready without Jian's explicit Telegram approval of that exact text, and the app itself never posts to Reddit | Core goal |
| R1 | Configurable subreddit list, each with allowed content types and an AI-assistance-allowed flag (ADR-0004) | Must-have |
| R2 | Scan finds candidate opportunities per subreddit, deduped against previously-seen threads, via Redlib or the official API (ADR-0009) | Must-have |
| R3 | LLM drafts subreddit-appropriate, non-promotional text in a configured expert voice; edits regenerate rather than freeform-patch | Must-have |
| R4 | Telegram flow: draft message with Approve/Reject actions; a text reply is treated as an edit and re-drafts; on approval, the final text is sent back for manual posting | Must-have |
| R5 | Best-effort freshness warning (thread may be gone/locked) surfaced to Jian before he posts, when the read source supports it (ADR-0010) | Should-have |
| R6 | Full audit log: every opportunity, draft (including edit history), and decision | Must-have |
| R7 | Reddit/Telegram/LLM failures are logged and skip cleanly — no silent data loss | Must-have |
| R8 | Slack as an additional approval channel alongside Telegram | Nice-to-have |

## Shape

| Part | Mechanism | ADR |
|------|-----------|-----|
| S1 | Scan workflow: interval trigger → Reddit read client lists new threads per configured subreddit → filter against the seen-items ledger → LLM scores relevance and helpful-angle fit → top-K per cycle become Opportunity rows | ADR-0005, ADR-0009 |
| S2 | Draft step: LLM generates comment text from an expert-voice persona config, explicitly instructed to add real value and never mention Jian's own projects/links | ADR-0004 |
| S3 | Approval workflow: one suspended Mastra run per opportunity; `suspend()` sends the draft to Telegram; `resume()` on Approve/Reject/edit-reply branches to finalize, re-draft, or end | ADR-0001, ADR-0002 |
| S4 | Finalize step: best-effort freshness check (advisory only) → record outcome → hand final text back to Telegram for Jian to post manually | ADR-0010 |
| S5 | Storage: one LibSQL database holds Mastra's workflow snapshots plus app tables (seen items, opportunities, drafts, draft outcomes) | ADR-0006 |
| S6 | Audit log: one row per lifecycle event (found → drafted → sent → decided), queryable for the measurable-success checks below | ADR-0006 |

## Affordances

**UI** (Telegram is the only UI surface in v1).

| Affordance | Place | Wires to |
|------------|-------|----------|
| Draft message with Approve/Reject buttons | Telegram chat | `resume(runId, {action})` |
| Text reply to a draft message | Telegram chat | treated as edit → `resume(runId, {action:'edit', text})`, re-suspends |
| Ready-to-post follow-up message | Telegram chat | final approved text, for Jian to copy to Reddit himself |

**Non-UI.**

| Affordance | Kind | Wires to |
|------------|------|----------|
| scan-workflow | interval loop (`setInterval`, in-process) | Reddit read client, LLM, seen-items table |
| draft-approval-workflow | Mastra suspend/resume workflow, one run per opportunity | Telegram adapter, LLM, Reddit read client (freshness check only) |
| reddit read client | internal module, official (ADR-0005) or Redlib (ADR-0009) | Reddit OAuth REST API, or a self-hosted Redlib instance's RSS feeds |
| telegram-adapter | internal module, long-polling | Telegram Bot API |
| audit log | LibSQL table (`draft_outcomes`) | queryable for manual review |

## Implementation decisions

- TypeScript, Mastra project structure; `zod` schemas define each workflow
  step's `suspendSchema`/`resumeSchema` (ADR-0001) and the Reddit client's
  response shapes (ADR-0005).
- Subreddit list, per-subreddit flags, and persona voice live in one
  editable config file (not hardcoded, not a database table) — this is the
  surface Jian tunes without touching code.
- Secrets (Reddit OAuth credentials when used, Telegram bot token,
  OpenRouter API key) live in `.env`, gitignored, never written to the audit
  log. Redlib needs no credentials at all.
- Mastra's core framework (including workflow suspend/resume) is Apache-2.0
  and free to use; only its separate `ee/`-namespaced enterprise features
  need a license, and this project doesn't touch those. Requires Node.js
  22.18+ and runs as a standalone process — no enterprise dependency, no
  hosted-service dependency beyond Telegram/OpenRouter and (optionally)
  Reddit's official API.

## Testing approach

- Reddit read clients, the LLM client, and the Telegram adapter sit behind
  small interfaces so tests run against fakes — no live network calls in
  unit or integration tests.
- Integration tests drive the scan → draft → suspend → resume → finalize
  loop end to end against fakes, asserting the R0 invariant directly: the
  app never calls Reddit's write endpoint, and a draft is only ever marked
  `ready-to-post` after an explicit Approve resume for that exact text.
- One manual end-to-end pass against real (read-only) Reddit data via Redlib
  is the acceptance gate for trusting the scan/draft loop before relying on
  it day to day.

## Assumed defaults

| ID | Assumed | Cost if wrong |
|----|---------|---------------|
| Q5 | ~~LLM = Claude via Anthropic API~~ — **superseded**: OpenRouter, cheap open-weight models (ADR-0008) | Low — model/provider is a config string, not a code change |
| Q6 | Single shared LibSQL db for Mastra snapshots + app tables | Low–Medium — splitting storage later means one migration, not a redesign |
| Q7 | Custom thin Reddit REST client (fetch + zod) instead of snoowrap | Medium — hand-rolled client needs its own retry/backoff correctness, no library to lean on |
| Q8 | Plain `setInterval` scan loop (not Mastra's native `schedule` field, not node-cron) + Telegram long-polling, no public server | Low — both are swappable without touching the workflow logic |
| Q9 | Starter subreddit list is a seed the user edits, not a fixed set | Low — it's a config file |
| Q11 | Single approver, no concurrent-writer conflict; freshness check is advisory only, not a gate | Low — Jian is physically the one posting, so he's the final check regardless |
| Q12 | Reddit fullname IDs (`t3_`/`t1_`) are the canonical identity for dedup and audit | Low — this is how Reddit itself identifies content |
| Q13 | On any external-call failure: log, skip, no automated retry of anything Reddit-facing | Low — there's no automated write path left for a retry to duplicate |
| Q14 | ~~Single long-lived Node process; hosting left to Jian, no containers required for v1~~ — **superseded**: containerized (Docker), target deployment is an always-on DigitalOcean droplet (ADR-0007) | Low — deployment target doesn't affect the workflow architecture, only the runtime packaging |
| Q15 | Success = every `ready-to-post` outcome traces to an explicit Approve action (auditable), scan cycle under ~2 min for the starter list, no duplicate prompts for the same thread | Low — these are checks, not design constraints |
| Q16 | Secrets via `.env`/gitignore; audit log stores content, never credentials | Low — standard practice |
| Q17 | Config/schema versioning deferred until an actual shape change is needed | Low — v1 schema is small |
| Q18 | Automated (no-approval) posting is out of scope, permanently — and per ADR-0010, so is *any* automated posting, approved or not | N/A — explicit user decision, not a default |
| Q19 | Replying to replies on the bot's own comments is out of scope for v1 | Low — additive later |
| Q20 | Multi-account support, karma optimization, analytics dashboards are out of scope for v1 | Low — additive later |
| Q21 | Jian is the sole primary actor/approver; the agent never overrides a rejection | N/A — directly stated in the idea |
| Q22 | Reddit reads via a self-hosted Redlib instance by default (ADR-0009), official API optional | Medium — Redlib is a scraping-adjacent dependency Reddit could disrupt; the official-API fallback path exists for exactly that reason |
| Q23 | The app never writes to Reddit, permanently, not just until API access is approved (ADR-0010) | N/A — explicit user decision |

## Open risks

- **Redlib could break or get blocked.** It works by proxying Reddit's
  public content in ways Reddit actively tries to prevent (ADR-0009); prior
  frontends (Teddit) were shut down entirely, and Redlib itself sees
  periodic breakage from Reddit-side changes. If it stops working, the scan
  step degrades until either Redlib is fixed upstream or Jian gets official
  API access and switches `buildRedditReadClient` over (a config change).
- **Opportunity quality.** The LLM's judgment of "this thread is a good fit
  for a genuinely helpful reply" may be too eager or too generic to actually
  read as expert-level. This is caught by Jian spot-checking real drafts on
  Telegram before he ever actually posts one.
- **Cheap-model reliability on the scoring path.** Since OpenRouter models
  don't uniformly support native structured outputs (ADR-0008), a
  malformed/unparseable response silently defaults to "not relevant" —
  correct to fail safe, but means opportunities can be silently missed with
  no visible error. Worth watching if the hit rate ever looks suspiciously low.
