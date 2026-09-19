# Agentic Reddit Presence: Slices

Vertical increments. Each ends in something you can demonstrate.

V2 and V3 from the original plan (going live with automated Reddit writes,
then extending to new posts) are gone, not deferred — ADR-0010 made
publishing a permanent manual action, so there's no "flip DRY_RUN off"
milestone left to build. What's left is V1 (now essentially complete) and
the original V4 (Slack), renumbered V2.

## V1: The loop, end to end — scan, draft, approve, hand off

**Delivers:** R0, R1, R2, R3, R4, R5, R6, R7

**Status:** Built and tested. What's left is a real soak: point the scan at
Jian's actual subreddit list via `docker compose up` and use it for a few
days before trusting the drafts unreviewed-in-spirit (they're always
reviewed — this is about trusting the *quality* enough to not feel like a
chore).

**Build plan** (for the record — all done)

1. ~~Register a Reddit OAuth app~~ — superseded: blocked on Reddit's
   Responsible Builder Policy, and no longer required at all. Redlib
   (ADR-0009) is the default read source; the official API remains an
   optional path if approval ever comes through.
2. Mastra project skeleton with the shared LibSQL database (ADR-0006) and
   the app tables: seen-items, opportunities, drafts, draft outcomes.
3. Reddit read clients (ADR-0005 official, ADR-0009 Redlib) behind one
   `RedditReadClient` interface.
4. Scan workflow (S1): fetch → dedup against seen-items → LLM
   relevance/helpful-angle scoring → write Opportunity rows.
5. Draft step (S2) and the suspend/resume approval workflow (S3) per
   ADR-0001, with the Telegram adapter (ADR-0002) sending Approve/Reject
   buttons and treating a text reply as an edit.
6. Finalize step (S4, ADR-0010): best-effort freshness warning, record the
   outcome, hand the approved text back to Telegram — no Reddit write call,
   ever.
7. Containerize the app (ADR-0007) plus a self-hosted Redlib service
   (ADR-0009) in `docker-compose.yml`.

**Demo:** the agent finds a real thread on a real subreddit via Redlib,
drafts a comment, sends it to Jian on Telegram; Jian edits it, gets the
re-drafted version, approves it, and gets the final text back to paste into
Reddit himself.

**Rests on assumptions:** Q5 (OpenRouter for drafting), Q7 (custom Reddit
client), Q9 (starter subreddit list), Q22 (Redlib as the default read
source — if Reddit disrupts Redlib, the scan step degrades until fixed
upstream or official access arrives).

### Test plan

#### End-to-end

- A scan cycle against a live (read-only) subreddit via Redlib produces at
  least one Opportunity and a Telegram draft message; after an Approve tap,
  a `ready-to-post` outcome is recorded with the exact approved text.
- A text-reply edit on a draft message produces a new Telegram message with
  the edited content, still gated behind a fresh Approve/Reject.
- A Reject ends the workflow with a `rejected` outcome and no ready-to-post
  text ever sent.

#### Integration

- Scan → seen-items dedup: running the scan twice against the same fetched
  threads produces no duplicate Opportunity rows.
- Suspend/resume round-trip: a workflow suspended mid-run, then resumed
  after a simulated process restart, continues from the correct step with
  the correct payload.
- The finalize step never calls Reddit's write endpoint, under any outcome
  (asserted via a fake that fails the test if invoked) — this is the R0
  invariant now that there is no write path to gate with dry-run.

#### Unit

- Relevance-scoring prompt returns a bounded top-K, not every thread scanned.
- Draft-generation prompt never includes a link or mention matching Jian's
  own known project names (a placeholder guard for R0's non-promotional
  constraint).
- `RedlibClient` correctly maps RSS items to `RedditPost` objects, including
  the permalink-id-to-fullname derivation and graceful fallback when a link
  doesn't match the expected shape.

## V2: Slack as an additional approval channel (nice-to-have)

**Delivers:** R8

**Build plan**

1. Implement a Slack adapter behind the same resume-triggering interface
   Telegram already uses (ADR-0002 notes this as additive, not a rewrite).
2. Route a draft to both Telegram and Slack if both are configured, with
   whichever channel acts first resolving the suspended workflow (and the
   other channel's message updated to reflect the outcome).

**Demo:** the same draft appears on both Telegram and Slack; approving it on
Slack immediately marks the Telegram message as resolved.

**Rests on assumptions:** none new — this is additive by design (ADR-0002).

### Test plan

#### End-to-end

- Approving via Slack sends the final text to that channel and updates the
  Telegram message to show it was already handled.

#### Integration

- Both adapters reading from the same suspended-workflow state never produce
  a double-resume when both fire near-simultaneously.

#### Unit

- Slack Block Kit payload renders the same draft content Telegram received.
