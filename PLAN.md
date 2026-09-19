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
sent to Jian on Telegram before anything happens on Reddit: he can approve it
as-is, edit the text and have it re-drafted, or reject it outright. Only an
explicitly approved draft is ever published, from Jian's own Reddit account.

Nothing in v1 promotes Jian's own projects, tools, or content — the agent's
only job is to be useful and sound like a knowledgeable person in the room.

## Users and actors

- **Jian** — sole user and sole approver. Every publish decision is his;
  nothing overrides a rejection or bypasses his review.
- **The agent** — non-human actor that scans, drafts, and (once approved)
  publishes. Never publishes unapproved content, never retries a rejected
  draft unprompted.
- **Subreddit communities** — the audience; their subreddit-specific rules
  constrain what the agent is allowed to even draft (ADR-0004).

## Scope

**In this milestone.**
- Scanning a configurable list of subreddits (Python, ML, data viz, AI,
  agentic workflows, LLMs to start) for comment and new-post opportunities.
- Drafting genuinely helpful, non-promotional comments and posts in a
  configured expert voice.
- Telegram-based review: approve, edit-and-redraft, or reject, per draft.
- Publishing only approved drafts, from Jian's existing personal Reddit
  account, with rate caps and a dry-run mode (ADR-0003).
- A full audit trail of every opportunity found, draft produced, decision
  made, and Reddit action taken.

