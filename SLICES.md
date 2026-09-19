# Agentic Reddit Presence: Slices

Vertical increments. Each ends in something you can demonstrate. Slice 1
confronts the riskiest unknowns: whether Reddit API access works as assumed,
and whether the scan → draft → Telegram-approve → publish loop holds together
end to end — safely, in dry-run, before any live posting exists at all.

## V1: Prove the loop (dry-run only)

**Delivers:** R0 (partial, dry-run only), R1, R2, R3, R6

**Build plan**

1. Register a Reddit OAuth "script" app on Jian's account; confirm read and
   write scopes actually work against a throwaway test post/comment on a
   test subreddit. This is the first real risk check (Open risk 1 in
   PLAN.md) — do this before writing any framework code.
2. Set up the Mastra project skeleton with the shared LibSQL database
   (ADR-0006) and the app tables: subreddits, seen-items, opportunities,
   drafts, posting records.
3. Build the Reddit read client (ADR-0005): list new/hot threads for a
   configured subreddit.
4. Build the scan workflow (S1): fetch → dedup against seen-items → LLM
   relevance/helpful-angle scoring → write Opportunity rows.
5. Build the draft step (S2) and the suspend/resume approval workflow (S3)
   per ADR-0001, with the Telegram adapter (ADR-0002) sending
   Approve/Reject buttons and treating a text reply as an edit.
6. Build the publish step (S4) but wired to `DRY_RUN=true` only — it runs
   the freshness recheck and rate-cap logic and logs what it would have
   done, without calling Reddit's write endpoint.
7. Point the scan at 2-3 subreddits from the starter list (Q9) and let it
   run for real, in dry-run, so Jian can review actual drafts on Telegram.
8. Containerize the app (ADR-0007): multi-stage Dockerfile, Compose file
   bind-mounting `./data` for the LibSQL file, CI job that builds the image
   on every push. Deploying it to an actual droplet is a later, separate
   step once one is provisioned.

**Demo:** the agent finds a real thread on a real subreddit, drafts a
comment, sends it to Jian on Telegram; Jian edits it, gets the re-drafted
version, approves it, and the log shows a would-be publish with the approved
text — with nothing actually posted to Reddit.

**Rests on assumptions:** Q5 (Claude for drafting), Q7 (custom Reddit
client), Q9 (starter subreddit list), Q10 (DRY_RUN default) — if Reddit
registration (step 1) doesn't work as expected, this slice's build plan
starting at step 3 is blocked until that's resolved.

### Test plan

#### End-to-end

- A dry-run cycle against a live (read-only) subreddit produces at least one
  Opportunity, a Telegram draft message, and — after an Approve tap — a
  logged "would publish" entry with the exact approved text.
- A text-reply edit on a draft message produces a new Telegram message with
  the edited content, still gated behind a fresh Approve/Reject.
- A Reject ends the workflow with no publish-log entry at all.

#### Integration

- Scan → seen-items dedup: running the scan twice against the same fetched
  threads produces no duplicate Opportunity rows.
- Suspend/resume round-trip: a workflow suspended mid-run, then resumed
  after a simulated process restart, continues from the correct step with
  the correct payload.
- Publish step in dry-run never calls the real Reddit write client (asserted
  via a fake that fails the test if invoked).

#### Unit

- Relevance-scoring prompt returns a bounded top-K, not every thread scanned.
- Draft-generation prompt never includes a link or mention matching Jian's
  own known project names (a placeholder guard for R0's non-promotional
  constraint).
- Rate-cap and freshness-check functions return correct block/allow decisions
  against fixture thread states (open, locked, deleted, already-replied).

## V2: Go live on comments

**Delivers:** R0 (full), R4, R5, R7

**Build plan**

1. Flip `DRY_RUN=false` for comments only; posts stay dry-run.
2. Wire the freshness recheck and rate caps (already built in V1) to the
   real Reddit write client for comment submission.
3. Add the global kill switch and verify it halts both scanning and
   publishing without killing the process.
4. Expand the scan to the full starter subreddit list (Q9).
5. Add failure handling (R7) for Reddit/Telegram/LLM errors: log-and-skip,
   single safe retry on transient network errors only, never a silent
   duplicate publish.

**Demo:** an approved draft actually appears as a real comment on Reddit
within the rate cap; a deliberately stale approval (thread locked in the
meantime) is caught by the freshness recheck and logged as skipped, not
posted.

**Rests on assumptions:** Q10 (rate caps are conservative enough to be safe
but not so tight they're useless), Q13 (failure handling never double-posts)
— if either is wrong, the cost lands on Jian's real account (ADR-0003).

### Test plan

#### End-to-end

- An approved comment draft results in a real comment on a real (test)
  thread, and the resulting Reddit comment ID is recorded in the audit log.
- A thread that goes stale (locked/deleted) between approval and publish is
  logged as skipped, with no publish attempt made.
- Exceeding the daily comment rate cap blocks further publishes until the
  window resets, without crashing the scan loop.

#### Integration

- A simulated Reddit API error (429, 403, locked-thread response) on publish
  results in exactly one log entry and no retry-induced duplicate.
- The kill switch, flipped mid-cycle, stops the next scheduled scan and
  blocks any in-flight approval from reaching the publish step.

#### Unit

- Rate-cap window logic correctly resets after its configured period.
- Retry logic distinguishes transient (network) errors, eligible for one
  retry, from terminal ones (locked, banned, 403), which are not retried.

## V3: New top-level posts

**Delivers:** R0 (posts), R1 (post-specific subreddit rules)

**Build plan**

1. Extend the draft step to generate new-post drafts (title + body) using
   the same non-promotional expert-voice persona.
2. Add post-specific safety checks: per-subreddit post-frequency limits
   (many subreddits cap self-posts far more tightly than comments) and any
   required flair.
3. Apply a stricter, separate rate cap for posts (Q10's post cap) and route
   posts through the same freshness/dry-run/kill-switch machinery as V2.
4. Soak in dry-run for posts specifically before flipping them live,
   independent of the comment path's live status.

**Demo:** the agent drafts a new top-level post (e.g. sharing an interesting
technique or asking a well-formed question), Jian approves it via Telegram,
and it goes live as a real Reddit post, correctly flaired if the subreddit
requires it.

**Rests on assumptions:** Q9 (subreddit configs include per-subreddit post
rules, not just a name list) — if subreddit-specific post rules aren't
captured accurately, this is where a rule violation would actually surface.

### Test plan

#### End-to-end

- An approved post draft is published with the correct title, body, and
  required flair (where the subreddit config specifies one).
- A subreddit configured as post-frequency-limited blocks a second post
  attempt within its window.

#### Integration

- Flair requirement missing from a subreddit's config surfaces as a logged
  failure at publish time, not a malformed live post.

#### Unit

- Post-frequency-limit check reads the correct per-subreddit window from
  config, independent of the global post rate cap.

## V4: Slack as an additional approval channel (nice-to-have)

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

- Approving via Slack publishes the draft and updates the Telegram message
  to show it was already handled.

#### Integration

- Both adapters reading from the same suspended-workflow state never produce
  a double-resume (double-publish) when both fire near-simultaneously.

#### Unit

- Slack Block Kit payload renders the same draft content Telegram received.