**Out.**
- Any self-promotional content (mentioning Jian's own projects/tools/posts).
  This is the whole point of building presence first — reintroduced later,
  deliberately and sparingly, as its own milestone.
- Fully autonomous publishing without a human approval step. Not a future
  goal for this account — the approval gate is permanent, not training
  wheels.
- A dedicated/second Reddit account (ADR-0003 uses the existing one).
- Replying to replies on the bot's own comments (conversation threading).
- Multi-subreddit-account support, engagement analytics/dashboards, karma
  optimization as a goal in itself.
- Slack as an approval channel (ADR-0002) — Telegram only for v1; Slack is a
  nice-to-have (R8) if it comes up later.

## Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Agent finds and drafts genuinely helpful, non-promotional posts/comments; nothing reaches Reddit without Jian's explicit Telegram approval of that exact text | Core goal |
| R1 | Configurable subreddit list, each with allowed content types (post/comment) and an AI-assistance-allowed flag (ADR-0004) | Must-have |
| R2 | Scheduled scan finds candidate opportunities per subreddit, deduped against previously-seen threads | Must-have |
| R3 | LLM drafts subreddit-appropriate, non-promotional text in a configured expert voice; edits regenerate rather than freeform-patch | Must-have |
| R4 | Telegram flow: draft message with Approve/Reject actions; a text reply is treated as an edit and re-drafts | Must-have |
| R5 | Safety guardrails: dry-run default, configurable rate caps, thread-freshness recheck immediately before publish, a global kill switch (ADR-0003) | Must-have |
| R6 | Full audit log: every opportunity, draft (including edit history), decision, and resulting Reddit action or failure | Must-have |
| R7 | Reddit/Telegram/LLM failures are logged and skip cleanly — no silent data loss, no duplicate publish on retry | Must-have |
| R8 | Slack as an additional approval channel alongside Telegram | Nice-to-have |

## Shape

| Part | Mechanism | ADR |
|------|-----------|-----|
| S1 | Scan workflow: scheduled trigger → Reddit read client lists new/hot threads per configured subreddit → filter against the seen-items ledger → LLM scores relevance and helpful-angle fit → top-K per cycle become Opportunity rows | ADR-0005 |
| S2 | Draft step: LLM generates comment/post text from an expert-voice persona config, explicitly instructed to add real value and never mention Jian's own projects/links | ADR-0004 |
| S3 | Approval workflow: one suspended Mastra run per opportunity; `suspend()` sends the draft to Telegram; `resume()` on Approve/Reject/edit-reply branches to publish, re-draft, or end | ADR-0001, ADR-0002 |
| S4 | Publish step: freshness recheck (thread still open, no near-duplicate reply already present) → rate-cap check → live publish or dry-run log → PostingRecord written | ADR-0003, ADR-0005 |
| S5 | Storage: one LibSQL database holds Mastra's workflow snapshots plus app tables (subreddits, seen items, opportunities, drafts, posting records) | ADR-0006 |
| S6 | Audit log: one row per lifecycle event (found → drafted → sent → decided → published/failed), queryable for the measurable-success checks below | ADR-0006 |

## Affordances

**UI** (Telegram is the only UI surface in v1).

| Affordance | Place | Wires to |
|------------|-------|----------|
| Draft message with Approve/Reject buttons | Telegram chat | `resume(runId, {action})` |
| Text reply to a draft message | Telegram chat | treated as edit → `resume(runId, {action:'edit', text})`, re-suspends |
| `/status` command | Telegram chat | reads pending Drafts + recent PostingRecords |

**Non-UI.**

| Affordance | Kind | Wires to |
|------------|------|----------|
| scan-workflow | scheduled job (node-cron, in-process) | Reddit read client, LLM, seen-items table |
| draft-approval-workflow | Mastra suspend/resume workflow, one run per opportunity | Telegram adapter, LLM, Reddit write client |
| reddit-client | internal module | Reddit OAuth REST API (ADR-0005) |
| telegram-adapter | internal module, long-polling | Telegram Bot API |
| audit log | LibSQL table | read by `/status` and manual review |

## Implementation decisions

- TypeScript, Mastra project structure; `zod` schemas define each workflow
  step's `suspendSchema`/`resumeSchema` (ADR-0001) and the Reddit client's
  response shapes (ADR-0005).
- Subreddit list, per-subreddit flags, persona voice, and rate caps live in
  one editable config file (not hardcoded, not a database table) — this is
  the surface Jian tunes without touching code.
- Secrets (Reddit OAuth credentials, Telegram bot token, Anthropic API key)
  live in `.env`, gitignored, never written to the audit log.
- `DRY_RUN` and a kill-switch flag are environment/config toggles checked
  immediately before the publish step, not deep in call chains — one place
  to verify they actually stop a publish.
- Mastra's core framework (including workflow suspend/resume) is Apache-2.0
  and free to use; only its separate `ee/`-namespaced enterprise features
  need a license, and this project doesn't touch those. Requires Node.js
  22.18+ and runs as a standalone process — no enterprise dependency, no
  hosted-service dependency beyond the Reddit/Telegram/Anthropic APIs.

## Testing approach

- Reddit client and Telegram adapter sit behind small interfaces so tests run
  against fakes — no live network calls in unit or integration tests.
- Integration tests drive the scan → draft → suspend → resume → publish loop
  end to end against fakes, asserting the R0 invariant directly: no publish
  call fires without a preceding Approve resume for that exact draft text.
- The freshness recheck and rate-cap guard (ADR-0003) get direct test
  coverage of their block-the-publish paths, not just the happy path — they
  are the only defense once dry-run is turned off.
- One manual end-to-end pass against real (read-only) Reddit data, still in
  dry-run, is the acceptance gate before live posting is ever enabled.

## Assumed defaults

| ID | Assumed | Cost if wrong |
|----|---------|---------------|
| Q5 | LLM = Claude via Anthropic API | Low — Mastra abstracts the model call; swapping providers is a config change |
| Q6 | Single shared LibSQL db for Mastra snapshots + app tables | Low–Medium — splitting storage later means one migration, not a redesign |
| Q7 | Custom thin Reddit REST client (fetch + zod) instead of snoowrap | Medium — hand-rolled client needs its own retry/backoff correctness, no library to lean on |
| Q8 | node-cron scan scheduler + Telegram long-polling, no public server | Low — both are swappable without touching the workflow logic |
| Q9 | Starter subreddit list is a seed the user edits, not a fixed set | Low — it's a config file |
| Q10 | Default rate caps (e.g. 3 comments/day, 1 post/3 days) and DRY_RUN=true by default | Medium — too strict just delays feedback; too loose is the actual risk this guards against |
| Q11 | Single approver, no concurrent-writer conflict; freshness recheck is the only staleness guard needed | Medium — if Jian ever adds a second approver, needs a real conflict rule |
| Q12 | Reddit fullname IDs (`t3_`/`t1_`) are the canonical identity for dedup and audit | Low — this is how Reddit itself identifies content |
| Q13 | On any external-call failure: log, skip, never auto-retry a publish more than once | Medium — wrong here risks a duplicate post, which is the exact failure mode ADR-0003 exists to prevent |
| Q14 | Single long-lived Node process; hosting (local vs VPS) left to Jian, no containers required for v1 | Low — deployment target doesn't affect the architecture |
| Q15 | Success = 100% approval-gated publishes (auditable), scan cycle under ~2 min for the starter list, no duplicate prompts for the same thread | Low — these are checks, not design constraints |
| Q16 | Secrets via `.env`/gitignore; audit log stores content and Reddit IDs, never credentials | Low — standard practice |
| Q17 | Config/schema versioning deferred until an actual shape change is needed | Low — v1 schema is small |
| Q18 | Fully autonomous (no-approval) posting is out of scope, permanently, not just for v1 | N/A — explicit user decision, not a default |
| Q19 | Replying to replies on the bot's own comments is out of scope for v1 | Low — additive later |
| Q20 | Multi-account support, karma optimization, analytics dashboards are out of scope for v1 | Low — additive later |
| Q21 | Jian is the sole primary actor/approver; the agent never overrides a rejection | N/A — directly stated in the idea |

## Open risks

- **Reddit OAuth app registration friction.** Some current sources describe
  a gated "Responsible Builder Policy" for Reddit API access; it's unclear
  whether that applies to personal OAuth "script" apps (used here) or only
  to commercial/data-licensing access. Slice 1 confronts this first, before
  anything else is built on top of it.
- **Opportunity quality.** The LLM's judgment of "this thread is a good fit
  for a genuinely helpful reply" may be too eager or too generic to actually
  read as expert-level. The dry-run soak period in Slice 1/2 is where this
  gets caught, via Jian spot-checking drafts before any go live.
- **Guardrail correctness under an irreversible-cost account.** Because
  ADR-0003 uses Jian's real account, a bug in the freshness recheck or rate
  cap is not a low-stakes miss — it's the scenario those mechanisms exist to
  prevent. These get direct test coverage, not just the happy path.
